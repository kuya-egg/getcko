//! Types shared between the Rust core and the React client.
//!
//! Every type here crosses the Tauri IPC boundary. `cargo test` regenerates the
//! TypeScript mirror in `src/bindings/` (ts-rs), so the client never hand-writes
//! these shapes. Field names are camelCase on the wire.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

macro_rules! sql_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
        #[ts(export)]
        pub struct $name(#[ts(type = "number")] pub i64);

        impl rusqlite::ToSql for $name {
            fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
                self.0.to_sql()
            }
        }

        impl rusqlite::types::FromSql for $name {
            fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
                i64::column_result(value).map(Self)
            }
        }
    };
}

sql_id!(
    /// A knowledge base row.
    KnowledgeBaseId
);
sql_id!(
    /// A document row.
    DocumentId
);
sql_id!(
    /// A passage row; also the rowid sqlite-vector returns.
    PassageId
);
sql_id!(
    /// An agent row.
    AgentId
);

/// One question/answer turn. Monotonic per app run; never persisted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TurnId(pub u32);

// ---------------------------------------------------------------------------
// Knowledge

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum KnowledgeBaseStatus {
    /// No documents yet.
    Empty,
    /// At least one document is queued or processing.
    Processing,
    /// Nothing in flight and at least one document is ready.
    Ready,
    /// Every document failed.
    Failed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct KnowledgeBase {
    pub id: KnowledgeBaseId,
    pub name: String,
    pub status: KnowledgeBaseStatus,
    pub document_count: u32,
    pub passage_count: u32,
    /// Unix milliseconds.
    #[ts(type = "number")]
    pub created_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum DocumentKind {
    Markdown,
    Text,
    Pdf,
    Docx,
    Pptx,
}

impl DocumentKind {
    /// Kind from a file extension (case-insensitive), `None` when unsupported.
    #[must_use]
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_ascii_lowercase().as_str() {
            "md" | "markdown" => Some(Self::Markdown),
            "txt" => Some(Self::Text),
            "pdf" => Some(Self::Pdf),
            "docx" => Some(Self::Docx),
            "pptx" => Some(Self::Pptx),
            _ => None,
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Markdown => "markdown",
            Self::Text => "text",
            Self::Pdf => "pdf",
            Self::Docx => "docx",
            Self::Pptx => "pptx",
        }
    }

    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "markdown" => Self::Markdown,
            "text" => Self::Text,
            "pdf" => Self::Pdf,
            "docx" => Self::Docx,
            "pptx" => Self::Pptx,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum DocumentStatus {
    Queued,
    Processing,
    Ready,
    Failed,
}

impl DocumentStatus {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Processing => "processing",
            Self::Ready => "ready",
            Self::Failed => "failed",
        }
    }

    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "queued" => Self::Queued,
            "processing" => Self::Processing,
            "ready" => Self::Ready,
            "failed" => Self::Failed,
            _ => return None,
        })
    }
}

/// Emitted on [`crate::EVENT_DOCUMENT`] whenever a document changes status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Document {
    pub id: DocumentId,
    pub knowledge_base_id: KnowledgeBaseId,
    pub file_name: String,
    pub kind: DocumentKind,
    pub page_count: Option<u32>,
    pub passage_count: u32,
    pub status: DocumentStatus,
    /// Human-readable reason when `status` is `failed`.
    pub error: Option<String>,
    #[ts(type = "number")]
    pub created_at: i64,
}

// ---------------------------------------------------------------------------
// Agents

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum BaseRulesMode {
    /// Agent instructions are added to GetCko's base rules.
    Include,
    /// Agent instructions replace the base rules (product guarantees still apply).
    Replace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Language {
    English,
    Filipino,
    Taglish,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum AnswerLength {
    Short,
    Normal,
}

/// Editable fields of an agent; the payload for create and update.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct AgentDraft {
    pub name: String,
    pub description: String,
    pub instructions: String,
    pub base_rules: BaseRulesMode,
    /// At most [`MAX_AGENT_KNOWLEDGE_BASES`].
    pub knowledge_base_ids: Vec<KnowledgeBaseId>,
    pub language: Language,
    pub answer_length: AnswerLength,
    /// An id from `voice_list`; `None` uses the system default voice.
    pub voice_id: Option<String>,
    /// 1.0 is normal speed.
    pub speech_rate: f32,
}

/// BR-11: an agent attaches at most this many knowledge bases.
pub const MAX_AGENT_KNOWLEDGE_BASES: usize = 5;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Agent {
    pub id: AgentId,
    #[serde(flatten)]
    #[ts(flatten)]
    pub draft: AgentDraft,
    pub template_id: Option<TemplateId>,
    #[ts(type = "number")]
    pub created_at: i64,
    #[ts(type = "number")]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TemplateId {
    OfficeHelper,
    Teacher,
    StudyBuddy,
    TaglishExplainer,
}

impl TemplateId {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::OfficeHelper => "officeHelper",
            Self::Teacher => "teacher",
            Self::StudyBuddy => "studyBuddy",
            Self::TaglishExplainer => "taglishExplainer",
        }
    }

    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "officeHelper" => Self::OfficeHelper,
            "teacher" => Self::Teacher,
            "studyBuddy" => Self::StudyBuddy,
            "taglishExplainer" => Self::TaglishExplainer,
            _ => return None,
        })
    }
}

/// Built-in, read-only agent blueprint (INV-8).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Template {
    pub id: TemplateId,
    pub draft: AgentDraft,
}

// ---------------------------------------------------------------------------
// Setup and trust

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum PermissionKind {
    /// macOS Accessibility (read other apps' UI elements).
    Accessibility,
    /// macOS Screen Recording (screenshot fallback, P1).
    ScreenRecording,
    Microphone,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum PermissionStatus {
    NotAsked,
    Granted,
    Denied,
    /// The OS has no such gate (e.g. Accessibility on Windows).
    NotRequired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum EngineComponent {
    Chat,
    Embeddings,
    SpeechToText,
    TextToSpeech,
    Microphone,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ComponentStatus {
    pub component: EngineComponent,
    pub ready: bool,
    /// Why it is not ready (missing model file, not built on this OS, ...).
    pub detail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PermissionState {
    pub kind: PermissionKind,
    pub status: PermissionStatus,
}

/// Everything onboarding needs to decide what to show.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SetupStatus {
    pub permissions: Vec<PermissionState>,
    pub components: Vec<ComponentStatus>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Voice {
    pub id: String,
    pub name: String,
    /// BCP-47 tag, e.g. `en-US`, `fil-PH`.
    pub language: String,
}

// ---------------------------------------------------------------------------
// Screen

/// Axis-aligned rectangle. The coordinate space is stated where it is used.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Rect {
    #[must_use]
    pub fn center(&self) -> (f64, f64) {
        (self.x + self.width / 2.0, self.y + self.height / 2.0)
    }
}

/// One UI element of the focused app.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ScreenElement {
    /// Short, snapshot-unique id the model picks by, e.g. `e12`.
    pub id: String,
    /// Normalised role: `button`, `textField`, `cell`, `menuItem`, `link`, ...
    pub role: String,
    pub label: String,
    pub value: Option<String>,
    /// **Desktop physical pixels**, origin at the primary display's top-left —
    /// the same space as Tauri's `Monitor::position()` / `PhysicalPosition`.
    pub bounds: Rect,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ScreenSnapshot {
    pub app_name: String,
    pub window_title: Option<String>,
    pub elements: Vec<ScreenElement>,
}

/// A monitor in desktop physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct MonitorFrame {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

/// Where the overlay should draw the gecko.
///
/// The overlay window covers `monitor` (set it with `PhysicalPosition`/`PhysicalSize`),
/// then draws at `rect`, which is in **CSS pixels relative to that monitor's top-left**.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PointerTarget {
    /// `None` for a tier-3 best-guess point read from a screenshot.
    pub element_id: Option<String>,
    pub label: String,
    pub monitor: MonitorFrame,
    pub rect: Rect,
}

/// How the screen was given to the model for one answer (architecture: three tiers).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ScreenMode {
    /// Accessibility element list only.
    Elements,
    /// Element list plus a screenshot with each element's id drawn on it.
    ElementsWithImage,
    /// Screenshot only; the pointer is a best guess.
    ImageOnly,
}

// ---------------------------------------------------------------------------
// Asking

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
#[ts(export)]
pub enum AskInput {
    Text {
        text: String,
    },
    /// Use the recording started by `ptt_start`.
    Voice,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct AskRequest {
    pub input: AskInput,
    /// Read the focused app and point at an element.
    pub screen_help: bool,
    /// Use this agent instead of the active one ("Try this agent"); nothing is saved.
    pub agent_id: Option<AgentId>,
    /// Earlier steps of a guided task, oldest first; at most MAX_TASK_STEPS - 1.
    #[serde(default)]
    #[ts(optional)]
    pub task: Option<Vec<TaskStep>>,
}

/// Steps a guided task keeps in context, the current one included (PRD S5).
pub const MAX_TASK_STEPS: usize = 5;

/// One earlier step of a guided task, sent back by the client on "next".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TaskStep {
    pub question: String,
    pub answer: String,
    /// Label of the element pointed at in that step, if any.
    pub target_label: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Citation {
    /// The `[n]` marker used in the answer text.
    pub marker: u32,
    pub passage_id: PassageId,
    pub document_id: DocumentId,
    pub document_name: String,
    /// Page (`p. 4`) or heading path.
    pub location: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Confidence {
    Normal,
    /// Answer came from a screenshot instead of the element list (BR-18).
    BestGuess,
}

/// Measured, never estimated (BR-24). Milliseconds.
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Latency {
    pub transcribe_ms: Option<u32>,
    pub screen_ms: Option<u32>,
    /// Screenshot capture and preparation (tiers 2 and 3).
    pub capture_ms: Option<u32>,
    pub retrieval_ms: u32,
    pub first_token_ms: Option<u32>,
    pub total_ms: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Answer {
    pub turn_id: TurnId,
    pub question: String,
    pub text: String,
    pub citations: Vec<Citation>,
    pub target: Option<PointerTarget>,
    pub confidence: Confidence,
    /// `None` when screen help was off.
    pub screen_mode: Option<ScreenMode>,
    pub latency: Latency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TurnPhase {
    Listening,
    Transcribing,
    Thinking,
    Answering,
}

/// Emitted on [`crate::EVENT_TURN`]. A turn ends with exactly one of
/// `finished`, `cancelled` or `failed`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
#[ts(export)]
pub enum TurnEvent {
    Phase {
        turn_id: TurnId,
        phase: TurnPhase,
    },
    /// The question text (typed, or as transcribed).
    Question {
        turn_id: TurnId,
        text: String,
    },
    /// Sent before the first sentence so the gecko can fly while GetCko speaks.
    Target {
        turn_id: TurnId,
        target: Option<PointerTarget>,
    },
    /// One complete sentence, in order; also the unit TTS speaks.
    Sentence {
        turn_id: TurnId,
        text: String,
    },
    Finished {
        answer: Answer,
    },
    Cancelled {
        turn_id: TurnId,
    },
    Failed {
        turn_id: TurnId,
        message: String,
    },
}
