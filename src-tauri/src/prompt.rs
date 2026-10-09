//! Prompt construction and streaming answer parsing.
//!
//! A turn asks the model twice with prompts that share one prefix (system, screen,
//! question, passages), so the second request only evaluates its own short suffix:
//! 1. target: which screen element to point at, constrained to the element ids;
//! 2. answer: prose that cites passages, told which element the pointer shows.
//!
//! The screen part can be evaluated while the user is still speaking
//! ([`TurnPrompt::warm_user`]), before the question is known.
use crate::model::{
    AgentDraft, AnswerLength, BaseRulesMode, ScreenElement, ScreenMode, ScreenSnapshot, TaskStep,
};

/// General grounding and answer-quality rules (BR-6).
pub const BASE_RULES: &str = "Be grounded and honest: answer from the supplied screen and passages. If neither supports an answer, say \"I don't know\". Be brief; lead with the action, then the reason, then the source.";
/// Product guarantees that remain in force for every agent configuration.
pub const GUARANTEES: &str = "Never claim a source that is not among the numbered passages (BR-4). Never offer to click or type for the user (BR-14). Never write screen element ids such as e12 in an answer.";
/// Choice meaning "no element fits" in the target pass.
pub const NO_TARGET: &str = "none";

const TARGET_TASK: &str = "Task: name the one screen element where the user should act to do what the question asks. Match the people, names, labels and values in the question to the screen elements; the question may come from speech recognition, so a name can be spelled differently or heard as a similar-sounding word, so match names by sound too. For a value to enter, pick the cell or field where it goes, not a button or a column header. Reply with the element id only, or none if nothing on the screen fits.";
const MARKS_NOTE: &str = "The screenshot shows the same screen; each listed element has a box with its id written at its top-left corner. ";
const TEXT_NOTE: &str = "Text read from the screenshot; each piece has a box on the screenshot with its id written at its top-left corner:";
const POINT_TASK: &str = "Task: the screenshot shows the user's screen. Point to the one place where the user should act to do what the question asks. Reply with the point as [y, x] normalized to 0-1000, or none if nothing on the screen fits.";
const ANSWER_TASK: &str = "Task: answer the question.";
const CITE_TASK: &str = " Cite the passages you use inline as [n].";
const NO_SOURCE_TASK: &str =
    " There are no passages: do not add a source or any reference after the answer.";

/// One retrieved passage and its display location.
pub struct RetrievedPassage<'a> {
    pub document_name: &'a str,
    pub location: &'a str,
    pub text: &'a str,
}

/// The shared parts of one turn's prompts.
pub struct TurnPrompt {
    pub system: String,
    /// Generation budget for the answer.
    pub max_tokens: u32,
    /// Screen description; every user prompt of the turn starts with it.
    context: String,
    /// Earlier steps of a guided task (PRD S5), rendered; empty outside a task.
    task: String,
}

impl TurnPrompt {
    /// Builds the system prompt for `agent`, the screen description and the earlier
    /// steps of a guided task (oldest first; empty when not in a task).
    pub fn new(agent: &AgentDraft, snapshot: Option<&ScreenSnapshot>, task: &[TaskStep]) -> Self {
        let mut system = String::from(GUARANTEES);
        if agent.base_rules == BaseRulesMode::Include {
            system.push_str("\n\n");
            system.push_str(BASE_RULES);
        }
        if !agent.instructions.is_empty() {
            system.push_str("\n\nAgent instructions: ");
            system.push_str(&agent.instructions);
        }
        system.push_str("\n\nAnswer in English. Keep screen labels exactly as shown, never name element roles, and only give the steps the question asks for.");
        let max_tokens = match agent.answer_length {
            AnswerLength::Short => {
                system.push_str("\nLength: 1-2 sentences.");
                80
            }
            AnswerLength::Normal => {
                system.push_str("\nLength: up to 4 sentences.");
                160
            }
        };
        let mut context = String::new();
        if let Some(snapshot) = snapshot {
            context.push_str("Screen:\nApp: ");
            context.push_str(&snapshot.app_name);
            context.push_str("\nWindow: ");
            context.push_str(snapshot.window_title.as_deref().unwrap_or("(none)"));
            for element in &snapshot.elements {
                context.push('\n');
                context.push_str(&element.id);
                context.push_str(" | ");
                context.push_str(&element.role);
                context.push_str(" | ");
                context.push_str(&truncate_chars(&element.label, 60));
                context.push_str(" | ");
                context.push_str(element.value.as_deref().unwrap_or(""));
            }
        } else {
            context.push_str("(no screen)");
        }
        context.push_str("\n\n");
        let mut task_text = String::new();
        if !task.is_empty() {
            use std::fmt::Write;
            task_text.push_str("Earlier steps of this task:");
            for (index, step) in task.iter().enumerate() {
                let _ = write!(
                    task_text,
                    "\nStep {}: Q: {} A: {}",
                    index + 1,
                    step.question,
                    truncate_chars(&step.answer, 300)
                );
                if let Some(label) = &step.target_label {
                    let _ = write!(task_text, " (pointed at: {})", truncate_chars(label, 60));
                }
            }
            task_text.push_str(
                "\nThe user is continuing this task. Give only the next single step on the current screen.\n\n",
            );
        }
        Self {
            system,
            max_tokens,
            context,
            task: task_text,
        }
    }

    /// User prompt to evaluate ahead of time: a prefix of every prompt below.
    pub fn warm_user(&self) -> &str {
        &self.context
    }

    /// The last part of the target-pass prompt for `mode`. Reply grammar:
    /// [`target_grammar`] for element modes, [`crate::screenshot::POINT_GRAMMAR`]
    /// for [`ScreenMode::ImageOnly`].
    pub fn target_task(mode: ScreenMode) -> String {
        match mode {
            ScreenMode::Elements => TARGET_TASK.to_owned(),
            ScreenMode::ElementsWithImage => format!("{MARKS_NOTE}{TARGET_TASK}"),
            ScreenMode::ImageOnly => POINT_TASK.to_owned(),
        }
    }

    /// Tier-3 target task when text was read from the screenshot: the text pieces
    /// (ids `t1`…) and the element task. Reply grammar: [`target_grammar`] of `text`.
    pub fn text_target_task(text: &ScreenSnapshot) -> String {
        use std::fmt::Write;
        let mut task = String::from(TEXT_NOTE);
        for piece in &text.elements {
            let _ = write!(
                task,
                "\n{} | {}",
                piece.id,
                truncate_chars(&piece.label, 80)
            );
        }
        task.push_str("\n\n");
        task.push_str(TARGET_TASK);
        task
    }

    /// The last part of the answer-pass prompt: what the pointer shows, then the task.
    /// `cite`: passages were supplied, so ask for `[n]` citations (asking without
    /// passages makes the model cite element ids or app names instead).
    pub fn answer_task(pointed: Pointed<'_>, cite: bool) -> String {
        use std::fmt::Write;
        let mut task = String::new();
        match pointed {
            Pointed::Element(element) => {
                let _ = write!(
                    task,
                    "The pointer is showing the user this {}: \"{}\"",
                    plain_role(&element.role),
                    truncate_chars(&element.label, 60)
                );
                if let Some(value) = &element.value {
                    let _ = write!(task, " (value: {})", truncate_chars(value, 60));
                }
                task.push_str(". Refer to it by what it shows.\n\n");
            }
            Pointed::Guess => task.push_str(
                "The pointer is showing a best guess read from the screenshot; say it is a best guess.\n\n",
            ),
            Pointed::Nothing => {}
        }
        task.push_str(ANSWER_TASK);
        task.push_str(if cite { CITE_TASK } else { NO_SOURCE_TASK });
        task
    }

    /// Screen, task steps, question and passages: the part both passes share. A
    /// screenshot, when used, goes right after it.
    pub fn body(&self, question: &str, passages: &[RetrievedPassage<'_>]) -> String {
        use std::fmt::Write;
        let mut user = format!("{}{}Question: {question}\n\n", self.context, self.task);
        // No passages: say nothing. A marker here gets echoed into the answer
        // ("[no documents]", "(No passage found)").
        if !passages.is_empty() {
            user.push_str("Passages:");
            for (index, passage) in passages.iter().enumerate() {
                let _ = write!(
                    user,
                    "\n[{}] {}, {}: {}",
                    index + 1,
                    passage.document_name,
                    passage.location,
                    passage.text
                );
            }
            user.push_str("\n\n");
        }
        user
    }
}

/// What the answer pass is told the pointer shows.
#[derive(Debug, Clone, Copy)]
pub enum Pointed<'a> {
    Element(&'a ScreenElement),
    /// A tier-3 point read from the screenshot.
    Guess,
    Nothing,
}

/// Grammar for the target-pass reply: one of the element ids, or [`NO_TARGET`].
pub fn target_grammar(snapshot: &ScreenSnapshot) -> String {
    let choices: Vec<String> = snapshot
        .elements
        .iter()
        .map(|element| element.id.clone())
        .chain(std::iter::once(NO_TARGET.to_owned()))
        .collect();
    choices_grammar(&choices)
}

/// GBNF (root rule `root`) accepting exactly one of `choices`.
pub fn choices_grammar(choices: &[String]) -> String {
    let alternatives = choices
        .iter()
        .map(|choice| format!("\"{}\"", choice.replace('\\', "\\\\").replace('"', "\\\"")))
        .collect::<Vec<_>>()
        .join(" | ");
    format!("root ::= {alternatives}")
}

/// The element named by a target-pass reply, if it is on the screen.
pub fn target_element<'a>(reply: &str, snapshot: &'a ScreenSnapshot) -> Option<&'a ScreenElement> {
    let id = reply.trim();
    snapshot.elements.iter().find(|element| element.id == id)
}

/// A shared role ([`crate::platform::ROLES`]) as a user would say it: the answer
/// pass repeats the word it is given ("this textField" became "sa textField na").
fn plain_role(role: &str) -> &'static str {
    match role {
        "button" => "button",
        "checkbox" => "checkbox",
        "radio" => "option",
        "textField" => "field",
        "textArea" => "text box",
        "comboBox" => "drop-down",
        "list" => "list",
        "listItem" | "row" => "item",
        "menu" => "menu",
        "menuItem" => "menu item",
        "menuBar" => "menu bar",
        "tab" => "tab",
        "link" => "link",
        "cell" => "cell",
        "table" => "table",
        "image" => "picture",
        "text" => "text",
        "slider" => "slider",
        "toolbar" => "toolbar",
        "window" => "window",
        _ => "item",
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

/// Parsed prose and valid unique citation numbers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedAnswer {
    pub text: String,
    pub cited: Vec<u32>,
}
/// Incrementally splits model output into sentences, removing citation markers.
pub struct AnswerParser {
    buffer: String,
    passage_count: u32,
    sentences: Vec<String>,
    cited: Vec<u32>,
}
impl AnswerParser {
    /// Creates a parser accepting citations `[1]..=[passage_count]`.
    pub fn new(passage_count: u32) -> Self {
        Self {
            buffer: String::new(),
            passage_count,
            sentences: Vec::new(),
            cited: Vec::new(),
        }
    }
    /// Adds a token fragment and returns any newly complete sentences.
    pub fn push(&mut self, piece: &str) -> Vec<String> {
        self.buffer.push_str(piece);
        self.process(false)
    }
    /// Flushes buffered output and returns the remaining sentences and parsed answer.
    pub fn finish(mut self) -> (Vec<String>, ParsedAnswer) {
        let sentences = self.process(true);
        let parsed = ParsedAnswer {
            text: self.sentences.join(" "),
            cited: self.cited,
        };
        (sentences, parsed)
    }
    fn process(&mut self, finishing: bool) -> Vec<String> {
        let mut out = Vec::new();
        while let Some(end) = prose_boundary(&self.buffer) {
            let text = self.buffer.drain(..end).collect::<String>();
            self.consume_prose(&text, &mut out);
        }
        if finishing {
            let text = std::mem::take(&mut self.buffer);
            self.consume_prose(&text, &mut out);
        }
        out
    }
    fn consume_prose(&mut self, text: &str, out: &mut Vec<String>) {
        let cleaned = clean_markers(text, self.passage_count, &mut self.cited);
        for line in cleaned.split('\n') {
            let sentence = normalize_sentence(line);
            if !sentence.is_empty() {
                self.sentences.push(sentence.clone());
                out.push(sentence);
            }
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
/// `e` or `t` followed by digits: the ids given to screen elements and to text read
/// from a screenshot.
fn is_element_id(text: &str) -> bool {
    text.strip_prefix(['e', 't'])
        .is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()))
}

fn clean_markers(text: &str, passage_count: u32, cited: &mut Vec<u32>) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.char_indices().peekable();
    while let Some((index, ch)) = chars.next() {
        // A screen element id such as (e15) must never reach the user.
        if ch == '('
            && let Some(relative) = text[index + 1..].find(')')
        {
            let end = index + 1 + relative;
            let inside = &text[index + 1..end];
            if !inside.is_empty() && inside.split(',').all(|part| is_element_id(part.trim())) {
                while chars.peek().is_some_and(|(offset, _)| *offset <= end) {
                    chars.next();
                }
                if out.ends_with(' ') {
                    out.pop();
                }
                continue;
            }
        }
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
            // A screen element id such as [e15] must never reach the user.
            if !inside.is_empty() && inside.split(',').all(|part| is_element_id(part.trim())) {
                while chars.peek().is_some_and(|(offset, _)| *offset <= end) {
                    chars.next();
                }
                // Drop the space the marker leaned on: "button [e15]." -> "button."
                if out.ends_with(' ') {
                    out.pop();
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
    use crate::model::Rect;

    fn finish_text(chunks: &[&str]) -> (Vec<String>, ParsedAnswer) {
        let mut p = AnswerParser::new(2);
        let mut sentences = Vec::new();
        for chunk in chunks {
            sentences.extend(p.push(chunk));
        }
        let (last, answer) = p.finish();
        sentences.extend(last);
        (sentences, answer)
    }
    fn element(id: &str, label: &str, value: Option<&str>) -> ScreenElement {
        ScreenElement {
            id: id.into(),
            role: "cell".into(),
            label: label.into(),
            value: value.map(Into::into),
            bounds: Rect {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            },
        }
    }
    fn snapshot() -> ScreenSnapshot {
        ScreenSnapshot {
            app_name: "Numbers".into(),
            window_title: Some("Grades".into()),
            elements: vec![
                element("e1", "Name, row 1", Some("Juan Dela Cruz")),
                element("e2", "Q1, Juan Dela Cruz", None),
                element("e3", "Final, Juan Dela Cruz", Some("88.5")),
            ],
        }
    }
    fn templates_draft() -> AgentDraft {
        crate::templates::get(crate::model::TemplateId::OfficeHelper).draft
    }

    #[test]
    fn markers_are_removed_invalid_dropped_and_valid_deduplicated() {
        let (_, answer) = finish_text(&["Fact [1, 9] and [1][2]."]);
        assert_eq!(answer.text, "Fact and.");
        assert_eq!(answer.cited, vec![1, 2]);
    }
    #[test]
    fn element_ids_never_reach_the_answer() {
        let (_, answer) =
            finish_text(&["Click \"All Clear\" [e15]. Then (e25) [e3, t4] or [Ctrl] (eat)."]);
        assert_eq!(answer.text, "Click \"All Clear\". Then or [Ctrl] (eat).");
    }
    #[test]
    fn abbreviations_and_decimal_do_not_split() {
        let (sentences, answer) = finish_text(&["See p. 4 and e.g. 3.5 items."]);
        assert_eq!(answer.text, "See p. 4 and e.g. 3.5 items.");
        assert_eq!(sentences.len(), 1);
    }
    #[test]
    fn character_stream_matches_whole_string() {
        let text = "Use Save [1]. Then wait!";
        let whole = finish_text(&[text]);
        let chunks: Vec<String> = text.chars().map(|ch| ch.to_string()).collect();
        let refs: Vec<&str> = chunks.iter().map(String::as_str).collect();
        assert_eq!(finish_text(&refs), whole);
        assert_eq!(whole.0, vec!["Use Save.", "Then wait!"]);
    }
    #[test]
    fn every_turn_prompt_extends_the_warm_prefix() {
        let draft = templates_draft();
        let screen = snapshot();
        let turn = TurnPrompt::new(&draft, Some(&screen), &[]);
        let passages = [RetrievedPassage {
            document_name: "Manual",
            location: "p. 4",
            text: "Enter grades in the Q1 column.",
        }];
        let question = "Where do I put Juan's grade?";
        let body = turn.body(question, &passages);
        assert!(body.starts_with(turn.warm_user()));
        assert!(body.contains("[1] Manual, p. 4: Enter grades"));
        assert!(turn.warm_user().contains("e2 | cell | Q1, Juan Dela Cruz"));
        let answer_task = TurnPrompt::answer_task(Pointed::Element(&screen.elements[1]), true);
        assert!(answer_task.contains("\"Q1, Juan Dela Cruz\""));
        // Roles in the user's words: the answer repeats them.
        let field = ScreenElement {
            role: "textField".into(),
            ..screen.elements[1].clone()
        };
        let field_task = TurnPrompt::answer_task(Pointed::Element(&field), true);
        assert!(field_task.contains("this field: "), "{field_task}");
        assert!(!field_task.contains("textField"));
        assert!(!answer_task.contains("e2"));
        assert!(TurnPrompt::answer_task(Pointed::Guess, true).contains("best guess"));
        assert!(!TurnPrompt::answer_task(Pointed::Nothing, true).contains("pointer"));
        assert!(answer_task.contains("[n]"));
        assert!(!TurnPrompt::answer_task(Pointed::Nothing, false).contains("[n]"));
        // Tier 2 explains the drawn ids; tier 3 asks for a point, not an id.
        assert!(TurnPrompt::target_task(ScreenMode::ElementsWithImage).contains("id written"));
        assert!(TurnPrompt::target_task(ScreenMode::ImageOnly).contains("[y, x]"));
    }
    #[test]
    fn replace_mode_keeps_guarantees_and_drops_base_rules() {
        let mut draft = templates_draft();
        draft.base_rules = BaseRulesMode::Replace;
        let turn = TurnPrompt::new(&draft, None, &[]);
        assert!(turn.system.contains(GUARANTEES));
        assert!(!turn.system.contains(BASE_RULES));
        assert_eq!(turn.warm_user(), "(no screen)\n\n");
    }
    #[test]
    fn system_prompt_requires_english_and_hides_element_roles() {
        let turn = TurnPrompt::new(&templates_draft(), None, &[]);
        assert!(turn.system.contains("Answer in English."));
        assert!(turn.system.contains("never name element roles"));
    }
    #[test]
    fn target_grammar_and_reply_mapping() {
        let screen = snapshot();
        assert_eq!(
            target_grammar(&screen),
            r#"root ::= "e1" | "e2" | "e3" | "none""#
        );
        assert_eq!(
            choices_grammar(&[r#"say "hi" \o/"#.to_owned()]),
            r#"root ::= "say \"hi\" \\o/""#
        );
        assert_eq!(
            target_element(" e2", &screen).map(|e| e.id.as_str()),
            Some("e2")
        );
        assert!(target_element(NO_TARGET, &screen).is_none());
        assert!(target_element("e9", &screen).is_none());
    }
    fn step(question: &str, answer: &str, target_label: Option<&str>) -> TaskStep {
        TaskStep {
            question: question.into(),
            answer: answer.into(),
            target_label: target_label.map(Into::into),
        }
    }
    #[test]
    fn task_steps_come_oldest_first_after_the_screen_and_before_the_question() {
        let turn = TurnPrompt::new(
            &templates_draft(),
            None,
            &[
                step("Open file?", "Click File.", Some("File")),
                step("Then?", "Click Save.", None),
            ],
        );
        let user = turn.body("Next?", &[]);
        assert!(user.starts_with(turn.warm_user()));
        let first = user
            .find("Step 1: Q: Open file? A: Click File. (pointed at: File)")
            .expect("first step");
        let second = user
            .find("Step 2: Q: Then? A: Click Save.")
            .expect("second step");
        let question = user.find("Question: Next?").expect("question");
        assert!(first < second && second < question);
        assert!(user.contains("continuing this task"));
        assert!(
            !TurnPrompt::new(&templates_draft(), None, &[])
                .body("Next?", &[])
                .contains("Earlier steps")
        );
    }
    #[test]
    fn long_task_answer_is_truncated() {
        let turn = TurnPrompt::new(
            &templates_draft(),
            None,
            &[step("q", &"x".repeat(1000), None)],
        );
        let user = turn.body("Next?", &[]);
        assert!(user.contains(&format!("A: {}…", "x".repeat(300))));
        assert!(!user.contains(&"x".repeat(301)));
    }
}
