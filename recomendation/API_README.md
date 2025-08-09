# API Implementation Issues & Recommendations

## Current API Problems

The existing APIs in `/src/api/documents/` have several critical security and reliability issues:

### Analytics API Issues (`src/api/documents/analytics.ts`)
- **SQL Injection vulnerability**: Direct string interpolation in query building
- **No caching**: Every request hits Athena, causing performance issues
- **Hard-coded timeouts**: Fixed 60-second polling with no configuration
- **Missing input validation**: Date parameters not validated
- **Poor error handling**: Generic error messages lose debugging context

### Publish API Issues (`src/api/documents/publish.ts`)
- **Incomplete authorization**: Placeholder logic (`hasAccess = true`)
- **Missing user validation**: No verification of document ownership
- **Token collision risk**: No uniqueness check for generated share tokens
- **No audit logging**: Publishing actions aren't tracked
- **Configuration dependency**: Missing environment variable validation

## Files That Need Editing

### 1. Core API Files
- **`src/api/documents/analytics.ts`** - Fix SQL injection, add caching, improve error handling
- **`src/api/documents/publish.ts`** - Implement proper authorization, add audit logging

### 2. New Files Needed
- **`src/api/middleware/auth.ts`** - Centralized authentication middleware
- **`src/api/middleware/validation.ts`** - Input validation schemas
- **`src/api/utils/cache.ts`** - Redis/ElastiCache integration
- **`src/api/utils/audit.ts`** - Audit logging utilities

### 3. Configuration Files
- **`package.json`** - Add dependencies: `joi`, `redis`, `aws-lambda-powertools`
- **Environment variables** - Add proper validation and documentation

## Critical Security Fixes Needed

### 1. SQL Injection Prevention
```typescript
// CURRENT (VULNERABLE)
const conditions = [`document_id = '${documentId.replace(/'/g, "''")}'`];

// RECOMMENDED (SAFE)
const conditions = [`document_id = ?`];
// Use parameterized queries or proper escaping library
```

### 2. Authorization Implementation
```typescript
// CURRENT (INSECURE)
const hasAccess = true; // Placeholder

// RECOMMENDED (SECURE)
const hasAccess = await checkDocumentPermission(user.id, documentId, 'publish');
```

### 3. Input Validation
```typescript
// Add comprehensive validation schemas
const analyticsSchema = Joi.object({
  documentId: Joi.string().uuid().required(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional()
});
```## Re
commended Implementation Strategy

### Phase 1: Security Hardening (CRITICAL)
1. **Fix SQL injection** - Replace string interpolation with parameterized queries
2. **Implement proper authorization** - Add user permission checks
3. **Add input validation** - Use schema validation for all endpoints
4. **Secure error handling** - Prevent information disclosure

### Phase 2: Performance & Reliability
1. **Add caching layer** - Redis for analytics queries
2. **Implement retry logic** - Exponential backoff for AWS calls
3. **Add circuit breakers** - Prevent cascade failures
4. **Optimize database queries** - Add proper indexing

### Phase 3: Observability & Monitoring
1. **Structured logging** - Use AWS Lambda Powertools
2. **Add metrics** - CloudWatch custom metrics
3. **Audit logging** - Track all publish/unpublish actions
4. **Error tracking** - Integrate with monitoring service

### Phase 4: Advanced Features
1. **Rate limiting** - Prevent API abuse
2. **Request/response caching** - Edge caching with CloudFront
3. **API versioning** - Support backward compatibility
4. **Batch operations** - Bulk analytics queries

## Security Vulnerabilities Summary

| Vulnerability | Severity | File | Line | Impact |
|---------------|----------|------|------|---------|
| SQL Injection | HIGH | analytics.ts | 65 | Data breach, unauthorized access |
| Missing AuthZ | HIGH | publish.ts | 58 | Unauthorized document publishing |
| No Input Validation | MEDIUM | Both files | Multiple | Data corruption, DoS |
| Information Disclosure | MEDIUM | Both files | Error handling | Sensitive data exposure |

## Performance Issues

- **Analytics queries**: No caching, every request hits Athena ($$$)
- **DynamoDB calls**: No connection pooling or retry logic
- **Synchronous processing**: Blocking operations without optimization
- **No pagination**: Large result sets can cause timeouts

## Migration Impact

APIs that will need updates when implementing fixes:
- Frontend analytics dashboard components
- Document sharing functionality
- Mobile app integration
- Third-party webhook consumers
- Monitoring and alerting systems

## Dependencies to Add

```json
{
  "joi": "^17.9.0",
  "redis": "^4.6.0", 
  "@aws-lambda-powertools/logger": "^1.12.0",
  "@aws-lambda-powertools/metrics": "^1.12.0",
  "pg": "^8.11.0"
}
```