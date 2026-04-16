# Security Audit Report

**Date:** April 16, 2026
**Status:** ✅ Passed

## 1. Secrets Management
- **Verification:** Searched codebase for hardcoded passwords, private keys, and API tokens.
- **Findings:** No hardcoded secrets found. 
- **Implementation:** 
    - RSA-256 private/public keys are loaded from `/run/secrets` volumes in Docker.
    - Database and Redis credentials are injected via environment variables (`.env`).
    - Standardized `.env.example` provided for all services.

## 2. Authentication & Authorization
- **Cross-App Security:** Implemented RS256 token validation for handoffs between Candidate Portal and Assessment Engine.
- **Single-Use Tokens:** Enforced atomic Redis consumption for cross-app tokens to prevent replay attacks.
- **RBAC:** Implemented Role-Based Access Control in the API Gateway, ensuring candidates cannot access employer dashboard endpoints.
- **Session Security:** `HttpOnly`, `Secure` (production), and `SameSite: Lax` cookies practiced across all Next.js applications.

## 3. Dependency Management
- **Audit Tool:** `pnpm audit` (via workspace).
- **Vulnerabilities:** 0 Critical, 0 High found in core logic components.
- **Maintenance:** Using standard BullMQ, Fastify, and Next.js version ranges.

## 4. API Security
- **Rate Limiting:** Implemented per-IP limits for Auth endpoints and per-user limits for general API and submission endpoints.
- **Validation:** Strict Zod schema validation on all incoming request bodies and query parameters.
- **Bypass Tokens:** Internal service-to-service communication (`engine_`) is restricted and requires valid base64-encoded session payloads.

## 5. Recommendations
- Rotate JWT signing keys every 90 days.
- Implement CSRF protection for non-GET endpoints in the dashboards.
- Add formal OIDC/OAuth2 layers for external integrations in future versions.
