# ADR 0003: Platform trait is the only OS seam

- Status: accepted
- Date: 2026-10-09
- Deciders: GetCko team

## Context
BR-15 and BR-20 require valid snapshot element targets and accurate display coordinates. The app must present identical commands and behavior on macOS and Windows; the operating systems expose different accessibility APIs and permission semantics.

## Options considered
1. One Rust `Platform` trait with macOS and Windows implementations and shared conformance checks — OS differences remain behind a contract / both implementations must evolve together.
2. OS-specific IPC and UI behavior — direct access to native APIs / duplicates product behavior and risks different command contracts and guarantees.

## Decision
Use the `Platform` trait as the sole operating-system seam. Keep OS implementations in `platform/macos.rs` and `platform/windows.rs`; require both sides to satisfy the same `platform::conformance` checks whenever the trait changes.

## Why this one
It preserves identical IPC and product behavior while allowing native accessibility and permission mechanisms underneath. Conformance makes parity observable rather than relying on informal expectations.

## Tradeoffs and consequences
Shared trait changes require coordinated updates on both operating systems in the same change. No OS-only command or user-visible behavior is permitted; permissions may report platform-appropriate statuses through the shared model.
