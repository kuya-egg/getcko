# ADR 0002: Single-file SQLite and sqlite-vector

- Status: accepted
- Date: 2026-10-09
- Deciders: GetCko team

## Context
BR-2 keeps documents, passages and agents on the user's computer; BR-9 calls for top-five semantic retrieval. The current implementation stores relational state and vector data locally in SQLite, using vendored sqlite-vector 1.1.2 exact full scan.

## Options considered
1. One SQLite file plus sqlite-vector exact full scan — transactional relational ownership, local vectors, simple backup/lifecycle / scan cost grows with corpus size.
2. SQLite plus a separate vector database — specialized vector operations / another store and synchronization, backup, and consistency boundary.

## Decision
Keep relational records and vector extension data in one local SQLite file and use exact full scan for retrieval.

## Why this one
It meets local privacy and retrieval needs without adding a second persistence service or coordinating duplicate document/passage lifecycles. Exact scan avoids approximation quality tradeoffs for current workload and provides a straightforward baseline.

## Tradeoffs and consequences
Search work grows with the number of vectors. Keep exact search as baseline; any future indexed/quantized strategy requires measured quality evidence and a deliberate decision. Parent-child referential integrity and cascade behavior remain central to INV-1/2.
