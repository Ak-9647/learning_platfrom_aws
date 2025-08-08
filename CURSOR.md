# CURSOR.md

> **Purpose**: Operating guide for building in this repo with **Cursor** (Chat, Composer, and Inline). It defines how the AI should plan, propose diffs, write code, test, and ship safely.

---

## 0) Quick Start

1) **Install**: `npm i`
2) **Build**: `npm run build`
3) **Test**: `npm test`
4) **Deploy** (CDK): `npm run deploy`
5) **Dev loop**: `npm run watch` (code) and optionally `npm run cdk:watch` (infra)

> Architecture recap: React SPA → API Gateway → Lambda → Step Functions → Bedrock/Textract/Comprehend → DynamoDB/S3/OpenSearch; WebSocket for real‑time; Kinesis/Firehose → S3 Lake → Athena/QuickSight.

---

## 1) Cursor Working Agreement

When I ask Cursor to make changes:

- **Always start with a plan** (5–10 lines) + **file tree of proposed edits**.
- Keep PRs **≤ 300 net lines**. If bigger, split by feature flag.
- Prefer **incremental, reversible** changes. Respect existing public contracts.
- Provide **patch‑style diffs** per file in fenced blocks (see format below).
- Include **tests** and **perf notes** (latency numbers) when touching hot paths.
- Do not invent secrets/config; use env vars and `ConfigurationManager`.
- Never log PII or tokens. Use least‑privilege IAM, strong typing, and error mapping.

### Diff Format

Return each file as a separate diff block:

```diff
*** Begin Patch
*** Update File: src/path/to/file.ts
@@
- old code
+ new code
*** End Patch
```

For new files:
```diff
*** Begin Patch
*** Add File: src/new/module.ts
+ // file contents
*** End Patch
```

---

## 2) Non‑Negotiable Requirements

- **Uptime** 99.9% / **Agent latency** ≤2s p50 / **Parse preview** ≤60s typical (≤5min worst‑case >50MB).
- **Privacy**: PII detection/redaction in chat; anonymized analytics; no training on customer data.
- **Security**: TLS 1.2+; KMS at rest; httpOnly cookies; CSRF/XSS mitigations; least‑privilege IAM.
- **Compliance**: GDPR/CCPA delete/export; **WCAG 2.1 AA**.
- **Data Tenancy**: Strong separation by org/creator; no cross‑tenant access.

If a change risks these, **stop and request human review**.

---

## 3) Environment & Configuration

All configuration comes from environment variables. On startup, `ConfigurationManager.loadAndValidateConfig()` **must fail fast** with a helpful list of missing vars.

Required (non‑exhaustive):

```bash
AWS_REGION=
AWS_ACCOUNT_ID=
DOCUMENT_REGISTRY_TABLE=
USER_SESSIONS_TABLE=
USER_PROFILES_TABLE=
ASSESSMENTS_TABLE=
USER_RESPONSES_TABLE=
SESSION_SUMMARIES_TABLE=
RAW_DOCUMENTS_BUCKET=
PROCESSED_CONTENT_BUCKET=
ANALYTICS_DATALAKE_BUCKET=
OPENSEARCH_ENDPOINT=
PGVECTOR_CONNECTION_URL=
COGNITO_USER_POOL_ID=
COGNITO_USER_POOL_CLIENT_ID=
API_BASE_URL=
API_TIMEOUT_MS=2000
BEDROCK_REGION=
BEDROCK_MODEL_ID_CLAUDE=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_EMBEDDING_MODEL=
FF_PARSE_TEXTRACT=1
FF_PARSE_FAST=1
FF_ANALYTICS_REALTIME=1
```

**Never** hardcode secrets or defaults. Use SSM/Secrets Manager via CDK where appropriate.

---

## 4) What to Build Next (Productionalization Roadmap)

Replace mocks per Productionalization Requirements, in this order:

### A) Document Processing (P‑1)
- Implement `PowerPointParserImpl` (node‑pptx or python‑pptx via Lambda Layer) and `PDFParserImpl` (`pdf-parse`/pdfjs) with OCR fallback via **Textract**.
- Orchestrate with **Step Functions**: Fast vs Robust branch; emit progress over WebSocket for >50MB.
- Store parsed JSON in `processed-content-bucket`; images in S3 with deterministic keys. Trigger HITL (A2I) on low confidence.

### B) API Coverage (P‑2)
- `POST /documents/{documentId}/publish` → returns `shareableLink` with access settings.
- `GET /documents/{documentId}/analytics` → real data (Athena) with date range filters.
- `DELETE /documents/{documentId}` → hard delete S3/vectors/Dynamo; deactivate links; idempotent.

### C) Document Editor (P‑3)
- React panels: Slide preview, Goal setting (AI suggestions), Checkpoint marking, Assessment config, Publish.
- Persist goals/checkpoints; generate `StructuredContent` + embeddings.

### D) Real Analytics (P‑4)
- Event writer → **Kinesis** → Firehose → S3 (Parquet) → Athena; WebSocket subscription for realtime.
- Dashboard: completion/time spent/checkpoint performance, FAQs/confusions; export CSV/PDF.

### E) Config/Security/Perf/Observability (P‑5..P‑8)
- Strict config validation; httpOnly cookies; CSRF/XSS; provisioned concurrency; DAX/ElastiCache; CloudWatch metrics + SNS alerts.

### F) Data Migration & Prod Readiness (P‑9..P‑10)
- Migrate mock → real with reversible scripts; feature‑flag cutover; DR and rollback playbooks.

---

## 5) Stable Contracts (Do Not Break Without Versioning)

```ts
export interface DocumentUploadRequest { fileName: string; fileSize: number; contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' | 'application/pdf'; }
export interface DocumentUploadResponse { uploadUrl: string; documentId: string; expiresIn: number; }
export interface ParsedDocument { documentId: string; title: string; slides: Slide[]; metadata: DocumentMetadata; }
export interface Slide { slideNumber: number; title: string; content: string[]; images: ImageReference[]; speakerNotes?: string; }
export interface StructuredContent { documentId: string; goal: string; criticalCheckpoints: number[]; contentGraph: ContentNode[]; vectorEmbeddings: VectorChunk[]; }
export interface InteractionEvent { sessionId: string; timestamp: string; eventType: 'slide_viewed' | 'question_answered' | 'path_adapted' | 'help_requested'; data: Record<string, any>; }
```

If evolution is required, add `v2` types and **dual‑read/dual‑write** until migration complete.

---

## 6) API Endpoints (New/Completed)

- **POST** `/documents/{documentId}/publish` → `{ shareableLink, publishedAt, accessSettings }`
- **GET** `/documents/{documentId}/analytics` → engagement + time series (date filters)
- **DELETE** `/documents/{documentId}` → deep delete + link revocation

Return proper HTTP codes (`400/401/403/404/409/410/429/5xx`). Target p50 ≤2s.

---

## 7) Agent Behavior (LangGraph) – Operational Rules

- On session start: introduce agent, state learning goal, outline journey, sync slide.
- At **critical checkpoints**: ask MCQ/free‑text; score in ≤2s; give tailored feedback; adjust path.
- Adaptation: skip basics for high understanding; offer examples/details/next topic if confused.
- Inactivity: gentle nudge at 3 minutes (then up to two more, 3‑min intervals).
- Safety: PII redaction; anonymized logging; no training on user content.

Tools callable by agent:
```ts
getContent(slideNumber: number): Promise<SlideContent>
askMultipleChoice(question: string, options: string[], correctIndex: number): Promise<UserResponse>
requestHumanIntervention(reason: string): Promise<void>
adaptPath(userUnderstanding: number, preferences: PathPreference[]): Promise<PathUpdate>
```

---

## 8) Coding Standards

- **TypeScript** strict; avoid `any`; explicit return types.
- **Conventional Commits**; small, focused PRs.
- **Structured logging** with correlation IDs; no secrets/PII.
- **Typed errors** mapped to user‑friendly responses.
- **Accessibility**: keyboard nav, ARIA roles, contrast checks.

---

## 9) Testing (Definition of Done)

- **Unit**: parsers, config, agent tools, data models (≥80% coverage on touched files).
- **Integration**: pptx/pdf → JSON pipeline; WebSocket chat happy path.
- **System**: creator + consumer journeys; auth; cross‑browser.
- **Security**: token storage (httpOnly), CSRF/XSS; PII redaction tests.
- **Performance**: p50 ≤2s; parsing ≤60s typical; ≤5min worst‑case for large.
- Include test corpora: clean PPTX, image‑heavy PDF, multilingual, corrupted.

---

## 10) Monitoring & Alerts

CloudWatch namespaces & sample metrics:
- `DocumentProcessing/ProcessingDuration`, `DocumentProcessing/FailureRate`
- `API/ResponseTime`, `API/ErrorRate`
- `Auth/FailureRate`
- `Agent/Confidence`, `Agent/HITLTriggers`
- `Websocket/Reconnections`

SNS alerts thresholds:
- FailureRate > 5% (2 eval) – HIGH
- API p95 > 2000ms (3 eval) – MEDIUM
- Auth failures > 10% (1 eval) – HIGH

---

## 11) Security & Privacy

- Token storage in **httpOnly** cookies (Secure, SameSite).
- CSRF protection (double‑submit or SameSite + anti‑CSRF header).
- Encrypt S3/DynamoDB (KMS). TLS 1.2+ everywhere.
- PII redaction pipeline (Comprehend PII or regex fallback) before storage.
- Tenancy enforcement on every mutation.

---

## 12) Frontend Notes

- Chat‑first UI with synchronized slide/section viewer.
- WebSocket reconnection with backoff; offline queueing for outbound.
- Editor panels: goals, checkpoints, assessments, publish; autosave.
- Re‑engagement prompts at 3/6/9 minutes.

---

## 13) Rollout & Rollback

- **CDK pipeline**: commit → build/test → stage → integration tests → manual gate → prod.
- **Blue‑green**: feature flags; start with small % of traffic; monitor metrics for 30m.
- **Rollback**: flip flags off; revert stack; run data rollback scripts; health checks trigger automatic revert.

---

## 14) Starter Tasks for Cursor

1. Implement `ConfigurationManager` (strict validation + typed getters) and tests.
2. Add `PowerPointParserImpl` & `PDFParserImpl` with Textract fallback; Step Functions wiring; progress events.
3. Implement `POST /documents/{id}/publish` with access controls + link deactivation.
4. Add analytics Kinesis writer; Athena DDL; `GET /documents/{id}/analytics` aggregation.
5. PII redaction middleware for chat; unit tests.
6. React Editor panels (goals, checkpoints, assessments, publish) with autosave.

**When I say "plan"**, respond with: (a) brief plan, (b) file list, (c) open questions, then propose diffs.
