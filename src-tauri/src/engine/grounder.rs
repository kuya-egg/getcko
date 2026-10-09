//! GUI grounding models run through the shared llama.cpp runtime. Both reply with a
//! point normalized to 0–1000; they differ in prompt and reply wording.

use std::path::Path;

use super::llama::{LlamaChat, PromptFormat, Runtime};
use super::{ChatModel, ChatRequest, EngineResult, Flow, Grounder, ImagePart, RgbImage};

/// Which grounding model a [`LlamaGrounder`] runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GrounderKind {
    /// ByteDance UI-TARS-2B-SFT (Qwen2-VL based, Apache-2.0): replies
    /// `Action: click(start_box='(x,y)')`.
    UiTars,
    /// Qwen3-VL-2B-Instruct (Apache-2.0): replies `{"point_2d": [x, y]}`.
    Qwen3Vl,
}

impl GrounderKind {
    fn name(self) -> &'static str {
        match self {
            Self::UiTars => "UI-TARS-2B",
            Self::Qwen3Vl => "Qwen3-VL-2B",
        }
    }

    fn prompt(self, instruction: &str) -> String {
        match self {
            // UI-TARS's grounding template (actions only, no thought).
            Self::UiTars => format!(
                "You are a GUI agent. You are given a task and your action history, with screenshots. \
                 You need to perform the next action to complete the task.\n\n## Output Format\n\n\
                 Action: ...\n\n## Action Space\nclick(start_box='<|box_start|>(x1,y1)<|box_end|>')\n\n\
                 ## User Instruction\n{instruction}"
            ),
            Self::Qwen3Vl => format!(
                "The user asked: \"{instruction}\"\nPoint to the one UI element in the screenshot \
                 where the user should act. Reply only with JSON: {{\"point_2d\": [x, y]}}"
            ),
        }
    }
}

/// Largest coordinate in both models' replies.
const SCALE: f64 = 1000.0;
/// A point reply is a few dozen tokens at most.
const MAX_TOKENS: u32 = 48;

/// A grounding model with its own llama.cpp context.
pub struct LlamaGrounder {
    chat: LlamaChat,
    kind: GrounderKind,
}

impl LlamaGrounder {
    /// Loads `model` and its image projector.
    ///
    /// # Errors
    /// Missing files or a runtime failure.
    pub fn load(
        rt: &Runtime,
        kind: GrounderKind,
        model: &Path,
        projector: &Path,
    ) -> EngineResult<Self> {
        let chat = LlamaChat::load_with_format(rt, model, projector, PromptFormat::ChatMl)?;
        Ok(Self { chat, kind })
    }
}

impl Grounder for LlamaGrounder {
    fn name(&self) -> &'static str {
        self.kind.name()
    }

    fn ground(&self, image: &RgbImage, instruction: &str) -> EngineResult<Option<(f64, f64)>> {
        let prompt = self.kind.prompt(instruction);
        let mut reply = String::new();
        self.chat.generate(
            &ChatRequest {
                system: "",
                user: "",
                max_tokens: MAX_TOKENS,
                grammar: None,
                image: Some(ImagePart {
                    image,
                    text_after: &prompt,
                }),
            },
            &mut |piece| {
                reply.push_str(piece);
                Flow::Continue
            },
        )?;
        // A point, never user text.
        tracing::debug!(model = self.kind.name(), reply = %reply, "grounding");
        Ok(parse_point(&reply))
    }
}

/// The first `(x, y)` or `[x, y]` pair of the reply as fractions, when both are
/// within 0..=1000. Numbers outside brackets (`point_2d`) are ignored.
fn parse_point(reply: &str) -> Option<(f64, f64)> {
    let start = reply.char_indices().find_map(|(index, c)| {
        let after = index + c.len_utf8();
        (matches!(c, '(' | '[')
            && reply[after..]
                .trim_start()
                .starts_with(|d: char| d.is_ascii_digit()))
        .then_some(after)
    })?;
    let mut numbers = reply[start..]
        .split(|c: char| !c.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse::<u32>().ok());
    let (x, y) = (f64::from(numbers.next()?), f64::from(numbers.next()?));
    (x <= SCALE && y <= SCALE).then_some((x / SCALE, y / SCALE))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_both_reply_styles_as_x_y_fractions() {
        assert_eq!(
            parse_point("Action: click(start_box='(250,500)')"),
            Some((0.25, 0.5))
        );
        assert_eq!(parse_point(r#"{"point_2d": [1000, 0]}"#), Some((1.0, 0.0)));
        assert_eq!(parse_point("(1200,40)"), None);
        assert_eq!(parse_point("no element"), None);
    }
}
