//! Built-in agent templates.
use crate::model::{AgentDraft, AnswerLength, BaseRulesMode, Template, TemplateId};

/// Returns all built-in templates in stable display order.
pub fn all() -> Vec<Template> {
    [
        TemplateId::OfficeHelper,
        TemplateId::Teacher,
        TemplateId::StudyBuddy,
    ]
    .into_iter()
    .map(get)
    .collect()
}

/// Returns the built-in template for `id`.
pub fn get(id: TemplateId) -> Template {
    let (name, instructions, answer_length) = match id {
        TemplateId::OfficeHelper => (
            "Office Helper",
            "Help me use new software at work by explaining where to click and why. Cite the office manual when relevant.",
            AnswerLength::Short,
        ),
        TemplateId::Teacher => (
            "Teacher",
            "Help with DepEd forms and grading. Explain forms clearly and show grade computations step by step, citing the guide.",
            AnswerLength::Normal,
        ),
        TemplateId::StudyBuddy => (
            "Study Buddy",
            "Answer using my notes when available. Quiz me when I ask, and explain concepts clearly.",
            AnswerLength::Normal,
        ),
    };
    Template {
        id,
        draft: AgentDraft {
            name: name.into(),
            description: String::new(),
            instructions: instructions.into(),
            base_rules: BaseRulesMode::Include,
            knowledge_base_ids: Vec::new(),
            answer_length,
            voice_id: None,
            speech_rate: 1.0,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn built_in_template_ids_are_unique_and_names_non_empty() {
        let templates = all();
        let ids: HashSet<_> = templates.iter().map(|template| template.id).collect();
        assert_eq!(ids.len(), templates.len());
        assert!(
            templates
                .iter()
                .all(|template| !template.draft.name.trim().is_empty())
        );
        assert!(
            templates
                .iter()
                .all(|template| get(template.id).id == template.id)
        );
    }
}
