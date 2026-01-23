# Kanbax - Bank-Grade Work Orchestration

Kanbax is a policy-driven, compliant Todo and Work-Orchestration system designed for regulated environments.

## Architectural Principles

### 1. Domain-Driven Design (DDD)
The project is structured into clear layers to ensure separation of concerns and maintainability:
- **Domain**: Core entities, value objects, and domain services.
- **Policy**: Declarative policy engine for access control and behavior.
- **Audit**: Immutable, append-only audit logging.
- **Infrastructure**: External adapters and persistence.
- **API**: Application orchestration layer.

### 2. Policy-First Design
Permissions and behaviors are governed by declarative policies rather than hardcoded logic. Every task must have a `PolicyContext` that defines its scope and rules.

### 3. Compliance by Architecture
- **GDPR (Privacy-by-Design)**: Data minimization is enforced at the adapter level (e.g., email ingestion is metadata-only by default).
- **DORA (Auditability & Resilience)**: Every state-changing action emits an immutable audit event.
- **Provenance**: Every task must have a mandatory `TaskSource` (Manual, Jira, or Email).

## Project Structure

```text
├── apps
│   └── api                 # Backend service
├── packages
│   ├── audit               # Audit logging implementation
│   ├── domain              # Core domain models and interfaces
│   ├── infrastructure      # External adapters (Jira, Email)
│   └── policy              # Declarative policy engine
```

## Core Concepts

### Task
A controlled work unit with mandatory provenance (`TaskSource`) and governance (`PolicyContext`).

### TaskSource
Discriminated union of:
- **Manual**: Created directly in Kanbax.
- **Jira**: Linked to Jira Cloud or Data Center.
- **Email**: Metadata-only ingestion from email.

### PolicyEngine
Evaluates actions against the `PolicyContext` to ensure compliance and security.

### AuditLogger
Ensures every action is recorded in an append-only, immutable log.

## OKR Hybrid Model UI

Kanbax OKRs are treated as a navigation system rather than a reporting dashboard:

- **Pulse** (`/okr/pulse`): signal-driven view for attention items only.
- **Objective Focus** (`/okr/objective/:id`): confidence-first view with periphery awareness.
- **Strategic Review** (`/okr/review/:id`): guided, step-based check-in.
- **Decision Composer**: slide-over card with governance preview.

Notes:
- Decisions are currently stored in the UI state (TODO: persist via API).
- Legacy OKR screen is behind a dev flag: set `localStorage.kanbax-okr-legacy = "1"`.

## Getting Started

1. Install dependencies: `npm install`
2. Build the project: `npm run build`
# kanbax
