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

### Delete API Issues (`src/api/documents/delete.ts`)
- **NO AUTHORIZATION CHECK**: Critical security flaw - any authenticated user can delete any document
- **Silent failures**: All operations wrapped in `.catch(() => void 0)` - errors are ignored
- **No ownership validation**: Missing verification that user owns the document
- **Incomplete cleanup**: Vector database deletion is just a TODO comment
- **No audit logging**: Deletion actions aren't tracked for compliance
- **Race conditions**: No locking mechanism for concurrent delete operations

## Files That Need Editing

### 1. Core API Files
- **`src/api/documents/analytics.ts`** - Fix SQL injection, add caching, improve error handling
- **`src/api/documents/publish.ts`** - Implement proper authorization, add audit logging
- **`src/api/documents/delete.ts`** - CRITICAL: Add authorization checks, proper error handling, audit logging

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
// CURRENT (INSECURE) - Publish API
const hasAccess = true; // Placeholder

// CURRENT (CRITICAL) - Delete API
// NO AUTHORIZATION CHECK AT ALL!

// RECOMMENDED (SECURE)
const hasAccess = await checkDocumentPermission(user.id, documentId, 'publish');
const canDelete = await checkDocumentPermission(user.id, documentId, 'delete');
```

### 3. Delete API Critical Security Fix
```typescript
// CURRENT (DANGEROUS)
export async function handler(event: any) {
  const user = extractUser(event);
  if (!user) return { statusCode: 401, body: '...' };
  // MISSING: Check if user owns the document!
  await deleteEverything(documentId);
}

// RECOMMENDED (SECURE)
export async function handler(event: any) {
  const user = extractUser(event);
  if (!user) return { statusCode: 401, body: '...' };
  
  // CRITICAL: Verify ownership before deletion
  const canDelete = await verifyDocumentOwnership(user, documentId);
  if (!canDelete) {
    throw new AccessDeniedError('You do not own this document');
  }
  
  // Log the deletion attempt
  await auditLog('document_delete_attempt', { user, documentId });
  
  await deleteEverything(documentId);
}
```

### 4. Input Validation
```typescript
// Add comprehensive validation schemas
const analyticsSchema = Joi.object({
  documentId: Joi.string().uuid().required(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional()
});
```

## Recommended Implementation Strategy

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
| **NO AUTHORIZATION** | **CRITICAL** | **delete.ts** | **35** | **ANY USER CAN DELETE ANY DOCUMENT** |
| SQL Injection | HIGH | analytics.ts | 65 | Data breach, unauthorized access |
| Missing AuthZ | HIGH | publish.ts | 58 | Unauthorized document publishing |
| Silent Failures | HIGH | delete.ts | Multiple | Data loss, incomplete cleanup |
| No Input Validation | MEDIUM | All files | Multiple | Data corruption, DoS |
| Information Disclosure | MEDIUM | All files | Error handling | Sensitive data exposure |

## Performance Issues

- **Analytics queries**: No caching, every request hits Athena ($$$)
- **DynamoDB calls**: No connection pooling or retry logic
- **Synchronous processing**: Blocking operations without optimization
- **No pagination**: Large result sets can cause timeouts
- **Delete operations**: No batching, sequential S3 deletions are slow

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

## CRITICAL DELETE API SECURITY ALERT

**🚨 IMMEDIATE ACTION REQUIRED 🚨**

The delete API has a **CRITICAL SECURITY VULNERABILITY**:

### The Problem
```typescript
// Current delete.ts implementation
export async function handler(event: any) {
  const user = extractUser(event);
  if (!user) return { statusCode: 401 };
  
  // ❌ MISSING: No check if user owns the document!
  // ❌ ANY authenticated user can delete ANY document!
  
  await deleteEverything(documentId);
}
```

### Impact
- **Any authenticated user can delete any document in the system**
- **No audit trail of who deleted what**
- **Silent failures hide data corruption**
- **Potential for malicious mass deletion**

### Immediate Fix Required
```typescript
// Add this BEFORE any deletion operations
const document = await getDocument(documentId);
if (!document) {
  throw new ValidationError('Document not found');
}

if (document.ownerId !== user.id && !isAdmin(user)) {
  throw new AccessDeniedError('You do not own this document');
}

// Log the deletion for audit
await auditLog('document_deleted', {
  documentId,
  userId: user.id,
  timestamp: new Date().toISOString()
});
```

### Additional Delete API Issues
1. **Silent failures everywhere** - `.catch(() => void 0)` hides real errors
2. **No transaction support** - Partial failures leave system in inconsistent state
3. **Missing vector cleanup** - TODO comment indicates incomplete implementation
4. **No soft delete option** - Hard deletes make recovery impossible
5. **Race condition potential** - No locking for concurrent operations

This API should be **DISABLED IMMEDIATELY** until proper authorization is implemented.
## Quic
k Fix Checklist

### Immediate (Deploy Today)
- [ ] **DISABLE delete API** until authorization is fixed
- [ ] Add document ownership check to delete.ts
- [ ] Add audit logging to all APIs
- [ ] Fix SQL injection in analytics.ts

### Short Term (This Week)
- [ ] Implement proper input validation schemas
- [ ] Add comprehensive error handling
- [ ] Set up Redis caching for analytics
- [ ] Add retry logic for AWS service calls

### Medium Term (This Month)
- [ ] Implement soft delete functionality
- [ ] Add transaction support for delete operations
- [ ] Set up monitoring and alerting
- [ ] Add rate limiting

### Long Term (Next Quarter)
- [ ] API versioning strategy
- [ ] Performance optimization
- [ ] Advanced caching strategies
- [ ] Comprehensive security audit

## Testing Requirements

Before deploying any fixes:
1. **Unit tests** for all authorization logic
2. **Integration tests** with actual AWS services
3. **Security tests** for injection vulnerabilities
4. **Load tests** for performance validation
5. **Audit log verification** tests