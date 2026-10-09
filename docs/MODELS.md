# GetcKo models and measured numbers

Stub. The backend owner fills this in from the speed-test script (see `docs/getcko-prd-v1.md`, "Local AI" section). Until a number here is measured, it is **TBD**, and no screen, slide or video frame may show it. A beat that needs a TBD number is cut.

Demo machine: MacBook Pro M4 Pro, Wi-Fi off.

## Models (locked Oct 9, 7:15 PM, per the PRD)

| Job | Model | Fallback | License | Measured on M4 Pro |
|---|---|---|---|---|
| Chat, element picking, citations | Gemma 4 E2B, 4-bit, thinking off | Qwen3-4B | Check Gemma terms before disclosing | TBD, measure on M4 Pro |
| Vision fallback (screenshot) | Gemma 4 E2B vision (same model) | UI-TARS-1.5-7B (P1 only) | Same as above | TBD, measure on M4 Pro |
| Embeddings (RAG) | EmbeddingGemma-300m, 256 dims | multilingual-e5-small | Check the model card | TBD, measure on M4 Pro |
| Vector search | sqlite-vector, exact search | | Check terms | TBD, measure on M4 Pro |
| Speech-to-text | whisper.cpp (`whisper-rs`), size by latency | Apple on-device speech | MIT | TBD, measure on M4 Pro |
| Text-to-speech | OS voices via the Rust `tts` crate | Kokoro-82M | | TBD, measure on M4 Pro |

## Numbers the UI and the demo may show

Fill each row with the value, how it was measured and the commit. Show in Geist Mono with "on this Mac".

| Metric | Value | How measured |
|---|---|---|
| Question to first spoken word | TBD, measure on M4 Pro | |
| Chat tokens per second | TBD, measure on M4 Pro | |
| Time to first token | TBD, measure on M4 Pro | |
| 20-page PDF to Ready | TBD, measure on M4 Pro | |
| Bytes sent over the network | TBD, measure on M4 Pro | |
