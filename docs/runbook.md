# Kanbax Local Development Runbook

This guide helps you get Kanbax running end-to-end on your local machine.

## Prerequisites
- Node.js (v18+)
- pnpm (v8+)
- Docker & Docker Compose

## 1. Start Infrastructure
Start the PostgreSQL database using Docker Compose:

```bash
docker compose up -d
```

## 2. Environment Setup
Create a `.env` file in the root directory (if not present) and add the following:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/kanbax?schema=public"
```

## 3. Database Initialization
Generate the Prisma client and run migrations:

```bash
# From the root
pnpm --filter @kanbax/infrastructure exec prisma generate
pnpm --filter @kanbax/infrastructure exec prisma migrate dev --name init
```

## 4. Seed Data
Populate the database with sample data (Tenant, Admin, Tasks):

```bash
pnpm --filter @kanbax/infrastructure exec prisma db seed
```

## 5. Start Applications

### Start API
```bash
pnpm --filter @kanbax/api dev
```

### Start UI
```bash
pnpm --filter @kanbax/ui dev
```

The UI will be available at `http://localhost:3000`.

## UI Development Notes
- **Tenant Selection**: In the current dev version, the tenant is hardcoded to `Acme Corp` (ID: `acme-corp`) in `App.tsx`.
- **Principal Selection**: The UI uses a stubbed admin principal (`admin-user-1`) for all read operations.
- **Read-only**: The UI is strictly read-only. No "Create" or "Edit" buttons are present.

## Troubleshooting
- **Database Connection**: Ensure Docker is running and port 5432 is not occupied.
- **Prisma Errors**: If you change the schema, remember to run `prisma generate` and `prisma migrate dev`.
