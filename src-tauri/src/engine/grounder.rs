//! Tier-3 GUI grounding with Qwen3-VL-2B-Instruct (Apache-2.0) through the shared
//! llama.cpp runtime; it replies with a point normalized to 0–1000.

use std::path::Path;

use super::llama::{LlamaChat, PromptFormat, Runtime};
use super::{ChatModel, ChatRequest, EngineResult, Flow, Grounder, ImagePart, RgbImage};

/// Qwen3-VL's point instruction; it replies `{"point_2d": [x, y]}`.
fn prompt(instruction: &str) -> String {
    format!(
        "The user asked: \"{instruction}\"\nPoint to the one UI element in the screenshot \
         where the user should act. Reply only with JSON: {{\"point_2d\": [x, y]}}"
    )
}

/// Largest coordinate in the model's replies.
const SCALE: f64 = 1000.0;
/// A point reply is a few dozen tokens at most.
const MAX_TOKENS: u32 = 48;

/// A grounding model with its own llama.cpp context.
pub struct LlamaGrounder {
    chat: LlamaChat,
}

impl LlamaGrounder {
    /// Loads `model` and its image projector.
    ///
    /// # Errors
    /// Missing files or a runtime failure.
    pub fn load(rt: &Runtime, model: &Path, projector: &Path) -> EngineResult<Self> {
        let chat = LlamaChat::load_with_format(rt, model, projector, PromptFormat::ChatMl)?;
        Ok(Self { chat })
    }
}

impl Grounder for LlamaGrounder {
    fn name(&self) -> &'static str {
        "Qwen3-VL-2B"
    }

    fn ground(&self, image: &RgbImage, instruction: &str) -> EngineResult<Option<(f64, f64)>> {
        let prompt = prompt(instruction);
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
        tracing::debug!(reply = %reply, "grounding");
        Ok(parse_point(&reply))
    }
}

/// The first `[x, y]` (or `(x, y)`) pair of the reply as fractions, when both are
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
    fn reads_the_point_as_x_y_fractions() {
        assert_eq!(
            parse_point(r#"{"point_2d": [250, 500]}"#),
            Some((0.25, 0.5))
        );
        assert_eq!(parse_point(r#"{"point_2d": [1000, 0]}"#), Some((1.0, 0.0)));
        assert_eq!(parse_point("(1200,40)"), None);
        assert_eq!(parse_point("no element"), None);
    }
}
