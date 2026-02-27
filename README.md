# New Tube

New Tube is a full-stack YouTube-style video platform built with Next.js App Router, Clerk auth, Mux video processing, UploadThing file storage, Drizzle ORM + Postgres, tRPC, and Upstash Workflow.

## Features

- User authentication with Clerk
- Studio area for creating and managing videos
- Mux-based upload, processing, playback, and captions
- Automatic thumbnail + preview generation from Mux assets
- Manual thumbnail upload with UploadThing
- AI workflows for title, description, and thumbnail generation
- Infinite feed and video watch pages
- Rate limiting via Upstash Redis

## Tech Stack

- Next.js 15 + React 19 + TypeScript
- tRPC + TanStack Query
- Drizzle ORM + Neon/Postgres
- Clerk
- Mux
- UploadThing
- Upstash Workflow (QStash) + Upstash Redis
- Tailwind CSS + Radix UI

## Prerequisites

- Node.js 20+
- npm (or bun/pnpm/yarn)
- A Postgres database (Neon works well)
- Accounts/keys for Clerk, Mux, UploadThing, Upstash

## Environment Variables

Create `.env.local` in the project root:

```bash
# Database
DATABASE_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_SIGNING_SECRET=

# Mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SECRET=

# UploadThing
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=

# Upstash Workflow / QStash
QSTASH_TOKEN=
UPSTASH_WORKFLOW_URL=http://localhost:3000

# Upstash Redis (rate limit)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional
VERCEL_URL=
```

## Installation

```bash
npm install
```

## Database Setup

Generate and apply migrations with Drizzle Kit:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Seed categories (optional):

```bash
npx tsx src/scripts/seed-categories.ts
```

## Run Locally

Start app only:

```bash
npm run dev
```

Start app + webhook tunnel (uses configured ngrok URL in `package.json`):

```bash
npm run dev:all
```

Open http://localhost:3000

## Webhooks

- Clerk user webhook: `POST /api/users/webhook`
- Mux video webhook: `POST /api/videos/webhook`

Make sure provider dashboards point to your public URL (ngrok or deployed domain).

## AI Workflows

Triggered from `videos` tRPC procedures:

- `POST /api/videos/workflows/title`
- `POST /api/videos/workflows/description`
- `POST /api/videos/workflows/thumbnail`

These use Upstash Workflow and Gemini (`@google/genai`) to enrich video metadata.

## Project Structure (high level)

```text
src/
  app/                 # App Router routes and API handlers
  components/          # Shared UI components
  db/                  # Drizzle schema and db client
  lib/                 # Integrations (mux, workflow, redis, etc.)
  modules/             # Feature modules (studio, home, videos...)
  trpc/                # tRPC setup and routers
```

## Scripts

- `npm run dev` — start Next.js dev server
- `npm run dev:webhook` — start webhook tunnel command
- `npm run dev:all` — run app + webhook tunnel concurrently
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — run lint checks

## Notes

- This project currently uses Bun in some script commands (`bun run ...`) inside `package.json`; if you do not use Bun, update those scripts to npm equivalents.
- Webhook handlers should remain idempotent because providers may retry deliveries.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
