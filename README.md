# PulseLine BFF — Real-Time Operational Telemetry & AI Incident Triage Platform

A real-time operational telemetry and AI-assisted failure triage platform for hardware and device validation test lines (**DUT — Device Under Test**), built with **NestJS + TypeScript + GraphQL Subscriptions (`graphql-ws`) + PostgreSQL (`pgvector`) + Drizzle ORM** on the Backend-for-Frontend and **React + TypeScript + Apollo Client** on the Operational Dashboard.

---

## Domain Model & Architecture Documentation

- **Ubiquitous Language Glossary**: [`GLOSSARY.md`](./GLOSSARY.md)
- **Architecture Decision Records (ADRs)**:
  - [`docs/adr/0001-vendor-agnostic-ai-and-vector-dimensions.md`](./docs/adr/0001-vendor-agnostic-ai-and-vector-dimensions.md) — Vendor-agnostic AI triage port (`gemini` | `openai` | `ollama` | `mock`) and standardized `vector(768)` embeddings via Matryoshka Representation Learning (MRL).

---

## Monorepo Structure

```text
/
├── GLOSSARY.md
├── docker-compose.yml
├── docs/
│   └── adr/
│       └── 0001-vendor-agnostic-ai-and-vector-dimensions.md
└── apps/
    ├── bff/                  # NestJS + GraphQL (Apollo + graphql-ws) + Drizzle + pgvector + Vercel AI SDK
    │   └── src/
    │       ├── domain/       # Canonical domain contracts and ports (IPulseLineRepository, IAiTriagePort)
    │       ├── db/           # Drizzle schema (vector(768)), Runbooks/Lines seed data & dual Postgres/PGlite repo
    │       ├── ai/           # Triage Agent with Tool Calling + Structured Outputs (Zod) + 768-dim Embeddings
    │       └── telemetry/    # Ingestion, Yield/LineHealthStatus evaluation, Simulator & GraphQL Resolvers
    └── web/                  # React 18 + Vite + TypeScript + Tailwind + Apollo Client (HTTP + WebSocket split link)
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Database (`pgvector`)
You can start PostgreSQL 16 with `pgvector` using Docker:
```bash
npm run db:up
```
> **Zero-Config Resilience**: If Docker is not running on the host machine, the BFF automatically falls back to an in-process PostgreSQL 16 instance (`@electric-sql/pglite`) with the real `vector` (`pgvector`) extension loaded in memory.

### 3. Configure AI Provider (Optional)
Copy `.env.example` to `.env` in the repository root and set `AI_PROVIDER=gemini|openai|ollama|mock` (defaults to `mock`, which executes the real `searchRunbooks` and `getStationRecentRuns` tools against `pgvector` and PostgreSQL using deterministic 768-dimension embeddings).

### 4. Start BFF and Frontend Dashboard
In two separate terminals:
```bash
npm run dev:bff   # GraphQL HTTP & WebSocket server at http://localhost:4000/graphql
npm run dev:web   # React Mission Control Dashboard at http://localhost:5173
```

### 5. Run Tests & Production Builds
```bash
npm run test:bff
npm run build:bff
npm run build:web
```
