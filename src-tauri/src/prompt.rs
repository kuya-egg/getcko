//! Prompt construction and streaming answer parsing.
use std::collections::HashSet;

use crate::model::{AgentDraft, AnswerLength, BaseRulesMode, Language, ScreenSnapshot};

/// General grounding and answer-quality rules (BR-6).
pub const BASE_RULES: &str = "Be grounded and honest: answer from the supplied screen and passages. If neither supports an answer, say \"I don't know\". Be brief; lead with the action, then the reason, then the source.";
/// Product guarantees that remain in force for every agent configuration.
pub const GUARANTEES: &str = "Never claim a source that is not among the numbered passages (BR-4). Only point to element ids listed in the screen (BR-15). Never offer to click or type for the user (BR-14). Output protocol: first line exactly TARGET: <element id> or TARGET: none (always none with no screen); then answer prose, citing passages inline as [n]. Example: TARGET: e3\\nClick Save [1].";

/// One retrieved passage and its display location.
pub struct RetrievedPassage<'a> {
    pub document_name: &'a str,
    pub location: &'a str,
    pub text: &'a str,
}
/// Inputs used to build one model prompt.
pub struct PromptInput<'a> {
    pub agent: &'a AgentDraft,
    pub question: &'a str,
    pub snapshot: Option<&'a ScreenSnapshot>,
    pub passages: &'a [RetrievedPassage<'a>],
}
/// Complete model prompt and generation budget.
pub struct Prompt {
    pub system: String,
    pub user: String,
    pub max_tokens: u32,
}

/// Builds the system and user prompts without performing I/O.
pub fn build(input: &PromptInput<'_>) -> Prompt {
    let mut system = String::from(GUARANTEES);
    if input.agent.base_rules == BaseRulesMode::Include {
        system.push_str("\n\n");
        system.push_str(BASE_RULES);
    }
    if !input.agent.instructions.is_empty() {
        system.push_str("\n\nAgent instructions: ");
        system.push_str(&input.agent.instructions);
    }
    system.push_str("\n\nLanguage: ");
    system.push_str(match input.agent.language {
        Language::English => "English.",
        Language::Filipino => "Filipino.",
        Language::Taglish => "Taglish: use a natural mix of Filipino and English.",
    });
    let max_tokens = match input.agent.answer_length {
        AnswerLength::Short => {
            system.push_str("\nLength: 1-2 sentences.");
            80
        }
        AnswerLength::Normal => {
            system.push_str("\nLength: up to 4 sentences.");
            160
        }
    };

    let mut user = String::new();
    if let Some(snapshot) = input.snapshot {
        user.push_str("Screen:\nApp: ");
        user.push_str(&snapshot.app_name);
        user.push_str("\nWindow: ");
        user.push_str(snapshot.window_title.as_deref().unwrap_or("(none)"));
        for element in &snapshot.elements {
            user.push('\n');
            user.push_str(&element.id);
            user.push_str(" | ");
            user.push_str(&element.role);
            user.push_str(" | ");
            user.push_str(&truncate_chars(&element.label, 60));
            user.push_str(" | ");
            user.push_str(element.value.as_deref().unwrap_or(""));
        }
    } else {
        user.push_str("(no screen)");
    }
    if input.passages.is_empty() {
        user.push_str("\n\n(no documents)");
    } else {
        user.push_str("\n\nPassages:");
        for (index, passage) in input.passages.iter().enumerate() {
            use std::fmt::Write;
            let _ = write!(
                user,
                "\n[{}] {}, {}: {}",
                index + 1,
                passage.document_name,
                passage.location,
                passage.text
            );
        }
    }
    user.push_str("\n\nQuestion: ");
    user.push_str(input.question);
    Prompt {
        system,
        user,
        max_tokens,
    }
}

fn truncate_chars(text: &str, limit: usize) -> String {
    let mut chars = text.chars();
    let value: String = chars.by_ref().take(limit).collect();
    if chars.next().is_some() {
        format!("{value}…")
    } else {
        value
    }
}

/// Streaming parser output, either the validated target or a complete sentence.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseEvent {
    Target(Option<String>),
    Sentence(String),
}
/// Parsed target, prose and valid unique citation numbers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedAnswer {
    pub target: Option<String>,
    pub text: String,
    pub cited: Vec<u32>,
}
/// Incrementally parses model output, buffering incomplete lines and sentences.
pub struct AnswerParser {
    buffer: String,
    first_line: bool,
    target_emitted: bool,
    element_ids: HashSet<String>,
    passage_count: u32,
    target: Option<String>,
    sentences: Vec<String>,
    cited: Vec<u32>,
}
impl AnswerParser {
    /// Creates a parser with the valid screen ids and passage count.
    pub fn new(element_ids: impl IntoIterator<Item = String>, passage_count: u32) -> Self {
        Self {
            buffer: String::new(),
            first_line: true,
            target_emitted: false,
            element_ids: element_ids.into_iter().collect(),
            passage_count,
            target: None,
            sentences: Vec::new(),
            cited: Vec::new(),
        }
    }
    /// Adds a token fragment and emits any newly complete output.
    pub fn push(&mut self, piece: &str) -> Vec<ParseEvent> {
        self.buffer.push_str(piece);
        self.process(false)
    }
    /// Flushes buffered output and returns all remaining events and parsed answer.
    pub fn finish(mut self) -> (Vec<ParseEvent>, ParsedAnswer) {
        let events = self.process(true);
        let parsed = ParsedAnswer {
            target: self.target,
            text: self.sentences.join(" "),
            cited: self.cited,
        };
        (events, parsed)
    }
    fn process(&mut self, finishing: bool) -> Vec<ParseEvent> {
        let mut events = Vec::new();
        if self.first_line {
            let Some(pos) = self
                .buffer
                .find('\n')
                .or_else(|| finishing.then_some(self.buffer.len()))
            else {
                return events;
            };
            let line = self.buffer[..pos].trim_end_matches('\r').to_owned();
            let consumed = if pos < self.buffer.len() {
                pos + 1
            } else {
                pos
            };
            self.buffer.drain(..consumed);
            self.first_line = false;
            let target = target_value(&line).and_then(|value| self.valid_target(value));
            self.emit_target(target, &mut events);
            if target_value(&line).is_none() {
                self.buffer.insert_str(0, &line);
                self.buffer.insert(line.len(), '\n');
            }
        }
        while let Some(end) = prose_boundary(&self.buffer) {
            let text = self.buffer.drain(..end).collect::<String>();
            self.consume_prose(&text, &mut events);
        }
        if finishing {
            let text = std::mem::take(&mut self.buffer);
            self.consume_prose(&text, &mut events);
        }
        events
    }
    fn valid_target(&self, value: &str) -> Option<String> {
        let id = value.trim();
        if id.eq_ignore_ascii_case("none") {
            None
        } else {
            self.element_ids.contains(id).then(|| id.to_owned())
        }
    }
    fn emit_sentence(&mut self, sentence: String, events: &mut Vec<ParseEvent>) {
        if !sentence.is_empty() {
            self.sentences.push(sentence.clone());
            events.push(ParseEvent::Sentence(sentence));
        }
    }
    fn emit_target(&mut self, target: Option<String>, events: &mut Vec<ParseEvent>) {
        if !self.target_emitted {
            self.target = target.clone();
            self.target_emitted = true;
            events.push(ParseEvent::Target(target));
        }
    }
    fn consume_prose(&mut self, text: &str, events: &mut Vec<ParseEvent>) {
        let cleaned = clean_markers(text, self.passage_count, &mut self.cited);
        for line in cleaned.split('\n') {
            let sentence = normalize_sentence(line);
            self.emit_sentence(sentence, events);
        }
    }
}
/// Byte offset just past the next sentence boundary (newline, or `.?!` followed by
/// whitespace that is not an abbreviation or list number), if one is complete.
fn prose_boundary(text: &str) -> Option<usize> {
    for (index, ch) in text.char_indices() {
        if ch == '\n' {
            return Some(index + 1);
        }
        if matches!(ch, '.' | '?' | '!') {
            let end = index + ch.len_utf8();
            let Some((next_index, next)) = text[end..].char_indices().next() else {
                continue;
            };
            if !next.is_whitespace() || is_protected_period(text, index) {
                continue;
            }
            return Some(end + next_index + next.len_utf8());
        }
    }
    None
}
fn target_value(line: &str) -> Option<&str> {
    let trimmed = line.trim().trim_matches('*').trim();
    let (prefix, value) = trimmed.split_once(':')?;
    prefix
        .trim()
        .eq_ignore_ascii_case("target")
        .then_some(value.trim().trim_matches('*').trim())
}
fn is_protected_period(text: &str, byte: usize) -> bool {
    let before = &text[..byte];
    let line_prefix = before.rsplit('\n').next().unwrap_or("").trim();
    if !line_prefix.is_empty() && line_prefix.chars().all(|ch| ch.is_ascii_digit()) {
        return true;
    }
    let token = before.split_whitespace().next_back().unwrap_or("");
    let abbreviation = format!("{token}.");
    matches!(
        abbreviation.to_ascii_lowercase().as_str(),
        "p." | "pp." | "e.g." | "i.e." | "vs."
    )
}
fn clean_markers(text: &str, passage_count: u32, cited: &mut Vec<u32>) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.char_indices().peekable();
    while let Some((index, ch)) = chars.next() {
        if ch == '['
            && let Some(relative) = text[index + 1..].find(']')
        {
            let end = index + 1 + relative;
            let inside = &text[index + 1..end];
            let nums: Vec<u32> = inside
                .split(',')
                .map(str::trim)
                .filter_map(|value| value.parse().ok())
                .collect();
            if !nums.is_empty()
                && inside
                    .split(',')
                    .all(|part| part.trim().parse::<u32>().is_ok())
            {
                for n in nums {
                    if (1..=passage_count).contains(&n) && !cited.contains(&n) {
                        cited.push(n);
                    }
                }
                while chars.peek().is_some_and(|(offset, _)| *offset <= end) {
                    chars.next();
                }
                continue;
            }
        }
        if ch != '*' {
            out.push(ch);
        }
    }
    out
}
fn normalize_sentence(text: &str) -> String {
    let mut value = text.trim().trim_start_matches(['-', '*', '•']).trim();
    if let Some((prefix, rest)) = value.split_once(". ")
        && !prefix.is_empty()
        && prefix.chars().all(|ch| ch.is_ascii_digit())
    {
        value = rest.trim_start();
    }
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut result = String::with_capacity(collapsed.len());
    for ch in collapsed.chars() {
        if matches!(ch, '.' | ',' | '!' | '?' | ';' | ':') {
            while result.ends_with(' ') {
                result.pop();
            }
        }
        if ch != '*' {
            result.push(ch);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn parser() -> AnswerParser {
        AnswerParser::new(vec!["e3".into()], 2)
    }
    fn finish_text(chunks: &[&str]) -> (Vec<ParseEvent>, ParsedAnswer) {
        let mut p = parser();
        let mut events = Vec::new();
        for chunk in chunks {
            events.extend(p.push(chunk));
        }
        let (last, answer) = p.finish();
        events.extend(last);
        (events, answer)
    }
    #[test]
    fn target_can_be_split_across_pieces() {
        let (events, answer) = finish_text(&["**TAR", "GET:** e", "3\nSaved."]);
        assert_eq!(answer.target.as_deref(), Some("e3"));
        assert!(matches!(events[0], ParseEvent::Target(Some(_))));
    }
    #[test]
    fn markdown_bold_target_is_accepted() {
        let (_, answer) = finish_text(&["**TARGET:** e3\nSaved."]);
        assert_eq!(answer.target.as_deref(), Some("e3"));
    }
    #[test]
    fn unknown_target_is_none() {
        let (_, answer) = finish_text(&["TARGET: e4\nHello."]);
        assert_eq!(answer.target, None);
    }
    #[test]
    fn missing_target_line_is_prose() {
        let (events, answer) = finish_text(&["Hello there."]);
        assert_eq!(answer.target, None);
        assert_eq!(answer.text, "Hello there.");
        assert!(matches!(events[0], ParseEvent::Target(None)));
    }
    #[test]
    fn markers_are_removed_invalid_dropped_and_valid_deduplicated() {
        let (_, answer) = finish_text(&["TARGET: none\nFact [1, 9] and [1][2]."]);
        assert_eq!(answer.text, "Fact and.");
        assert_eq!(answer.cited, vec![1, 2]);
    }
    #[test]
    fn abbreviations_and_decimal_do_not_split() {
        let (_, answer) = finish_text(&["TARGET: none\nSee p. 4 and e.g. 3.5 items."]);
        assert_eq!(answer.text, "See p. 4 and e.g. 3.5 items.");
    }
    #[test]
    fn character_stream_matches_whole_string() {
        let text = "TARGET: e3\nUse Save [1]. Then wait!";
        let whole = finish_text(&[text]);
        let chunks: Vec<String> = text.chars().map(|ch| ch.to_string()).collect();
        let refs: Vec<&str> = chunks.iter().map(String::as_str).collect();
        assert_eq!(finish_text(&refs), whole);
    }
    #[test]
    fn prompt_replace_still_has_guarantees_and_no_base_rules() {
        let mut draft = templates_draft();
        draft.base_rules = BaseRulesMode::Replace;
        let result = build(&PromptInput {
            agent: &draft,
            question: "Help?",
            snapshot: None,
            passages: &[],
        });
        assert!(result.system.contains(GUARANTEES));
        assert!(!result.system.contains(BASE_RULES));
        assert!(result.system.contains("TARGET: none"));
    }
    fn templates_draft() -> AgentDraft {
        crate::templates::get(crate::model::TemplateId::OfficeHelper).draft
    }
}
