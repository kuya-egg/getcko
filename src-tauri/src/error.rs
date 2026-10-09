//! The one error type that crosses IPC. Commands return `Result<T, AppError>`;
//! the client receives `{ kind, message }`.

use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ErrorKind {
    /// The referenced row does not exist.
    NotFound,
    /// The request breaks a business rule (e.g. more than 5 knowledge bases).
    Invalid,
    /// The same file is already in this knowledge base.
    Duplicate,
    /// A required engine component or OS capability is not available.
    Unavailable,
    /// The user has not granted an OS permission.
    PermissionDenied,
    /// Local database failure.
    Storage,
    /// Model runtime failure.
    Engine,
    /// OS screen-reading failure.
    Platform,
    Io,
}

#[derive(Debug, thiserror::Error, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
#[error("{message}")]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
}

impl AppError {
    #[must_use]
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    #[must_use]
    pub fn not_found(what: &str) -> Self {
        Self::new(ErrorKind::NotFound, format!("{what} not found"))
    }

    #[must_use]
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Invalid, message)
    }

    #[must_use]
    pub fn unavailable(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Unavailable, message)
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        match err {
            rusqlite::Error::QueryReturnedNoRows => Self::new(ErrorKind::NotFound, "row not found"),
            other => Self::new(ErrorKind::Storage, other.to_string()),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::new(ErrorKind::Io, err.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
