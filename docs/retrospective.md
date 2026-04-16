# Project Retrospective: Zetheta Evaluation Platform

## 🌟 What Went Well
- **Microservices Orchestration:** Successfully isolated Authentication, Evaluation, and Messaging into decoupled services that communicate via high-performance channels (Redis/BullMQ).
- **Secure Token Handoff:** The RS256 cross-app token system works seamlessly, allowing candidates to move from the portal to the specific assessment engine securely.
- **Developer Experience:** The monorepo structure with shared types and configs allowed for rapid development of multiple Next.js apps with a consistent look and feel.
- **Observability:** Integrating Pino and Prometheus early ensured that the system is ready for production-level monitoring.

## 🚧 Challenges
- **Monorepo Dependency Ghosting:** Matching lockfiles across the monorepo when updating `package.json` in sub-packages required diligent cache clearing and `--no-frozen-lockfile` runs.
- **Docker Relative Paths:** Configuring Next.js `standalone` mode within a monorepo setup required careful management of `build args` and relative directory offsets in Dockerfiles.
- **State Management:** Keeping the real-time funnel counts in sync with the WebSocket broadcast without over-fetching initial data required a solid client-side state strategy.

## 🚀 Lessons Learned
- **Plan for Redis early:** Redis is the glue of this architecture (Queue, Rate Limiting, Pub/Sub). Centralizing the Redis connection logic or ensuring consistent ENV naming is crucial.
- **Shared UI is a superpower:** Having the `@zetheta/ui` package and a shared `globals.css` drastically reduced the time needed to build the Assessment Engine and Employer Dashboard while maintaining brand consistency.

## 💎 Future Improvements
- **Automated Deployments:** Implement a CI/CD pipeline using GitHub Actions to build and push Docker images to a registry.
- **Pluggable Evaluation Engines:** Refactor the `evaluation-worker` to support multiple test types (coding, video, essay) via a strategy pattern.
- **Full k8s support:** Migrate from Docker Compose to Kubernetes for better auto-scaling of workers during high-traffic assessment events.
