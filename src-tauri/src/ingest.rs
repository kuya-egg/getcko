//! Document text extraction, deterministic chunking, and content fingerprints.

use crate::{
    error::{AppError, ErrorKind},
    model::DocumentKind,
};
use sha2::{Digest, Sha256};

/// Errors that can occur while extracting document text.
#[derive(Debug, thiserror::Error)]
pub enum IngestError {
    /// The document format is not yet supported.
    #[error("{0} files are not supported yet")]
    Unsupported(&'static str),
    /// Extraction produced no useful text.
    #[error("no text found (scanned PDF?)")]
    NoText,
    /// The document could not be decoded.
    #[error("could not read file: {0}")]
    Read(String),
}

impl From<IngestError> for AppError {
    fn from(error: IngestError) -> Self {
        match error {
            IngestError::Unsupported(_) | IngestError::NoText => {
                Self::new(ErrorKind::Invalid, error.to_string())
            }
            IngestError::Read(_) => Self::new(ErrorKind::Io, error.to_string()),
        }
    }
}

/// Text and source location from one logical document section.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Section {
    pub text: String,
    pub location: String,
}

/// Extracted document sections and, for PDFs, the total page count.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Extracted {
    pub sections: Vec<Section>,
    pub page_count: Option<u32>,
}

/// Extract readable text from a supported document.
///
/// # Errors
/// Returns [`IngestError`] when the format is unsupported, PDF extraction fails,
/// or no useful text is present.
pub fn extract(bytes: &[u8], kind: DocumentKind) -> Result<Extracted, IngestError> {
    match kind {
        DocumentKind::Markdown => {
            let text = String::from_utf8_lossy(bytes).replace("\r\n", "\n");
            let mut sections = Vec::new();
            let mut headings: Vec<(usize, String)> = Vec::new();
            let mut location = "Introduction".to_owned();
            let mut body = String::new();
            for line in text.lines() {
                if let Some((level, title)) = atx_heading(line) {
                    if !body.trim().is_empty() {
                        sections.push(Section {
                            text: std::mem::take(&mut body),
                            location,
                        });
                    }
                    while headings
                        .last()
                        .is_some_and(|(heading_level, _)| *heading_level >= level)
                    {
                        headings.pop();
                    }
                    headings.push((level, title.to_owned()));
                    location = headings
                        .iter()
                        .map(|(_, heading)| heading.as_str())
                        .collect::<Vec<_>>()
                        .join(" > ");
                } else {
                    body.push_str(line);
                    body.push('\n');
                }
            }
            if !body.trim().is_empty() {
                sections.push(Section {
                    text: body,
                    location,
                });
            }
            if sections.is_empty() {
                return Err(IngestError::NoText);
            }
            Ok(Extracted {
                sections,
                page_count: None,
            })
        }
        DocumentKind::Text => {
            let text = String::from_utf8_lossy(bytes).replace("\r\n", "\n");
            if text.trim().is_empty() {
                return Err(IngestError::NoText);
            }
            Ok(Extracted {
                sections: vec![Section {
                    text,
                    location: "Text".into(),
                }],
                page_count: None,
            })
        }
        DocumentKind::Pdf => {
            let pages = pdf_extract::extract_text_from_mem_by_pages(bytes)
                .map_err(|error| IngestError::Read(error.to_string()))?;
            let page_count = u32::try_from(pages.len()).unwrap_or(u32::MAX);
            let sections = pages
                .into_iter()
                .enumerate()
                .filter_map(|(index, text)| {
                    (!text.trim().is_empty()).then(|| Section {
                        text,
                        location: format!("p. {}", index + 1),
                    })
                })
                .collect::<Vec<_>>();
            if sections.is_empty() {
                return Err(IngestError::NoText);
            }
            Ok(Extracted {
                sections,
                page_count: Some(page_count),
            })
        }
        DocumentKind::Docx => Err(IngestError::Unsupported("Word")),
        DocumentKind::Pptx => Err(IngestError::Unsupported("PowerPoint")),
    }
}

fn atx_heading(line: &str) -> Option<(usize, &str)> {
    let trimmed = line.trim_start();
    let level = trimmed.bytes().take_while(|byte| *byte == b'#').count();
    if !(1..=6).contains(&level)
        || !trimmed
            .as_bytes()
            .get(level)
            .is_some_and(u8::is_ascii_whitespace)
    {
        return None;
    }
    let title = trimmed[level..].trim().trim_end_matches('#').trim_end();
    (!title.is_empty()).then_some((level, title))
}

/// Default chunk target, measured using [`estimate_tokens`].
pub const TARGET_TOKENS: usize = 400;
/// Default trailing overlap between adjacent chunks.
pub const OVERLAP_TOKENS: usize = 60;

/// One chunk of source text with its location and approximate token count.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Chunk {
    pub text: String,
    pub location: String,
    pub token_count: u32,
}

/// Estimate token count as ceil(characters / 4), an approximation good enough for sizing.
pub fn estimate_tokens(text: &str) -> u32 {
    u32::try_from(text.chars().count().saturating_add(3) / 4).unwrap_or(u32::MAX)
}

/// Split sections into deterministic, paragraph-aware chunks without crossing locations.
pub fn chunk(sections: &[Section], target_tokens: usize, overlap_tokens: usize) -> Vec<Chunk> {
    let target = target_tokens.max(1);
    let mut result = Vec::new();
    for section in sections {
        let mut units = Vec::new();
        for paragraph in section
            .text
            .split("\n\n")
            .map(str::trim)
            .filter(|part| !part.is_empty())
        {
            if estimate_tokens(paragraph) <= target as u32 {
                units.push(paragraph.to_owned());
            } else {
                units.extend(split_long_paragraph(paragraph, target));
            }
        }
        let mut current = String::new();
        for unit in units {
            let candidate_len = current
                .chars()
                .count()
                .saturating_add(usize::from(!current.is_empty()) * 2)
                .saturating_add(unit.chars().count());
            if !current.is_empty() && estimate_tokens_chars(candidate_len) > target {
                push_chunk(&mut result, std::mem::take(&mut current), &section.location);
                current = overlap_tail(
                    result.last().map(|item| item.text.as_str()).unwrap_or(""),
                    overlap_tokens.min(target.saturating_sub(1)),
                );
            }

            let budget = target
                .saturating_sub(overlap_tokens.min(target.saturating_sub(1)))
                .saturating_sub(1)
                .max(1);
            for piece in split_words(&unit, budget) {
                let candidate_len = current
                    .chars()
                    .count()
                    .saturating_add(usize::from(!current.is_empty()) * 2)
                    .saturating_add(piece.chars().count());
                if !current.is_empty() && estimate_tokens_chars(candidate_len) > target {
                    push_chunk(&mut result, std::mem::take(&mut current), &section.location);
                    current = overlap_tail(
                        result.last().map(|item| item.text.as_str()).unwrap_or(""),
                        overlap_tokens.min(target.saturating_sub(1)),
                    );
                }
                if !current.is_empty() {
                    current.push_str("\n\n");
                }
                current.push_str(&piece);
            }
        }
        if !current.trim().is_empty() {
            push_chunk(&mut result, current, &section.location);
        }
    }
    result
}

fn estimate_tokens_chars(chars: usize) -> usize {
    chars.saturating_add(3) / 4
}

fn split_long_paragraph(paragraph: &str, target: usize) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut start = 0;
    for (index, character) in paragraph.char_indices() {
        if matches!(character, '.' | '!' | '?')
            && paragraph[index + character.len_utf8()..].starts_with(char::is_whitespace)
        {
            let end = index + character.len_utf8();
            let sentence = paragraph[start..end].trim();
            if !sentence.is_empty() {
                sentences.push(sentence.to_owned());
            }
            start = end;
        }
    }
    let trailing = paragraph[start..].trim();
    if !trailing.is_empty() {
        sentences.push(trailing.to_owned());
    }
    if sentences.is_empty() {
        sentences.push(paragraph.to_owned());
    }
    let mut output = Vec::new();
    let mut packed = String::new();
    for sentence in sentences {
        if estimate_tokens(&sentence) > target as u32 {
            if !packed.is_empty() {
                output.push(std::mem::take(&mut packed));
            }
            output.extend(split_words(&sentence, target));
        } else if !packed.is_empty()
            && estimate_tokens_chars(packed.chars().count() + sentence.chars().count() + 1) > target
        {
            output.push(std::mem::take(&mut packed));
            packed = sentence;
        } else {
            if !packed.is_empty() {
                packed.push(' ');
            }
            packed.push_str(&sentence);
        }
    }
    if !packed.is_empty() {
        output.push(packed);
    }
    output
}

fn split_words(text: &str, target: usize) -> Vec<String> {
    let mut output = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        let needed =
            current.chars().count() + usize::from(!current.is_empty()) + word.chars().count();
        if !current.is_empty() && estimate_tokens_chars(needed) > target {
            output.push(std::mem::take(&mut current));
        }
        if word.chars().count() > target.saturating_mul(4) {
            if !current.is_empty() {
                output.push(std::mem::take(&mut current));
            }
            let mut fragment = String::new();
            for character in word.chars() {
                if fragment.chars().count() >= target.saturating_mul(4) {
                    output.push(std::mem::take(&mut fragment));
                }
                fragment.push(character);
            }
            if !fragment.is_empty() {
                output.push(fragment);
            }
        } else {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
        }
    }
    if !current.is_empty() {
        output.push(current);
    }
    output
}

fn overlap_tail(text: &str, overlap_tokens: usize) -> String {
    let max_chars = overlap_tokens.saturating_mul(4);
    if max_chars == 0 {
        return String::new();
    }
    let words = text.split_whitespace().collect::<Vec<_>>();
    let mut tail = Vec::new();
    let mut count: usize = 0;
    for word in words.into_iter().rev() {
        let size = word.chars().count() + usize::from(!tail.is_empty());
        if count.saturating_add(size) > max_chars {
            break;
        }
        count += size;
        tail.push(word);
    }
    tail.reverse();
    tail.join(" ")
}

fn push_chunk(output: &mut Vec<Chunk>, text: String, location: &str) {
    if text.trim().is_empty() {
        return;
    }
    output.push(Chunk {
        token_count: estimate_tokens(&text),
        text,
        location: location.to_owned(),
    });
}

/// Return the lowercase SHA-256 digest of the supplied bytes.
#[must_use]
pub fn fingerprint(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(digest.len() * 2);
    for byte in digest {
        output.push(char::from(HEX[usize::from(byte >> 4)]));
        output.push(char::from(HEX[usize::from(byte & 0x0f)]));
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_heading_paths_and_sibling_reset_are_tracked() {
        let extracted = extract(
            b"intro\n# Grading\nbody\n## Formula\nrule\n# Results\nanswer",
            DocumentKind::Markdown,
        )
        .expect("valid markdown");
        assert_eq!(
            extracted
                .sections
                .iter()
                .map(|section| section.location.as_str())
                .collect::<Vec<_>>(),
            ["Introduction", "Grading", "Grading > Formula", "Results"]
        );
    }

    #[test]
    fn text_extracts_single_text_section() {
        let extracted = extract(b"hello", DocumentKind::Text).expect("valid text");
        assert_eq!(extracted.sections[0].location, "Text");
    }

    #[test]
    fn chunks_obey_size_overlap_and_section_boundaries() {
        let sections = [
            Section {
                text: "alpha beta gamma delta epsilon zeta eta theta".into(),
                location: "A".into(),
            },
            Section {
                text: "one two three four five six".into(),
                location: "B".into(),
            },
        ];
        let chunks = chunk(&sections, 3, 1);
        assert!(
            chunks
                .iter()
                .all(|item| item.token_count <= 3 && !item.location.is_empty())
        );
        assert!(chunks.windows(2).any(|pair| {
            pair[0].location == pair[1].location
                && pair[1]
                    .text
                    .split_whitespace()
                    .any(|word| pair[0].text.split_whitespace().last() == Some(word))
        }));
        assert!(chunks.iter().any(|item| item.location == "B"));
    }

    #[test]
    fn fingerprint_is_stable_sha256() {
        assert_eq!(
            fingerprint(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn docx_is_unsupported_and_empty_text_has_no_chunks() {
        assert!(matches!(
            extract(b"", DocumentKind::Docx),
            Err(IngestError::Unsupported("Word"))
        ));
        assert!(
            chunk(
                &[Section {
                    text: " \n\n ".into(),
                    location: "Empty".into()
                }],
                TARGET_TOKENS,
                OVERLAP_TOKENS
            )
            .is_empty()
        );
    }
}
