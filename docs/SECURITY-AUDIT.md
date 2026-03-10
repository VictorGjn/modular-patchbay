# Security Audit Report - Modular Patchbay

**Date:** March 11, 2026  
**Auditor:** AI Security Audit Agent  
**Codebase:** Modular Patchbay (Context Engineering IDE for AI Agents)  
**Version:** 0.1.0  

## Executive Summary

This security audit examined the Modular Patchbay codebase for potential security vulnerabilities across API key exposure, server-side vulnerabilities, OAuth security, MCP server security, frontend security, and dependency vulnerabilities. The audit identified **2 CRITICAL**, **3 HIGH**, **2 MEDIUM**, and **3 LOW** severity issues that require immediate attention.

## Critical Findings (CRITICAL)

### 1. Path Traversal in Knowledge Routes (CRITICAL)
**File:** `server/routes/knowledge.ts`  
**Lines:** 84-118, 150-185  
**Issue:** The application validates paths using a basic check (`path.includes('..')`) which can be bypassed using URL encoding, double encoding, or other path traversal techniques. While there is an allowlist mechanism, the path validation is insufficient.

**Evidence:**
```typescript
function isPathSafe(targetPath: string, allowedDirs: string[]): boolean {
  if (targetPath.includes('..')) return false; // Insufficient validation
  const resolved = resolve(targetPath).toLowerCase();
  return allowedDirs.some((dir) => resolved.startsWith(dir.toLowerCase()));
}
```

**Impact:** Attackers could potentially access files outside the allowed directories using sophisticated path traversal techniques.  
**Recommendation:** Implement proper path canonicalization and validation using Node.js path utilities, add null byte checks, and validate against the canonicalized allowed directories.

### 2. Command Injection in MCP Manager (CRITICAL)
**File:** `server/mcp/manager.ts`  
**Lines:** 87-96  
**Issue:** The MCP manager accepts user-controlled command and arguments that are passed directly to `StdioClientTransport` without proper sanitization.

**Evidence:**
```typescript
const transport = new StdioClientTransport({
  command: conn.config.command,        // User-controlled
  args: conn.config.args,             // User-controlled
  env: { ...process.env, ...conn.config.env }  // User-controlled env vars
});
```

**Impact:** Malicious MCP server configurations could execute arbitrary commands on the host system.  
**Recommendation:** Implement a strict allowlist of permitted MCP server executables, validate and sanitize all arguments, restrict environment variables, and consider running MCP servers in sandboxed environments.

## High Severity Findings (HIGH)

### 3. Missing OAuth State Parameter Validation (HIGH)
**File:** `server/services/mcpOAuth.ts`  
**Lines:** 149-179  
**Issue:** While the OAuth implementation uses PKCE and state parameters, the state parameter validation is minimal and stored in an in-memory Map without proper expiration or size limits.

**Evidence:**
```typescript
const pendingFlows = new Map<string, PendingFlow>(); // In-memory, unbounded
// Only basic cleanup every 10 minutes
if (Date.now() - v.createdAt > 600_000) pendingFlows.delete(k);
```

**Impact:** Potential CSRF attacks and memory exhaustion through state flooding.  
**Recommendation:** Implement secure state storage with proper expiration, size limits, and additional CSRF protections.

### 4. Insecure Token Storage (HIGH)
**File:** `server/services/mcpOAuth.ts`  
**Lines:** 258-263  
**Issue:** OAuth tokens are stored in plain text JSON files without encryption or proper access controls.

**Evidence:**
```typescript
const TOKEN_FILE = join(DATA_DIR, 'mcp-tokens.json');
// Tokens stored as plain JSON
await saveJson(TOKEN_FILE, tokens);
```

**Impact:** Token compromise if the filesystem is accessed by attackers.  
**Recommendation:** Encrypt tokens at rest, implement proper file permissions (600), and consider using OS credential stores.

### 5. Known Dependency Vulnerabilities (HIGH)
**Source:** npm audit output  
**Issue:** Multiple high-severity vulnerabilities in dependencies:
- `@hono/node-server` - Authorization bypass (GHSA-wc8c-qw6v-h7f6)
- `express-rate-limit` - IPv4-mapped IPv6 bypass (GHSA-46wh-pxpv-q5gq)  
- `hono` - Multiple vulnerabilities including arbitrary file access (GHSA-q5qw-h33p-qvwr)

**Impact:** Various attack vectors including authentication bypass and arbitrary file access.  
**Recommendation:** Run `npm audit fix` immediately and establish a process for regular dependency updates.

## Medium Severity Findings (MEDIUM)

### 6. Insufficient Rate Limiting Implementation (MEDIUM)
**File:** `server/index.ts`  
**Lines:** 47-62  
**Issue:** Custom in-memory rate limiter can be bypassed and doesn't properly handle IPv6 addresses or proxy headers.

**Evidence:**
```typescript
const ip = req.ip || 'unknown'; // Doesn't handle X-Forwarded-For
const ipHits = new Map<string, { count: number; resetAt: number }>(); // In-memory only
```

**Impact:** Rate limit bypass and potential DoS attacks.  
**Recommendation:** Use a proven rate limiting library like `express-rate-limit` (after patching), implement proper IP detection with proxy headers, and consider distributed rate limiting for production.

### 7. Missing Input Validation on Several Endpoints (MEDIUM)
**Files:** `server/routes/repo-index.ts`, `server/routes/knowledge.ts`  
**Issue:** Several API endpoints accept user input without proper validation or sanitization.

**Example:**
```typescript
// repo-index.ts - GitHub URL validation is minimal
if (!url.includes('github.com') && !url.endsWith('.git')) {
  // Insufficient validation
}
```

**Impact:** Potential injection attacks and unexpected application behavior.  
**Recommendation:** Implement comprehensive input validation using schema validation libraries like Zod, validate all user inputs, and sanitize data before processing.

## Low Severity Findings (LOW)

### 8. Information Disclosure in Error Messages (LOW)
**Files:** Multiple route files  
**Issue:** Detailed error messages may expose internal paths and system information.

**Evidence:**
```typescript
error: err instanceof Error ? err.message : String(err)
```

**Impact:** Information leakage that could aid attackers.  
**Recommendation:** Implement generic error messages for production and log detailed errors server-side only.

### 9. Missing Security Headers (LOW)
**File:** `server/index.ts`  
**Lines:** 40-46  
**Issue:** While basic security headers are implemented, some important security headers are missing.

**Current headers:**
```typescript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Referrer-Policy', 'no-referrer');
res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
```

**Missing:** Content-Security-Policy, Strict-Transport-Security (for HTTPS), X-XSS-Protection  
**Impact:** Reduced defense against various client-side attacks.  
**Recommendation:** Implement comprehensive security headers using a library like helmet.js.

### 10. Moderate Dependency Vulnerability (LOW)
**Package:** `dompurify 3.1.3 - 3.3.1`  
**Issue:** Cross-site Scripting vulnerability (GHSA-v2wj-7wpq-c8vv)  
**Impact:** Potential XSS if DOMPurify is used for user content sanitization.  
**Recommendation:** Update DOMPurify to the latest version.

## Positive Security Findings

1. **No hardcoded API keys or secrets found** in the codebase
2. **Proper .gitignore configuration** excludes sensitive files
3. **PKCE implementation** in OAuth flow provides good protection against authorization code interception
4. **File size limits** implemented for file uploads (1MB limit)
5. **Basic CORS configuration** restricts origins to localhost during development
6. **No dangerous React patterns** found (no dangerouslySetInnerHTML usage in application code)

## Recommendations Summary

### Immediate Actions (Critical/High)
1. **Fix path traversal vulnerability** in knowledge routes
2. **Implement MCP command validation and sandboxing**
3. **Encrypt OAuth tokens at rest**
4. **Update all vulnerable dependencies** via `npm audit fix`
5. **Strengthen OAuth state management**

### Short Term (Medium)
1. **Replace custom rate limiter** with proven solution
2. **Implement comprehensive input validation**
3. **Add missing security headers**

### Long Term (Low)
1. **Implement centralized error handling** with safe error messages
2. **Regular security dependency audits**
3. **Consider implementing CSP headers**

## Risk Assessment

**Overall Risk Level:** HIGH  
**Most Critical Attack Vector:** Command injection via malicious MCP server configurations  
**Recommended Timeline:** Address critical issues within 48 hours, high severity within 1 week.

---

**Next Steps:**
1. Prioritize fixing critical vulnerabilities immediately
2. Establish automated dependency scanning in CI/CD pipeline  
3. Consider engaging a professional penetration testing service
4. Implement security-focused code review practices

*This audit was performed using static analysis techniques. A dynamic security assessment is recommended for comprehensive coverage.*