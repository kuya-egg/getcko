# Browser mock backend

`vite` in a plain browser (no Tauri) answers every command in `src/lib/getcko.ts` from memory.
`main.tsx` installs it before the first render, only when `import.meta.env.DEV && !isTauri()`.
It never ships in a build and never runs inside the Tauri window.

```sh
node node_modules/vite/bin/vite.js --port 1510 --strictPort --host 127.0.0.1
# open http://127.0.0.1:1510/?screen=knowledge&theme=dark
```

## URL params

| Param | Values | Effect |
|---|---|---|
| `screen` | `agents` (default), `knowledge`, `settings`, `onboarding` | Start screen. `onboarding` forces the full-window flow |
| `theme` | `light`, `dark`, `system` | Theme for this load (read by `initTheme`, not saved) |
| `setup` | `ready` (default), `missing`, `denied`, `loading` | `missing`: chat, embeddings and speech models missing, permissions not asked. `denied`: Accessibility and Screen Recording denied, models ready. `loading`: every component "loading models", then the `engine` event after 2.5 s |
| `empty` | `1` | No agents, no knowledge bases |
| `filipino` | `0` | No Filipino-capable voice (tests `T.agent.noFilipinoVoice`) |
| `slow` | `1` | Every command waits 600 ms (see loading moments) |

The app gates on setup: `missing` and `denied` open onboarding first; press its primary to continue.

## Behavior worth knowing

- **Seed:** knowledge bases Records office, Grade 7 class (one failed scanned PDF), Biology reviewer; agents Office Helper (active), Teacher (Taglish, Filipino voice), Study Buddy. Templates match `src-tauri/src/templates.rs`.
- **File picker** (`pickDocuments()` → `plugin:dialog|open`) cycles: `Leave application guide.pdf` + `HR memo 2026-14.docx` → `Scanned payslip.pdf` → `Org chart.xlsx` → repeat (the repeat is a Duplicate).
- **doc_import** mirrors the Rust pipeline: unsupported extension throws `invalid` (".xlsx files are not supported yet"); same file name in the same knowledge base throws `duplicate`; otherwise returns a `queued` document, then emits `document` events `processing` (0.3 s) → `ready` (2.2 s), or `failed` with "no text found (scanned PDF?)" for names containing "scan".
- **permission_request:** `notAsked` → `granted`. `denied` stays denied on the first ask and turns `granted` on the second (the person flipped it in System Settings, then pressed Check again).
- **ask** emits `turn` events: (`listening`, `transcribing` for voice) → `question` → `thinking` → (`target` null if `screenHelp`) → `answering` → one `sentence` per sentence → `finished`, 350 ms apart. With ready documents attached the answer cites the first one (`[1]`); without, it is `linesFor(lang).dontKnow` with no sources. `stop` emits `cancelled`. With `setup=missing`, ask throws `unavailable`.
- **Latency in the mock is not measured.** `Answer.latency` carries `0` / `null` only to satisfy the type. Never render it.
- Errors are thrown as `{ kind, message }` like the backend, so `src/lib/getcko.ts` turns them into `GetckoError`; show them through `errorCopy()` from `src/app/errors.ts`.
