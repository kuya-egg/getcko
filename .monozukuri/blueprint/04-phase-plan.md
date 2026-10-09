# Phase plan — GetCko

## Phase 1: Local text-question vertical slice (complete)
- id: 1
- intent: Deliver an end-to-end typed question that retrieves local passages, generates a grounded answer, and returns it through the app IPC contract.
- affected: `src-tauri/src/model.rs`, `store/`, `engine/llama.rs`, `pipeline.rs`, `commands.rs`, `src/bindings/`, `src/lib/getcko.ts`
- prereqs: none
- playbook: feature
- risk: medium

## Phase 2: macOS accessibility platform
- id: 2
- intent: Read the focused app's accessible elements and permission status through the shared platform contract on macOS.
- affected: `src-tauri/src/platform/macos.rs`, `platform/mod.rs`, macOS bundle permission configuration
- prereqs: 1
- playbook: feature
- risk: high

## Phase 3: Overlay screen helper
- id: 3
- intent: Show a visible gecko beside a valid target and stream text answers/citations using shared turn events.
- affected: `src/overlay/`, Tauri window/capability configuration, pointer geometry integration
- prereqs: 2
- playbook: feature
- risk: high

## Phase 4: Main window and setup/knowledge/agents UI
- id: 4
- intent: Let users complete setup, manage knowledge bases/documents and create/select editable agents through the typed contract.
- affected: `src/App.tsx`, `src/App.css`, `src/main.tsx`, `src/lib/`, assets and main-window configuration
- prereqs: 1
- playbook: feature
- risk: medium

## Phase 5: Voice interaction
- id: 5
- intent: Capture push-to-talk input, transcribe locally, and speak answer sentences with immediate stop behavior.
- affected: shared microphone, `Transcriber`/`Speaker` engine implementations, model fetch/bundle configuration, voice IPC integration, overlay controls
- prereqs: 3, 4; external dependency: macOS microphone permission configuration
- playbook: feature
- risk: high

## Phase 6: Windows platform and build
- id: 6
- intent: Provide UI Automation snapshots, permission semantics and a packaged Windows app with GPU and CPU fallback while preserving identical IPC behavior.
- affected: `src-tauri/src/platform/windows.rs`, `platform/mod.rs`, Windows build/installer configuration and acceptance evidence
- prereqs: 2, 3, 4, 5
- playbook: feature
- risk: high

## Phase 7: P1 product capabilities
- id: 7
- intent: Add prioritized product behavior: screenshot best-guess fallback, guided tasks, expanded document formats, agent language/voice settings, and measured benchmark reporting.
- affected: paired macOS/Windows `Platform` changes, `pipeline.rs`, `model.rs`, `ingest.rs`, agent UI, benchmark tooling and documentation
- prereqs: 6
- playbook: feature
- risk: high

## Phase order rationale
Phase 1 is the completed thin end-to-end proof across contract, persistence, local inference, pipeline and IPC. macOS accessibility is next because reliable snapshots are the foundation for the main pointing demonstration; overlay follows with a real target boundary. The main window depends only on the working backend and can proceed as a contained UI increment before voice integration. Voice requires the UI and overlay interaction points; Windows then proves the shared platform, voice and packaged runtime on the second OS, with all trait changes paired. P1 breadth follows the complete product path. This ordering lands the smaller usable macOS/UI increments before the higher-risk cross-platform build and P1 expansion; no unnamed external dependency is assumed.
