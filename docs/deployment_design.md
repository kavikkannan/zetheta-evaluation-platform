# Deployment Design Document

## 1. Overview

This document describes the local deployment strategy for the distributed candidate evaluation platform. The entire system — frontend applications, backend services, databases, and background workers — is containerized and orchestrated using Docker Compose. This enables a single-command local startup, ensuring reproducible environments for development, testing, and evaluation.

## 2. Deployment Goals

- **Single-Command Startup**: The entire stack must start with `docker compose up --build`.
- **Service Isolation**: Each application and service runs in its own container with clearly defined responsibilities.
- **Horizontal Scalability**: Worker instances can be scaled independently by increasing replica count.
- **Persistent State**: Database data survives container restarts via named volumes.
- **Non-Root Execution**: All service containers run under an unprivileged user for security compliance.

## 3. Docker Compose Topology

```mermaid
graph TD
    DC[Docker Compose Network]
    DC --> PG[(PostgreSQL)]
    DC --> RD[Redis]
    DC --> AG[API Gateway]
    DC --> AS[Auth Service]
    DC --> EW[Evaluation Worker]
    DC --> CP[Candidate Portal]
    DC --> AE[Assessment Engine]
    DC --> ED[Employer Dashboard]
    DC --> WS[WebSocket Server]
```

## 4. Service Definitions

### 4.1 Infrastructure Layer

#### `postgres`

| Property | Value |
|----------|-------|
| Image | `postgres:15-alpine` |
| Port | `5432:5432` |
| Volume | `postgres_data:/var/lib/postgresql/data` |
| Environment | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |

Provides ACID-compliant persistent storage for candidates, applications, questions, responses, scores, and RBAC data.

#### `redis`

| Property | Value |
|----------|-------|
| Image | `redis:7-alpine` |
| Port | `6379:6379` |
| Volume | `redis_data:/data` |

Serves as the message broker for BullMQ evaluation jobs, the pub/sub channel for real-time dashboard updates, and the ephemeral nonce store for cross-application tokens.

### 4.2 Backend Services

#### `api-gateway`

| Property | Value |
|----------|-------|
| Build Context | `./services/api-gateway` |
| Port | `3001:3001` |
| Depends On | `postgres`, `redis` |

Unified ingress for all frontend applications. Handles routing, rate limiting, JWT validation middleware, and request logging.

#### `auth-service`

| Property | Value |
|----------|-------|
| Build Context | `./services/auth-service` |
| Port | `3002:3002` |
| Depends On | `postgres`, `redis` |

Manages user authentication, RS256 token issuance, and RBAC role resolution. Mounts the RSA private key via a Docker secret or bind mount.

#### `evaluation-worker`

| Property | Value |
|----------|-------|
| Build Context | `./services/evaluation-worker` |
| Scale | Default `1`, configurable via `--scale evaluation-worker=N` |
| Depends On | `postgres`, `redis` |

Stateless background worker consuming from the BullMQ `evaluation-queue`. Multiple replicas can be run in parallel to increase throughput.

#### `websocket-server`

| Property | Value |
|----------|-------|
| Build Context | `./services/websocket-server` |
| Port | `3003:3003` |
| Depends On | `redis` |

Bridges Redis Pub/Sub events to persistent WebSocket connections for the Employer Dashboard.

### 4.3 Frontend Applications

#### `candidate-portal`

| Property | Value |
|----------|-------|
| Build Context | `./apps/candidate-portal` |
| Port | `4001:4001` |

Next.js application for candidate login and assessment initiation. Communicates with the API Gateway and Auth Service.

#### `assessment-engine`

| Property | Value |
|----------|-------|
| Build Context | `./apps/assessment-engine` |
| Port | `4002:4002` |

Next.js application rendering the MCQ interface. Validates cross-application tokens locally using the Auth Service public key.

#### `employer-dashboard`

| Property | Value |
|----------|-------|
| Build Context | `./apps/employer-dashboard` |
| Port | `4003:4003` |

Next.js application displaying the real-time candidate funnel. Connects to the WebSocket Server for live updates.

## 5. Network Configuration

All services communicate over a dedicated Docker bridge network:

```yaml
networks:
  zetheta-network:
    driver: bridge
```

Service discovery uses container hostnames (e.g., `postgres`, `redis`, `api-gateway`), eliminating the need for hardcoded IP addresses.

## 6. Environment Configuration

Sensitive and environment-specific values are injected via an `.env` file. A `.env.example` file is committed to the repository as a template.

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/zetheta

# Redis
REDIS_URL=redis://redis:6379

# Auth Service
JWT_PRIVATE_KEY_PATH=/run/secrets/jwt_private_key
JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public_key
JWT_ISSUER=https://zetheta.com
JWT_AUDIENCE=assessment-engine

# API Gateway
PORT=3001
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend Base URLs
CANDIDATE_PORTAL_URL=http://localhost:4001
ASSESSMENT_ENGINE_URL=http://localhost:4002
EMPLOYER_DASHBOARD_URL=http://localhost:4003
```

## 7. Security Considerations

### Non-Root Containers

All service Dockerfiles include a non-root user stage:

```dockerfile
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001
USER nodeuser
```

### Secret Management

The RSA private key is mounted as a Docker secret or read-only bind mount, never baked into the image:

```yaml
secrets:
  jwt_private_key:
    file: ./secrets/jwt_private_key.pem
```

## 8. Startup Order & Health Checks

Docker Compose `depends_on` with `condition: service_healthy` ensures infrastructure services are ready before backends start:

```yaml
services:
  api-gateway:
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
```

### Postgres Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
  interval: 5s
  timeout: 5s
  retries: 5
```

## 9. Scaling Workers

To increase evaluation throughput, run additional worker instances:

```bash
docker compose up --build --scale evaluation-worker=3
```

BullMQ distributes jobs across all connected worker instances automatically.

## 10. Local Development Workflow

### Start the Entire Stack

```bash
docker compose up --build
```

### Run Migrations

```bash
docker compose exec api-gateway npx prisma migrate deploy
```

### View Logs

```bash
docker compose logs -f evaluation-worker
```

### Teardown

```bash
docker compose down -v
```

The `-v` flag removes named volumes (use with caution in production-like environments).

## 11. Cloud Deployment Options (Bonus)

While Docker Compose is the mandatory local deployment target, the following platforms are acceptable for production-like hosting:

| Platform | Suitable For |
|----------|--------------|
| **Google Cloud Platform (GCP)** | Full infrastructure deployment (Cloud Run, GKE, Cloud SQL, Memorystore) |
| **AWS** | Full infrastructure deployment (ECS/EKS, RDS, ElastiCache) |
| **Vercel** | Frontend applications (Next.js native support) |
| **Render** | Frontend and API services |

If deployed to any cloud platform, the live URL must be documented in the root `README.md`.

## 12. Conclusion

The Docker Compose-based deployment provides a secure, reproducible, and scalable local environment for the evaluation platform. With a single startup command, all services, databases, and real-time infrastructure are brought online, satisfying the assignment's deployability requirements and establishing a clean path toward cloud-hosted production deployments.
