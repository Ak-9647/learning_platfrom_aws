# Task List (.d)

Note: Derived from `ARCHITECTURE.md`, `CURSOR.md`, `DESIGN.md`, and `PRD.md`. Keep PRs ≤300 net lines, include tests, respect stable contracts, and never hardcode secrets.

## Now (P‑1 to P‑3)
- [ ] Configuration Manager
  - [ ] Implement `ConfigurationManager.loadAndValidateConfig()` with strict env var validation and typed getters
  - [ ] Document required env vars (from `CURSOR.md` §3)
  - [ ] Unit tests (≥80% coverage on touched files)

- [ ] Document Processing
  - [ ] Implement `PowerPointParserImpl` (node‑pptx or python‑pptx via Lambda Layer)
  - [ ] Implement `PDFParserImpl` (pdf-parse/pdfjs) with OCR fallback via Textract
  - [ ] Step Functions: Fast vs Robust branch orchestration
  - [ ] WebSocket progress events for files >50MB
  - [ ] Persist parsed JSON and images to S3 with deterministic keys
  - [ ] A2I (HITL) trigger on low confidence
  - [ ] Unit and integration tests with corpora (PPTX, image‑heavy PDF, multilingual, corrupted)

- [ ] API Coverage
  - [ ] POST `/documents/{documentId}/publish` → `{ shareableLink, publishedAt, accessSettings }` with access controls + link deactivation; tests
  - [ ] GET `/documents/{documentId}/analytics` backed by Athena; date range filters; tests
  - [ ] DELETE `/documents/{documentId}` deep delete (S3/vectors/Dynamo), link revocation; idempotent; tests

- [ ] PII Redaction
  - [ ] Chat middleware using Comprehend PII (or regex fallback)
  - [ ] Unit tests to ensure no PII leaks in logs/storage

- [ ] Document Editor (React)
  - [ ] Panels: Slide preview, Goal setting (AI suggestions), Checkpoint marking, Assessment config, Publish
  - [ ] Persist goals/checkpoints; generate `StructuredContent` + embeddings
  - [ ] Autosave + WebSocket sync; accessibility checks (WCAG 2.1 AA)

## Next (P‑4 to P‑6)
- [ ] Real Analytics
  - [ ] Event writer → Kinesis → Firehose → S3 (Parquet) → Athena DDL
  - [ ] Realtime WebSocket subscription for analytics
  - [ ] Dashboard: completion, time spent, checkpoint performance, FAQs/confusions; export CSV/PDF

- [ ] Config/Security/Perf/Observability
  - [ ] Strict config validation on startup; fail fast with missing vars list
  - [ ] httpOnly cookies, SameSite, CSRF protection, XSS mitigations
  - [ ] Provisioned concurrency; caching (DAX/ElastiCache) where applicable
  - [ ] Structured logging with correlation IDs; typed errors → user‑friendly responses
  - [ ] CloudWatch metrics + SNS alerts (thresholds from `CURSOR.md` §10)

## Later (P‑7 to P‑10)
- [ ] Data Migration & Prod Readiness
  - [ ] Migrate mock → real with reversible scripts; feature‑flag cutover
  - [ ] DR and rollback playbooks; blue‑green rollout
  - [ ] Tenancy validation and audits

## Agent Behavior (LangGraph)
- [ ] Implement operational rules: intro flow, goal setting, checkpoints, adaptation logic
- [ ] Tools: `getContent`, `askMultipleChoice`, `requestHumanIntervention`, `adaptPath`
- [ ] Inactivity nudges at 3/6/9 minutes
- [ ] Safety: PII redaction; anonymized logging; tests

## Stable Contracts (Do Not Break)
- [ ] Adhere to interfaces in `CURSOR.md` §5
- [ ] If evolution required, add `v2` types; dual‑read/dual‑write until migration complete

## CI/CD & Testing
- [ ] CI: lint, build, unit/integration/system/security/perf suites
- [ ] Coverage gate ≥80% for modified files; perf p50 ≤2s; parsing ≤60s typical (≤5min worst‑case)
- [ ] CDK pipeline: commit → build/test → stage → integration tests → manual gate → prod

## Monitoring & Alerts
- [ ] CloudWatch namespaces/metrics: `DocumentProcessing/*`, `API/*`, `Auth/*`, `Agent/*`, `Websocket/*`
- [ ] SNS alert thresholds: FailureRate >5% (2 eval), API p95 >2000ms (3 eval), Auth failures >10% (1 eval)

## Compliance & Privacy
- [ ] GDPR/CCPA delete/export flows remain intact
- [ ] Encryption at rest (KMS) and TLS 1.2+ in transit verified
- [ ] Data tenancy enforcement on every mutation

## Frontend Notes
- [ ] Chat‑first UI with synchronized slide/section viewer
- [ ] WebSocket reconnection with backoff; offline queue for outbound
- [ ] Re‑engagement prompts at 3/6/9 minutes

## Developer Experience
- [ ] CONTRIBUTING and PR template enforcing plan + diff format
- [ ] Feature flag framework; small, focused PRs (≤300 lines)
- [ ] Do not log PII/tokens; least‑privilege IAM; environment via SSM/Secrets Manager
