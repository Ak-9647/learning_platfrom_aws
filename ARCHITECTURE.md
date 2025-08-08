# Architecture Document – Cursor Integration for Interactive Learning Platform

## High-Level Architecture
The integration of Cursor does not alter the core architecture of the Interactive Learning Platform, but adds an **AI-assisted development workflow**.

### Core Platform Architecture (unchanged)
React SPA → API Gateway → AWS Lambda → Step Functions → Bedrock/Textract/Comprehend → DynamoDB/S3/OpenSearch  
WebSocket API for real-time updates  
Kinesis → Firehose → S3 Data Lake → Athena/QuickSight for analytics

### Cursor Integration Architecture
```
Developer
   ↓
Cursor (plan + diff)
   ↓
Review & Approval
   ↓
CI/CD (build, test, lint, deploy)
   ↓
Staging / Production
```
- Cursor acts as a **pre-development assistant**.
- No direct write access to production; all changes flow through PR review.

## Components Added
- **Cursor.md**: Operating guide for AI in repo.
- **Security & Compliance Filters**: Automated checks for secrets, PII, and architecture boundaries.
- **Test Enforcement Hooks**: Blocks merge if coverage < 80% for modified files.

## Deployment Considerations
- No changes to runtime infrastructure.
- Cursor operates in development environments only.
- All PR merges trigger standard AWS CDK deployment pipeline.

## Scalability & Performance
- Cursor integration has negligible runtime performance impact.
- Developer throughput expected to improve via faster iteration cycles.
