use crate::{
    error::{AppError, AppResult, ErrorKind},
    model::*,
};
use rusqlite::{Connection, OptionalExtension, params};
use std::{
    path::Path,
    sync::{Mutex, MutexGuard},
    time::{SystemTime, UNIX_EPOCH},
};

/// Passage content and vector to persist atomically.
pub struct NewPassage {
    pub text: String,
    pub location: String,
    pub token_count: u32,
    pub embedding: Vec<f32>,
}
/// A passage ranked by vector distance.
#[derive(Debug, Clone, PartialEq)]
pub struct PassageHit {
    pub passage_id: PassageId,
    pub document_id: DocumentId,
    pub document_name: String,
    pub location: String,
    pub text: String,
    pub distance: f32,
}
/// Thread-safe local SQLite store.
pub struct Store {
    connection: Mutex<Connection>,
    dimension: usize,
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| i64::try_from(d.as_millis()).unwrap_or(i64::MAX))
}
fn storage<T>(r: rusqlite::Result<T>) -> AppResult<T> {
    r.map_err(AppError::from)
}
/// Meta key present while passages wait to be embedded by a newly configured model.
const REEMBED_KEY: &str = "reembed_pending";

/// A vector as the store keeps it: little-endian `f32`s.
fn to_blob(vector: &[f32]) -> Vec<u8> {
    vector.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Thread-safe SQLite persistence for knowledge, documents, passages, and agents.
///
/// # Errors
/// Public operations return storage, validation, or not-found errors when they cannot complete.
impl Store {
    fn conn(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::new(ErrorKind::Storage, "database lock poisoned"))
    }
    /// Opens the database, initializes sqlite-vector, and recovers interrupted imports.
    /// Passages embedded by another model (or size) than `model`/`dimension` are kept
    /// and queued for re-embedding ([`Store::reembed_pending`]); their documents are
    /// `processing` (out of search) until [`Store::reembed_finish`].
    pub fn open(
        db_path: &Path,
        vector_extension: &Path,
        dimension: usize,
        model: &str,
    ) -> AppResult<Self> {
        let c = storage(Connection::open(db_path))?;
        storage(c.pragma_update(None, "foreign_keys", "ON"))?;
        storage(c.pragma_update(None, "journal_mode", "WAL"))?;
        storage(c.execute_batch(include_str!("schema.sql")))?;
        let has_language: bool = storage(c.query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('agents') WHERE name='language')",
            [],
            |row| row.get(0),
        ))?;
        if has_language {
            storage(c.execute("ALTER TABLE agents DROP COLUMN language", []))?;
        }
        let ext = vector_extension.to_string_lossy();
        // SAFETY: loading is enabled only for this one call to the vendored
        // sqlite-vector build shipped with the app, then disabled again before any
        // other SQL runs, so no attacker-controlled SQL can load a library.
        let loaded = unsafe {
            c.load_extension_enable()
                .and_then(|()| c.load_extension(&*ext, Some("sqlite3_vector_init")))
        };
        storage(c.load_extension_disable())?;
        storage(loaded)?;
        storage(c.query_row(
            "SELECT vector_init('passages','embedding',?1)",
            [format!(
                "type=FLOAT32,dimension={dimension},distance=COSINE"
            )],
            |_| Ok(()),
        ))?;
        let meta = |key: &str| -> AppResult<Option<String>> {
            storage(
                c.query_row("SELECT value FROM meta WHERE key=?1", [key], |r| r.get(0))
                    .optional(),
            )
        };
        let reembedding = meta(REEMBED_KEY)?.is_some();
        // Imports cut off by a quit; documents waiting for re-embedding are resumed instead.
        storage(c.execute(
            if reembedding {
                "UPDATE documents SET status='failed', error='import interrupted' WHERE status='queued'"
            } else {
                "UPDATE documents SET status='failed', error='import interrupted' WHERE status IN ('queued','processing')"
            },
            [],
        ))?;
        // Databases from before the model was recorded used EmbeddingGemma.
        let stored_model = meta("embedding_model")?;
        let stored_dim = meta("embedding_dim")?;
        let changed = stored_dim
            .as_deref()
            .is_some_and(|d| d != dimension.to_string())
            || stored_model.as_deref().is_none_or(|m| m != model);
        let has_passages: bool =
            storage(c.query_row("SELECT EXISTS(SELECT 1 FROM passages)", [], |r| r.get(0)))?;
        if changed && has_passages {
            storage(c.execute(
                "UPDATE documents SET status='processing', error=NULL
                 WHERE status='ready' AND id IN (SELECT document_id FROM passages)",
                [],
            ))?;
            storage(c.execute(
                "INSERT OR REPLACE INTO meta(key,value) VALUES(?1,'1')",
                [REEMBED_KEY],
            ))?;
            tracing::info!("embedding model changed; documents will be re-embedded");
        }
        storage(c.execute(
            "INSERT OR REPLACE INTO meta(key,value) VALUES('embedding_dim',?1),('embedding_model',?2)",
            params![dimension.to_string(), model],
        ))?;
        Ok(Self {
            connection: Mutex::new(c),
            dimension,
        })
    }
    /// Passages (id, text) waiting to be embedded again after a model change; empty
    /// when none are.
    pub fn reembed_pending(&self) -> AppResult<Vec<(i64, String)>> {
        let c = self.conn()?;
        let pending: bool = storage(c.query_row(
            "SELECT EXISTS(SELECT 1 FROM meta WHERE key=?1)",
            [REEMBED_KEY],
            |r| r.get(0),
        ))?;
        if !pending {
            return Ok(Vec::new());
        }
        let mut st = storage(c.prepare(
            "SELECT p.id,p.text FROM passages p JOIN documents d ON d.id=p.document_id
             WHERE d.status='processing' ORDER BY p.id",
        ))?;
        let rows = storage(st.query_map([], |r| Ok((r.get(0)?, r.get(1)?))))?;
        rows.map(storage).collect()
    }
    /// Replaces passages' embeddings (passage id, vector of the store's dimension).
    pub fn reembed_store(&self, vectors: &[(i64, Vec<f32>)]) -> AppResult<()> {
        if vectors.iter().any(|(_, v)| v.len() != self.dimension) {
            return Err(AppError::invalid("passage embedding dimension mismatch"));
        }
        let mut c = self.conn()?;
        let tx = storage(c.transaction())?;
        {
            let mut st = storage(tx.prepare("UPDATE passages SET embedding=?1 WHERE id=?2"))?;
            for (id, vector) in vectors {
                storage(st.execute(params![to_blob(vector), id]))?;
            }
        }
        storage(tx.commit())
    }
    /// Ends re-embedding: `None` makes the waiting documents searchable again,
    /// `Some(error)` marks them failed with it. Returns the documents changed.
    pub fn reembed_finish(&self, error: Option<&str>) -> AppResult<Vec<Document>> {
        let mut c = self.conn()?;
        let tx = storage(c.transaction())?;
        let ids: Vec<DocumentId> = {
            let mut st = storage(tx.prepare(
                "SELECT id FROM documents WHERE status='processing'
                 AND id IN (SELECT document_id FROM passages)",
            ))?;
            let rows = storage(st.query_map([], |r| r.get(0)))?;
            rows.map(storage).collect::<AppResult<_>>()?
        };
        for id in &ids {
            storage(tx.execute(
                "UPDATE documents SET status=?1, error=?2 WHERE id=?3",
                params![if error.is_some() { "failed" } else { "ready" }, error, id],
            ))?;
        }
        storage(tx.execute("DELETE FROM meta WHERE key=?1", [REEMBED_KEY]))?;
        storage(tx.commit())?;
        ids.into_iter().map(|id| Self::doc_row(&c, id)).collect()
    }
    /// Returns sqlite-vector's version.
    pub fn vector_version(&self) -> AppResult<String> {
        storage(
            self.conn()?
                .query_row("SELECT vector_version()", [], |r| r.get(0)),
        )
    }
    fn kb_row(c: &Connection, id: KnowledgeBaseId) -> AppResult<KnowledgeBase> {
        storage(c.query_row("SELECT k.id,k.name,k.created_at,COALESCE(d.document_count,0),COALESCE(p.passage_count,0),COALESCE(d.inflight,0),COALESCE(d.ready,0),COALESCE(d.failed,0) FROM knowledge_bases k LEFT JOIN (SELECT knowledge_base_id,COUNT(*) AS document_count,COALESCE(SUM(status IN ('queued','processing')),0) AS inflight,COALESCE(SUM(status='ready'),0) AS ready,COALESCE(SUM(status='failed'),0) AS failed FROM documents GROUP BY knowledge_base_id) d ON d.knowledge_base_id=k.id LEFT JOIN (SELECT d.knowledge_base_id,COUNT(p.id) AS passage_count FROM documents d LEFT JOIN passages p ON p.document_id=d.id GROUP BY d.knowledge_base_id) p ON p.knowledge_base_id=k.id WHERE k.id=?1",[id],|r| { let inflight:i64=r.get(5)?;let ready:i64=r.get(6)?;let docs:i64=r.get(3)?;Ok(KnowledgeBase{id:r.get(0)?,name:r.get(1)?,created_at:r.get(2)?,document_count:u32::try_from(docs).unwrap_or(u32::MAX),passage_count:u32::try_from(r.get::<_,i64>(4)?).unwrap_or(u32::MAX),status:if inflight>0{KnowledgeBaseStatus::Processing}else if ready>0{KnowledgeBaseStatus::Ready}else if docs==0{KnowledgeBaseStatus::Empty}else{KnowledgeBaseStatus::Failed}})}))
    }
    /// Lists knowledge bases in creation order.
    pub fn kb_list(&self) -> AppResult<Vec<KnowledgeBase>> {
        let c = self.conn()?;
        let mut q = storage(c.prepare("SELECT id FROM knowledge_bases ORDER BY created_at,id"))?;
        let ids = storage(q.query_map([], |r| r.get::<_, KnowledgeBaseId>(0)))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::from)?;
        ids.into_iter().map(|id| Self::kb_row(&c, id)).collect()
    }
    pub fn kb_get(&self, id: KnowledgeBaseId) -> AppResult<KnowledgeBase> {
        let c = self.conn()?;
        Self::kb_row(&c, id)
    }
    pub fn kb_create(&self, name: &str) -> AppResult<KnowledgeBase> {
        let n = name.trim();
        if n.is_empty() {
            return Err(AppError::invalid("knowledge base name must not be empty"));
        }
        let c = self.conn()?;
        storage(c.execute(
            "INSERT INTO knowledge_bases(name,created_at) VALUES(?1,?2)",
            params![n, now()],
        ))?;
        Self::kb_row(&c, KnowledgeBaseId(c.last_insert_rowid()))
    }
    pub fn kb_rename(&self, id: KnowledgeBaseId, name: &str) -> AppResult<KnowledgeBase> {
        let n = name.trim();
        if n.is_empty() {
            return Err(AppError::invalid("knowledge base name must not be empty"));
        }
        let c = self.conn()?;
        if storage(c.execute(
            "UPDATE knowledge_bases SET name=?1 WHERE id=?2",
            params![n, id],
        ))? == 0
        {
            return Err(AppError::not_found("knowledge base"));
        }
        Self::kb_row(&c, id)
    }
    pub fn kb_delete(&self, id: KnowledgeBaseId) -> AppResult<()> {
        let c = self.conn()?;
        if storage(c.execute("DELETE FROM knowledge_bases WHERE id=?1", [id]))? == 0 {
            return Err(AppError::not_found("knowledge base"));
        }
        Ok(())
    }
    fn doc_row(c: &Connection, id: DocumentId) -> AppResult<Document> {
        storage(c.query_row("SELECT d.id,d.knowledge_base_id,d.file_name,d.kind,d.page_count,(SELECT COUNT(*) FROM passages p WHERE p.document_id=d.id),d.status,d.error,d.created_at FROM documents d WHERE id=?1",[id],|r| { let kind:String=r.get(3)?;let status:String=r.get(6)?;Ok(Document{id:r.get(0)?,knowledge_base_id:r.get(1)?,file_name:r.get(2)?,kind:DocumentKind::parse(&kind).ok_or_else(||rusqlite::Error::FromSqlConversionFailure(3,rusqlite::types::Type::Text,Box::new(std::io::Error::other(format!("unknown document kind: {kind}")))))?,page_count:r.get::<_,Option<u32>>(4)?,passage_count:u32::try_from(r.get::<_,i64>(5)?).unwrap_or(u32::MAX),status:DocumentStatus::parse(&status).ok_or_else(||rusqlite::Error::FromSqlConversionFailure(6,rusqlite::types::Type::Text,Box::new(std::io::Error::other(format!("unknown document status: {status}")))))?,error:r.get(7)?,created_at:r.get(8)?})}))
    }
    pub fn doc_list(&self, kb: KnowledgeBaseId) -> AppResult<Vec<Document>> {
        let c = self.conn()?;
        let mut s = storage(c.prepare(
            "SELECT id FROM documents WHERE knowledge_base_id=?1 ORDER BY created_at,id",
        ))?;
        let ids = storage(s.query_map([kb], |r| r.get::<_, DocumentId>(0)))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::from)?;
        ids.into_iter().map(|id| Self::doc_row(&c, id)).collect()
    }
    pub fn doc_get(&self, id: DocumentId) -> AppResult<Document> {
        let c = self.conn()?;
        Self::doc_row(&c, id)
    }
    pub fn doc_create(
        &self,
        kb: KnowledgeBaseId,
        file_name: &str,
        kind: DocumentKind,
        fingerprint: &str,
    ) -> AppResult<Document> {
        let c = self.conn()?;
        let exists: i64 = storage(c.query_row(
            "SELECT count(*) FROM knowledge_bases WHERE id=?1",
            [kb],
            |r| r.get(0),
        ))?;
        if exists == 0 {
            return Err(AppError::not_found("knowledge base"));
        }
        if let Some(name) = storage(
            c.query_row(
                "SELECT file_name FROM documents WHERE knowledge_base_id=?1 AND fingerprint=?2",
                params![kb, fingerprint],
                |r| r.get::<_, String>(0),
            )
            .optional(),
        )? {
            return Err(AppError::new(
                ErrorKind::Duplicate,
                format!("{} is already in this knowledge base", name),
            ));
        }
        storage(c.execute("INSERT INTO documents(knowledge_base_id,file_name,kind,status,fingerprint,created_at) VALUES(?1,?2,?3,'queued',?4,?5)",params![kb,file_name,kind.as_str(),fingerprint,now()]))?;
        Self::doc_row(&c, DocumentId(c.last_insert_rowid()))
    }
    pub fn doc_set_status(
        &self,
        id: DocumentId,
        status: DocumentStatus,
        error: Option<&str>,
    ) -> AppResult<Document> {
        let c = self.conn()?;
        if storage(c.execute(
            "UPDATE documents SET status=?1,error=?2 WHERE id=?3",
            params![status.as_str(), error, id],
        ))? == 0
        {
            return Err(AppError::not_found("document"));
        }
        Self::doc_row(&c, id)
    }
    pub fn doc_store_passages(
        &self,
        id: DocumentId,
        page_count: Option<u32>,
        passages: &[NewPassage],
    ) -> AppResult<Document> {
        if passages.iter().any(|p| p.embedding.len() != self.dimension) {
            return Err(AppError::invalid("passage embedding dimension mismatch"));
        }
        let mut c = self.conn()?;
        let tx = storage(c.transaction())?;
        if storage(tx.execute("DELETE FROM passages WHERE document_id=?1", [id]))?.eq(&0) {
            let exists: i64 = storage(tx.query_row(
                "SELECT count(*) FROM documents WHERE id=?1",
                [id],
                |r| r.get(0),
            ))?;
            if exists == 0 {
                return Err(AppError::not_found("document"));
            }
        }
        {
            let mut st=storage(tx.prepare("INSERT INTO passages(document_id,text,location,token_count,embedding) VALUES(?1,?2,?3,?4,?5)"))?;
            for p in passages {
                storage(st.execute(params![
                    id,
                    p.text,
                    p.location,
                    p.token_count,
                    to_blob(&p.embedding)
                ]))?;
            }
        }
        storage(tx.execute(
            "UPDATE documents SET status='ready',error=NULL,page_count=?1 WHERE id=?2",
            params![page_count, id],
        ))?;
        storage(tx.commit())?;
        Self::doc_row(&c, id)
    }
    pub fn doc_delete(&self, id: DocumentId) -> AppResult<()> {
        let c = self.conn()?;
        if storage(c.execute("DELETE FROM documents WHERE id=?1", [id]))? == 0 {
            return Err(AppError::not_found("document"));
        }
        Ok(())
    }
    pub fn search(
        &self,
        kbs: &[KnowledgeBaseId],
        query: &[f32],
        k: usize,
    ) -> AppResult<Vec<PassageHit>> {
        if kbs.is_empty() {
            return Ok(vec![]);
        }
        if query.len() != self.dimension {
            return Err(AppError::invalid("query embedding dimension mismatch"));
        }
        let mut blob = Vec::with_capacity(query.len() * 4);
        for f in query {
            blob.extend_from_slice(&f.to_le_bytes())
        }
        let marks = vec!["?"; kbs.len()].join(",");
        let sql = format!(
            "SELECT p.id,p.document_id,d.file_name,p.location,p.text,v.distance FROM vector_full_scan('passages','embedding',?1) v JOIN passages p ON p.id=v.rowid JOIN documents d ON d.id=p.document_id WHERE d.knowledge_base_id IN ({marks}) AND d.status='ready' ORDER BY v.distance LIMIT ?{}",
            kbs.len() + 2
        );
        let c = self.conn()?;
        let mut st = storage(c.prepare(&sql))?;
        let mut vals = vec![rusqlite::types::Value::Blob(blob)];
        vals.extend(kbs.iter().map(|x| rusqlite::types::Value::Integer(x.0)));
        vals.push(rusqlite::types::Value::Integer(
            i64::try_from(k).unwrap_or(i64::MAX),
        ));
        let rows = storage(st.query_map(rusqlite::params_from_iter(vals), |r| {
            Ok(PassageHit {
                passage_id: r.get(0)?,
                document_id: r.get(1)?,
                document_name: r.get(2)?,
                location: r.get(3)?,
                text: r.get(4)?,
                distance: r.get(5)?,
            })
        }))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }
    pub fn passage_count(&self, kbs: &[KnowledgeBaseId]) -> AppResult<u32> {
        if kbs.is_empty() {
            return Ok(0);
        }
        let marks = vec!["?"; kbs.len()].join(",");
        let sql = format!(
            "SELECT COUNT(*) FROM passages p JOIN documents d ON d.id=p.document_id WHERE d.knowledge_base_id IN ({marks}) AND d.status='ready'"
        );
        let c = self.conn()?;
        let n: i64 =
            storage(c.query_row(&sql, rusqlite::params_from_iter(kbs.iter()), |r| r.get(0)))?;
        Ok(u32::try_from(n).unwrap_or(u32::MAX))
    }
    fn agent_row(c: &Connection, id: AgentId) -> AppResult<Agent> {
        let mut agent = storage(c.query_row(
            "SELECT id,name,description,instructions,base_rules,answer_length,
                    voice_id,speech_rate,template_id,created_at,updated_at
             FROM agents WHERE id=?1",
            [id],
            |r| {
                let draft = AgentDraft {
                    name: r.get(1)?,
                    description: r.get(2)?,
                    instructions: r.get(3)?,
                    base_rules: if r.get::<_, String>(4)? == "replace" {
                        BaseRulesMode::Replace
                    } else {
                        BaseRulesMode::Include
                    },
                    knowledge_base_ids: Vec::new(),
                    answer_length: if r.get::<_, String>(5)? == "short" {
                        AnswerLength::Short
                    } else {
                        AnswerLength::Normal
                    },
                    voice_id: r.get(6)?,
                    speech_rate: r.get(7)?,
                };
                Ok(Agent {
                    id: r.get(0)?,
                    draft,
                    template_id: r
                        .get::<_, Option<String>>(8)?
                        .and_then(|s| TemplateId::parse(&s)),
                    created_at: r.get(9)?,
                    updated_at: r.get(10)?,
                })
            },
        ))?;
        let mut stmt = storage(
            c.prepare("SELECT knowledge_base_id FROM agent_knowledge_bases WHERE agent_id=?1"),
        )?;
        agent.draft.knowledge_base_ids = storage(
            stmt.query_map([id], |r| r.get(0))?
                .collect::<Result<Vec<_>, _>>(),
        )?;
        Ok(agent)
    }
    fn validate_draft(c: &Connection, d: &AgentDraft) -> AppResult<Vec<KnowledgeBaseId>> {
        if d.name.trim().is_empty() {
            return Err(AppError::invalid("agent name must not be empty"));
        }
        if !(0.5..=2.0).contains(&d.speech_rate) {
            return Err(AppError::invalid("speech rate must be between 0.5 and 2.0"));
        }
        let mut ids = d.knowledge_base_ids.clone();
        ids.sort();
        ids.dedup();
        if ids.len() > MAX_AGENT_KNOWLEDGE_BASES {
            return Err(AppError::invalid(
                "agent may attach at most five knowledge bases",
            ));
        }
        for id in &ids {
            let n: i64 = storage(c.query_row(
                "SELECT count(*) FROM knowledge_bases WHERE id=?1",
                [id],
                |r| r.get(0),
            ))?;
            if n == 0 {
                return Err(AppError::not_found("knowledge base"));
            }
        }
        Ok(ids)
    }
    fn save_links(c: &Connection, id: AgentId, ids: &[KnowledgeBaseId]) -> AppResult<()> {
        storage(c.execute("DELETE FROM agent_knowledge_bases WHERE agent_id=?1", [id]))?;
        for kb in ids {
            storage(c.execute(
                "INSERT INTO agent_knowledge_bases(agent_id,knowledge_base_id) VALUES(?1,?2)",
                params![id, kb],
            ))?;
        }
        Ok(())
    }
    fn insert_agent(
        c: &Connection,
        d: &AgentDraft,
        t: Option<TemplateId>,
        created: i64,
    ) -> AppResult<Agent> {
        let ids = Self::validate_draft(c, d)?;
        storage(c.execute("INSERT INTO agents(name,description,instructions,base_rules,answer_length,voice_id,speech_rate,template_id,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",params![d.name.trim(),d.description,d.instructions,if d.base_rules==BaseRulesMode::Include{"include"}else{"replace"},match d.answer_length{AnswerLength::Short=>"short",AnswerLength::Normal=>"normal"},d.voice_id,d.speech_rate,t.map(TemplateId::as_str),created]))?;
        let id = AgentId(c.last_insert_rowid());
        Self::save_links(c, id, &ids)?;
        let active: Option<Option<i64>> = storage(
            c.query_row("SELECT active_agent_id FROM settings WHERE id=1", [], |r| {
                r.get::<_, Option<i64>>(0)
            })
            .optional(),
        )?;
        if active.flatten().is_none() {
            storage(c.execute("INSERT INTO settings(id,active_agent_id) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET active_agent_id=excluded.active_agent_id",[id.0]))?;
        }
        Self::agent_row(c, id)
    }
    pub fn agent_list(&self) -> AppResult<Vec<Agent>> {
        let c = self.conn()?;
        let mut s = storage(c.prepare("SELECT id FROM agents ORDER BY updated_at DESC,id"))?;
        let ids = storage(s.query_map([], |r| r.get::<_, AgentId>(0)))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::from)?;
        ids.into_iter().map(|id| Self::agent_row(&c, id)).collect()
    }
    pub fn agent_get(&self, id: AgentId) -> AppResult<Agent> {
        let c = self.conn()?;
        Self::agent_row(&c, id)
    }
    pub fn agent_create(
        &self,
        draft: &AgentDraft,
        template: Option<TemplateId>,
    ) -> AppResult<Agent> {
        let c = self.conn()?;
        let tx = storage(c.unchecked_transaction())?;
        let a = Self::insert_agent(&tx, draft, template, now())?;
        storage(tx.commit())?;
        Ok(a)
    }
    pub fn agent_update(&self, id: AgentId, d: &AgentDraft) -> AppResult<Agent> {
        let c = self.conn()?;
        let ids = Self::validate_draft(&c, d)?;
        if storage(c.execute("UPDATE agents SET name=?1,description=?2,instructions=?3,base_rules=?4,answer_length=?5,voice_id=?6,speech_rate=?7,updated_at=?8 WHERE id=?9",params![d.name.trim(),d.description,d.instructions,if d.base_rules==BaseRulesMode::Include{"include"}else{"replace"},match d.answer_length{AnswerLength::Short=>"short",AnswerLength::Normal=>"normal"},d.voice_id,d.speech_rate,now(),id]))?==0{return Err(AppError::not_found("agent"))}
        Self::save_links(&c, id, &ids)?;
        Self::agent_row(&c, id)
    }
    pub fn agent_duplicate(&self, id: AgentId) -> AppResult<Agent> {
        let a = self.agent_get(id)?;
        let mut d = a.draft;
        d.name = format!("{} copy", d.name);
        self.agent_create(&d, a.template_id)
    }
    pub fn agent_delete(&self, id: AgentId) -> AppResult<()> {
        let c = self.conn()?;
        let tx = storage(c.unchecked_transaction())?;
        let was_active: bool = storage(
            tx.query_row(
                "SELECT COALESCE(active_agent_id=?1,0) FROM settings WHERE id=1",
                [id.0],
                |r| r.get(0),
            )
            .optional(),
        )?
        .unwrap_or(false);
        if storage(tx.execute("DELETE FROM agents WHERE id=?1", [id]))? == 0 {
            return Err(AppError::not_found("agent"));
        }
        if was_active {
            let next: Option<i64> = storage(
                tx.query_row(
                    "SELECT id FROM agents ORDER BY updated_at DESC,id DESC LIMIT 1",
                    [],
                    |r| r.get(0),
                )
                .optional(),
            )?;
            storage(tx.execute("UPDATE settings SET active_agent_id=?1 WHERE id=1", [next]))?;
        }
        storage(tx.commit())?;
        Ok(())
    }
    pub fn active_agent(&self) -> AppResult<Option<Agent>> {
        let c = self.conn()?;
        let id: Option<Option<i64>> = storage(
            c.query_row("SELECT active_agent_id FROM settings WHERE id=1", [], |r| {
                r.get::<_, Option<i64>>(0)
            })
            .optional(),
        )?;
        match id.flatten() {
            Some(v) => match Self::agent_row(&c, AgentId(v)) {
                Ok(agent) => Ok(Some(agent)),
                Err(error) if error.kind == ErrorKind::NotFound => Ok(None),
                Err(error) => Err(error),
            },
            None => Ok(None),
        }
    }
    pub fn set_active_agent(&self, id: AgentId) -> AppResult<Agent> {
        let c = self.conn()?;
        let a = Self::agent_row(&c, id)?;
        storage(c.execute("INSERT INTO settings(id,active_agent_id) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET active_agent_id=excluded.active_agent_id",[id.0]))?;
        Ok(a)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn extension() -> &'static Path {
        #[cfg(target_os = "macos")]
        {
            Path::new(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/vendor/sqlite-vector/macos-arm64/vector.dylib"
            ))
        }
        #[cfg(target_os = "windows")]
        {
            Path::new(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/vendor/sqlite-vector/windows-x86_64/vector.dll"
            ))
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            Path::new("unsupported-platform")
        }
    }
    fn store(dir: &Path) -> Store {
        Store::open(&dir.join("db.sqlite"), extension(), 4, "model-a").expect("store opens")
    }
    fn draft(name: &str, knowledge_base_ids: Vec<KnowledgeBaseId>) -> AgentDraft {
        AgentDraft {
            name: name.into(),
            description: String::new(),
            instructions: String::new(),
            base_rules: BaseRulesMode::Include,
            knowledge_base_ids,
            answer_length: AnswerLength::Normal,
            voice_id: None,
            speech_rate: 1.0,
        }
    }
    fn passage(text: &str, embedding: [f32; 4]) -> NewPassage {
        NewPassage {
            text: text.into(),
            location: "1".into(),
            token_count: 1,
            embedding: embedding.to_vec(),
        }
    }
    #[test]
    fn opens_legacy_agent_schema_and_preserves_unknown_template_id() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("db.sqlite");
        let connection = Connection::open(&db_path).expect("legacy database opens");
        connection
            .execute_batch(
                "CREATE TABLE agents (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
                    instructions TEXT NOT NULL, base_rules TEXT NOT NULL, language TEXT NOT NULL,
                    answer_length TEXT NOT NULL, voice_id TEXT, speech_rate REAL NOT NULL,
                    template_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
                );",
            )
            .expect("legacy schema created");
        connection
            .execute(
                "INSERT INTO agents VALUES (
                    1,'Legacy','description','instructions','include','taglish',
                    'normal',NULL,1.0,'taglishExplainer',10,20
                )",
                [],
            )
            .expect("legacy agent created");
        drop(connection);

        let store =
            Store::open(&db_path, extension(), 4, "model-a").expect("legacy database migrates");
        let agent = store.agent_get(AgentId(1)).expect("legacy agent loads");
        assert_eq!(agent.draft.name, "Legacy");
        assert_eq!(agent.template_id, None);
    }
    #[test]
    fn search_returns_nearest_first_only_from_requested_kbs() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let a = s.kb_create("a").expect("kb");
        let b = s.kb_create("b").expect("kb");
        let d = s
            .doc_create(a.id, "a", DocumentKind::Text, "a")
            .expect("doc");
        s.doc_store_passages(
            d.id,
            None,
            &[
                passage("near", [1., 0., 0., 0.]),
                passage("far", [0., 1., 0., 0.]),
            ],
        )
        .expect("store");
        let e = s
            .doc_create(b.id, "b", DocumentKind::Text, "b")
            .expect("doc");
        s.doc_store_passages(e.id, None, &[passage("other", [1., 0., 0., 0.])])
            .expect("store");
        let hits = s.search(&[a.id], &[1., 0., 0., 0.], 5).expect("search");
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].text, "near");
    }
    #[test]
    fn search_excludes_non_ready_document_passages() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let kb = s.kb_create("kb").expect("kb");
        let d = s
            .doc_create(kb.id, "x", DocumentKind::Text, "x")
            .expect("doc");
        s.doc_store_passages(d.id, None, &[passage("hidden", [1., 0., 0., 0.])])
            .expect("store");
        s.doc_set_status(d.id, DocumentStatus::Failed, Some("failed"))
            .expect("status");
        assert!(
            s.search(&[kb.id], &[1., 0., 0., 0.], 5)
                .expect("search")
                .is_empty()
        );
    }
    #[test]
    fn fingerprints_are_unique_per_knowledge_base() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let a = s.kb_create("a").expect("kb");
        let b = s.kb_create("b").expect("kb");
        s.doc_create(a.id, "one", DocumentKind::Text, "same")
            .expect("doc");
        assert_eq!(
            s.doc_create(a.id, "two", DocumentKind::Text, "same")
                .expect_err("duplicate")
                .kind,
            ErrorKind::Duplicate
        );
        s.doc_create(b.id, "two", DocumentKind::Text, "same")
            .expect("other kb accepted");
    }
    #[test]
    fn deleting_kb_cascades_passages_and_agent_links() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let kb = s.kb_create("kb").expect("kb");
        let d = s
            .doc_create(kb.id, "x", DocumentKind::Text, "x")
            .expect("doc");
        s.doc_store_passages(d.id, None, &[passage("text", [1., 0., 0., 0.])])
            .expect("passage");
        let a = s
            .agent_create(&draft("a", vec![kb.id]), None)
            .expect("agent");
        s.kb_delete(kb.id).expect("delete");
        assert!(
            s.search(&[kb.id], &[1., 0., 0., 0.], 5)
                .expect("search")
                .is_empty()
        );
        assert!(
            !s.agent_get(a.id)
                .expect("agent")
                .draft
                .knowledge_base_ids
                .contains(&kb.id)
        );
    }
    #[test]
    fn agent_kb_limit_and_duplicate_ids() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let ids = (0..6)
            .map(|i| s.kb_create(&format!("kb{i}")).expect("kb").id)
            .collect::<Vec<_>>();
        assert_eq!(
            s.agent_create(&draft("too many", ids.clone()), None)
                .expect_err("limit")
                .kind,
            ErrorKind::Invalid
        );
        let agent = s
            .agent_create(&draft("dedupe", vec![ids[0], ids[0]]), None)
            .expect("deduped");
        assert_eq!(agent.draft.knowledge_base_ids, vec![ids[0]]);
    }
    #[test]
    fn active_agent_is_promoted_on_delete_and_cleared_at_last_delete() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let a = s.agent_create(&draft("a", vec![]), None).expect("agent");
        assert_eq!(s.active_agent().expect("active").expect("first").id, a.id);
        let b = s.agent_create(&draft("b", vec![]), None).expect("agent");
        s.set_active_agent(a.id).expect("activate");
        s.agent_delete(a.id).expect("delete");
        assert_eq!(
            s.active_agent().expect("active").expect("promoted").id,
            b.id
        );
        s.agent_delete(b.id).expect("delete last");
        assert!(s.active_agent().expect("active").is_none());
    }
    #[test]
    fn reopening_marks_interrupted_imports_failed() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let kb = s.kb_create("kb").expect("kb");
        let a = s
            .doc_create(kb.id, "queued", DocumentKind::Text, "q")
            .expect("doc");
        let b = s
            .doc_create(kb.id, "processing", DocumentKind::Text, "p")
            .expect("doc");
        s.doc_set_status(b.id, DocumentStatus::Processing, None)
            .expect("status");
        drop(s);
        let s = store(dir.path());
        for id in [a.id, b.id] {
            let d = s.doc_get(id).expect("doc");
            assert_eq!(d.status, DocumentStatus::Failed);
            assert_eq!(d.error.as_deref(), Some("import interrupted"));
        }
    }
    #[test]
    fn knowledge_base_status_tracks_documents_and_passages() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let kb = s.kb_create("kb").expect("kb");
        assert_eq!(kb.status, KnowledgeBaseStatus::Empty);
        let d = s
            .doc_create(kb.id, "x", DocumentKind::Text, "x")
            .expect("doc");
        assert_eq!(
            s.kb_get(kb.id).expect("kb").status,
            KnowledgeBaseStatus::Processing
        );
        s.doc_store_passages(d.id, None, &[passage("ready", [1., 0., 0., 0.])])
            .expect("passage");
        assert_eq!(
            s.kb_get(kb.id).expect("kb").status,
            KnowledgeBaseStatus::Ready
        );
        s.doc_set_status(d.id, DocumentStatus::Failed, Some("failed"))
            .expect("status");
        assert_eq!(
            s.kb_get(kb.id).expect("kb").status,
            KnowledgeBaseStatus::Failed
        );
    }
    #[test]
    fn agent_duplicate_copies_links_and_appends_copy() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let kb = s.kb_create("kb").expect("kb");
        let a = s
            .agent_create(&draft("source", vec![kb.id]), None)
            .expect("agent");
        let copy = s.agent_duplicate(a.id).expect("duplicate");
        assert_eq!(copy.draft.name, "source copy");
        assert_eq!(copy.draft.knowledge_base_ids, vec![kb.id]);
    }
    #[test]
    fn rejects_wrong_embedding_length() {
        let dir = tempfile::tempdir().expect("tempdir");
        let s = store(dir.path());
        let kb = s.kb_create("kb").expect("kb");
        let doc = s
            .doc_create(kb.id, "file.txt", DocumentKind::Text, "fp")
            .expect("doc");
        let result = s.doc_store_passages(
            doc.id,
            None,
            &[NewPassage {
                text: "x".into(),
                location: "1".into(),
                token_count: 1,
                embedding: vec![1.0],
            }],
        );
        assert_eq!(
            result.expect_err("mismatched vector rejected").kind,
            ErrorKind::Invalid
        );
    }
    #[test]
    fn a_new_embedding_model_re_embeds_kept_passages() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("db.sqlite");
        let first = store(dir.path());
        let kb = first.kb_create("k").expect("kb");
        let doc = first
            .doc_create(kb.id, "manual", DocumentKind::Text, "f")
            .expect("doc");
        first
            .doc_store_passages(
                doc.id,
                None,
                &[NewPassage {
                    text: "Enter grades in Q1.".into(),
                    location: "p. 1".into(),
                    token_count: 4,
                    embedding: vec![1.0, 0.0, 0.0, 0.0],
                }],
            )
            .expect("passages");
        drop(first);

        // Same model: nothing to do.
        let same = Store::open(&path, extension(), 4, "model-a").expect("reopens");
        assert!(same.reembed_pending().expect("pending").is_empty());
        drop(same);

        // Another model and size: kept, out of search until re-embedded.
        let next = Store::open(&path, extension(), 3, "model-b").expect("reopens");
        assert_eq!(
            next.doc_get(doc.id).expect("doc").status,
            DocumentStatus::Processing
        );
        assert!(
            next.search(&[kb.id], &[1.0, 0.0, 0.0], 5)
                .expect("search")
                .is_empty()
        );
        let pending = next.reembed_pending().expect("pending");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].1, "Enter grades in Q1.");
        drop(next);

        // A quit before finishing resumes rather than failing the document.
        let resumed = Store::open(&path, extension(), 3, "model-b").expect("reopens");
        let pending = resumed.reembed_pending().expect("still pending");
        assert_eq!(pending.len(), 1);
        resumed
            .reembed_store(&[(pending[0].0, vec![0.0, 1.0, 0.0])])
            .expect("stored");
        let changed = resumed.reembed_finish(None).expect("finished");
        assert_eq!(changed.len(), 1);
        assert_eq!(changed[0].status, DocumentStatus::Ready);
        let hits = resumed
            .search(&[kb.id], &[0.0, 1.0, 0.0], 5)
            .expect("search");
        assert_eq!(hits.len(), 1);
        assert!(resumed.reembed_pending().expect("done").is_empty());
    }
}
