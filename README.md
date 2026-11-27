<div align="center">

<br />

<img src="https://img.shields.io/badge/BlitzShip-static%20deployment-6366f1?style=for-the-badge&logoColor=white" alt="BlitzShip" height="40"/>

# ⚡ Blitzship

**From `git push` to live site — in a blitz.**

Connect your GitHub repo, configure your build, and Blitzship handles the rest: cloning, building inside an isolated Docker container, uploading to S3, and serving globally via CloudFront — with a free `*.blitzship.app` subdomain and optional custom domain + SSL.

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3.3-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.8-EF4444?style=flat-square&logo=turborepo&logoColor=white)](https://turbo.build/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![AWS](https://img.shields.io/badge/AWS-S3%20%7C%20SQS%20%7C%20CloudFront-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat-square&logo=clerk&logoColor=white)](https://clerk.com/)
[![Docker](https://img.shields.io/badge/Docker-Isolated%20Builds-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

<br />

</div>

---

## 📖 Table of Contents

- [What is Blitzship?](#-what-is-blitzship)
- [Architecture](#-architecture)
- [How a Deployment Works](#-how-a-deployment-works)
- [Monorepo Structure](#-monorepo-structure)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Build the Docker Builder Image](#build-the-docker-builder-image)
  - [Run the Platform](#run-the-platform)
- [Custom Domains & SSL](#-custom-domains--ssl)
- [Domain Routing (Lambda@Edge)](#-domain-routing-lambdaedge)
- [Environment Variable Encryption](#-environment-variable-encryption)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 What is Blitzship?

Blitzship is a **self-hosted static React deployment platform** — think Vercel, but one you own and understand top-to-bottom. You connect your GitHub account via a GitHub App, pick any repository, provide your build command and output directory, and Blitzship takes over:

1. Queues a build job to SQS
2. Spins up a sandboxed Docker container, clones your repo, installs deps, and runs your build
3. Uploads the output to S3 under a unique deployment ID
4. Serves the site globally through CloudFront at `https://<id>.blitzship.app`
5. Optionally maps a named slug (`yourapp.blitzship.app`) or your own custom domain with auto-provisioned SSL via AWS ACM

Every deployment gets an **automatic visual screenshot** (via Puppeteer) so you can see what shipped at a glance.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│          Next.js 16  ·  Clerk Auth  ·  Tailwind + shadcn/ui     │
└─────────────────────────────┬────────────────────────────────────┘
                              │ HTTPS API calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Primary Backend  (Express 5 / Bun)             │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ /github  │  │ /deploy  │  │ /domain    │  │ /projects   │  │
│  │ webhook  │  │ routes   │  │ routes     │  │ routes      │  │
│  └────┬─────┘  └─────┬────┘  └─────┬──────┘  └──────┬──────┘  │
│       │               │             │                 │         │
│       └───────────────┴─────────────┴─────────────────┘        │
│                             │                                   │
│          ┌──────────────────▼─────────────────┐                 │
│          │       Prisma ORM → PostgreSQL       │                 │
│          └────────────────────────────────────┘                 │
│                             │                                   │
│          ┌──────────────────▼─────────────────┐                 │
│          │      AWS SQS  (Build Job Queue)    │                 │
│          └────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
                              │ Long-poll (20 s)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Build Worker  (Bun)                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │            Docker Container  (node:22-alpine)           │    │
│  │  1. git clone --depth 1 <repo>                         │    │
│  │  2. npm ci                                             │    │
│  │  3. inject .env  (AES-256-GCM decrypted)               │    │
│  │  4. <build_command>  (e.g. npm run build)              │    │
│  │  5. copy artifact → host tmpdir                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │   Upload artifacts → S3 (deployments/<id>/…)           │    │
│  │   Screenshot via Puppeteer → S3 snapshot               │    │
│  │   Update DB: is_build_success, preview_url             │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS CloudFront + S3                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────┐      │
│   │  Lambda@Edge  (Viewer Request)                       │      │
│   │                                                      │      │
│   │  14.blitzship.app  →  /deployments/14/index.html    │      │
│   │  myapp.blitzship.app →  DB lookup slug → rewrite    │      │
│   │  mycorp.com          →  DB lookup domain → rewrite  │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                 │
│               ⤷ S3 Origin: blitzship bucket                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 How a Deployment Works

```
Developer                  Blitzship Platform                       AWS
─────────                  ──────────────────                       ───

  │   git push / click Deploy │                                      │
  │──────────────────────────▶│                                      │
  │                           │  POST /deploy/create-deployment      │
  │                           │  ─ create Deployment row in DB       │
  │                           │  ─ enqueue BuildJob to SQS ─────────▶│
  │                           │                                      │
  │                           │◀─────── Build Worker polls SQS ──────│
  │                           │         (every 5 s, long-poll 20 s)  │
  │                           │                                      │
  │                           │  ─ docker run build-worker:latest    │
  │                           │  ─ git clone → npm ci → build        │
  │                           │  ─ upload dist/* to S3 ─────────────▶│
  │                           │  ─ Puppeteer screenshot ─────────────▶│
  │                           │  ─ update DB (success, preview_url)  │
  │                           │                                      │
  │  ✅ Site live at preview URL │                                   │
  │◀──────────────────────────│                                      │
  │                           │                                      │
  │  Optional: Promote to prod│                                      │
  │──────────────────────────▶│  POST /deploy/mark-production        │
  │                           │  ─ update Domain table               │
  │                           │  ─ Lambda@Edge picks up new mapping  │
```

---

## 📂 Monorepo Structure

This project is a **Turborepo** monorepo managed with **Bun** workspaces.

```
vercel-clone/                        ← repo root
├── apps/
│   ├── frontend/                    ← Next.js 16 dashboard & landing page
│   │   ├── app/
│   │   │   ├── page.tsx             ← Public landing page (BlitzShip homepage)
│   │   │   ├── dashboard/           ← Authenticated project dashboard
│   │   │   ├── login/ signup/       ← Clerk auth pages
│   │   │   ├── github-callback/     ← GitHub App OAuth callback
│   │   │   ├── post-signup/         ← Post-auth onboarding
│   │   │   └── project/             ← Per-project detail view
│   │   └── components/
│   │       └── landing/             ← Hero, domain playground, reveal animations
│   │
│   ├── primary-backend/             ← Express 5 REST API (Bun runtime)
│   │   └── src/
│   │       ├── index.ts             ← App entrypoint, middleware, route mounting
│   │       ├── routes/
│   │       │   ├── deployProject.ts ← Create project / deployment / mark-production
│   │       │   ├── githubRoutes.ts  ← GitHub App OAuth & webhook handler
│   │       │   ├── domainRoutes.ts  ← Platform subdomain management
│   │       │   ├── customDomain.ts  ← Custom domain add/verify/status
│   │       │   └── projectRoutes.ts ← CRUD for projects
│   │       ├── handlers/
│   │       │   ├── acmCertCron.ts   ← Polls ACM cert status, creates CF tenants
│   │       │   └── awsCustomDomain.ts
│   │       ├── middleware/          ← Clerk auth, Zod validation
│   │       ├── schemas/             ← Zod request schemas
│   │       └── services/
│   │           └── triggerDeployment.ts
│   │
│   └── build-worker/                ← SQS consumer & Docker orchestrator (Bun)
│       ├── src/
│       │   ├── index.ts             ← Entrypoint — starts SQS consumer
│       │   ├── sqs-consumer.ts      ← Polls SQS, dispatches build jobs
│       │   ├── docker-builder.ts    ← Spins Docker containers, runs builds
│       │   ├── upload-on-s3.ts      ← Batched parallel S3 upload
│       │   └── snapshot.ts          ← Puppeteer screenshot capture
│       └── docker/
│           └── builder.Dockerfile   ← Sandboxed build image (node:22-alpine)
│
├── packages/
│   ├── db/                          ← Prisma client (shared across apps)
│   │   └── prisma/schema.prisma
│   ├── types/                       ← Shared TypeScript types (BuildJob, etc.)
│   ├── env-crypto/                  ← AES-256-GCM env var encryption/decryption
│   ├── ui/                          ← Shared React component primitives
│   ├── eslint-config/               ← Shared ESLint config
│   └── typescript-config/           ← Shared tsconfig.json bases
│
├── cloudfront-Lambda-function/
│   └── index.mjs                    ← Lambda@Edge viewer-request handler
│
├── turbo.json                       ← Turborepo pipeline definition
├── package.json                     ← Root workspace manifest (Bun)
└── tsconfig.base.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, Radix UI |
| **Auth** | Clerk (GitHub OAuth, session management) |
| **Backend** | Express 5, Bun runtime, Zod validation |
| **Queue** | AWS SQS (long-polling, visibility timeout 900 s) |
| **Build Orchestration** | Docker (`node:22-alpine`), execa, Puppeteer |
| **Storage** | AWS S3 (static assets + deployment snapshots) |
| **CDN** | AWS CloudFront + Lambda@Edge (viewer-request URL rewriting) |
| **Custom Domains** | AWS ACM (SSL), CloudFront Distribution Tenants |
| **Database** | PostgreSQL, Prisma ORM |
| **Monorepo** | Turborepo + Bun workspaces |
| **Language** | TypeScript 5.9 throughout |
| **Secret Management** | AWS SSM Parameter Store (Lambda@Edge DB URL) |
| **Env Encryption** | AES-256-GCM (`@repo/env-crypto`) |

---

## ✨ Features

- 🔗 **GitHub App integration** — connect once, deploy any repo. Auto-deploy on `git push` via webhooks.
- 🐳 **Fully sandboxed builds** — every build runs in an isolated Docker container with memory (`2 GB`) and CPU (`1.5` cores) limits.
- 🌍 **Global CDN delivery** — CloudFront serves your static assets from edge locations worldwide.
- 🔀 **SPA support** — routes without a file extension are automatically served `index.html` for client-side routing.
- 🌐 **Free subdomain** — every deployment gets `https://<id>.blitzship.app`; every project gets `https://<slug>.blitzship.app`.
- 🔒 **Custom domains + auto-SSL** — add your own domain; Blitzship requests an ACM certificate and provisions a CloudFront tenant automatically.
- 📸 **Deployment snapshots** — Puppeteer captures a 1280×800 screenshot of each live deployment for instant visual diff.
- 🔑 **Encrypted environment variables** — project env vars are encrypted at rest with AES-256-GCM and decrypted only inside the build container.
- 🔄 **Self-healing repo references** — the build worker detects repo renames/transfers via GitHub API and heals the database automatically.
- ♻️ **Promote any deployment to production** — roll back or promote a previous deployment to production with one API call.
- ⚡ **Turborepo caching** — incremental builds across the monorepo for fast local development.

---

## 🏁 Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| [Bun](https://bun.sh/) | ≥ 1.3.3 |
| [Node.js](https://nodejs.org/) | ≥ 18 |
| [Docker](https://www.docker.com/) | any recent version |
| [PostgreSQL](https://www.postgresql.org/) | ≥ 14 |
| AWS account | S3, SQS, CloudFront, ACM, Lambda@Edge, SSM |
| [Clerk](https://clerk.com/) account | — |
| [GitHub App](https://docs.github.com/en/apps/creating-github-apps) | — |

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/blitzship.git
cd blitzship

# Install all workspace dependencies
bun install
```

### Environment Variables

Each app has its own `.env` file. Copy the examples and fill in your values:

```bash
cp apps/primary-backend/.env.example apps/primary-backend/.env
cp apps/build-worker/.env.example    apps/build-worker/.env
cp apps/frontend/.env.example        apps/frontend/.env   # if present
```

#### `apps/primary-backend/.env`

```env
# ── Database ──────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/blitzship

# ── GitHub App ────────────────────────────────────────────────────
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=          # multi-line PEM — wrap in quotes
GITHUB_WEBHOOK_SECRET=
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=

# ── AWS ───────────────────────────────────────────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SQS_QUEUE_URL=
CLOUDFRONT_DISTRIBUTION_ID=
CLOUDFRONT_DISTRIBUTION_DOMAIN=  # e.g. xxxxxx.cloudfront.net

# ── Clerk ─────────────────────────────────────────────────────────
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=

# ── Env Var Encryption ────────────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENV_ENCRYPTION_SECRET=
```

#### `apps/build-worker/.env`

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SQS_QUEUE_URL=
DATABASE_URL=postgresql://user:password@localhost:5432/blitzship
PRIMARY_BACKEND_URL=http://localhost:4000

# Must match the same key set in primary-backend
ENV_ENCRYPTION_SECRET=
```

#### `apps/frontend/.env`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Database Setup

```bash
# From the repo root — Prisma is in the shared `db` package
cd packages/db
bunx prisma migrate dev --name init
bunx prisma generate
```

### Build the Docker Builder Image

The build worker orchestrates Docker containers to run user builds in isolation. Build the image once:

```bash
cd apps/build-worker
docker build -f docker/builder.Dockerfile -t build-worker:latest .
```

### Run the Platform

Open three terminals (or use a process manager like `pm2`):

```bash
# Terminal 1 — Primary backend API (port 4000)
cd apps/primary-backend
bun run dev

# Terminal 2 — Build worker (polls SQS)
cd apps/build-worker
bun run dev

# Terminal 3 — Frontend (port 3000)
cd apps/frontend
bun run dev
```

Or run everything from the root with Turborepo:

```bash
bun run dev          # turbo run dev (all apps in parallel)
```

---

## 🌐 Custom Domains & SSL

Blitzship provisions custom domain SSL automatically through AWS ACM:

```
User adds custom domain
        │
        ▼
POST /custom-domain/add
  └─▶ Request ACM certificate (DNS validation)
  └─▶ Store cert_arn in DB (status: PENDING)
        │
        ▼
  ACM Cert Cron Job (runs in primary-backend)
  └─▶ Poll ACM every minute
  └─▶ When ISSUED → create CloudFront Distribution Tenant
  └─▶ Store tenant_id, tenant_arn in DB (status: ACTIVE)
        │
        ▼
  Lambda@Edge routes traffic for custom domain
```

> **Note:** You need to add a CNAME record in your DNS pointing your domain to the CloudFront distribution domain.

---

## 🔀 Domain Routing (Lambda@Edge)

The CloudFront `viewer-request` Lambda handles three URL patterns:

| URL Pattern | Routing Logic |
|---|---|
| `14.blitzship.app` | Subdomain is a numeric deployment ID → rewrite directly |
| `myapp.blitzship.app` | Named slug → DB lookup in `Domain` table → rewrite |
| `mycorp.com` | Custom domain → DB lookup in `CustomDomain` table → rewrite |

All paths rewrite to `/deployments/<id>/path` on the S3 origin. URLs without a file extension are served `index.html` for SPA support.

The Lambda maintains an **in-memory cache** (90 s TTL) per warm container to minimize database round-trips.

---

## 🔑 Environment Variable Encryption

Project environment variables are stored **encrypted at rest** using AES-256-GCM via the `@repo/env-crypto` package.

```
User submits env vars via frontend
        │
        ▼
POST /deploy/create-project
  └─▶ encryptEnvMap(envVars)   ← AES-256-GCM with ENV_ENCRYPTION_SECRET
  └─▶ stores encrypted blob in DB (project_env JSON column)
        │
        ▼
Deployment triggered
  └─▶ decryptEnvMap(project.project_env)
  └─▶ passes plaintext vars inside BuildJob (SQS message)
        │
        ▼
Build worker injects vars into container via docker exec stdin
  └─▶ cat > /workspace/repo/.env   (safe — no shell interpolation)
```

> **Never** log or return `project_env` from API responses — the codebase strips it before sending.

---

## 🗄️ Database Schema

```
┌──────────┐       ┌──────────────┐       ┌───────────┐
│   User   │──────▶│   Project    │──────▶│Deployment │
│          │  1:N  │              │  1:N  │           │
│ id (PK)  │       │ project_id   │       │deploy_id  │
│ email    │       │ name         │       │project_id │
│ name     │       │ github_url   │       │preview_url│
│ github_* │       │ build_cmd    │       │snapshot   │
└──────────┘       │ output_dir   │       │build_logs │
                   │ build_branch │       │is_success │
                   │ primary_dom  │       └───────────┘
                   │ project_env  │
                   │ prod_dep_id──┼──────▶ Deployment (1:1)
                   └──────────────┘

┌──────────────┐       ┌──────────────────────┐
│    Domain    │       │    CustomDomain       │
│ (slug → dep) │       │ (domain → dep)        │
│              │       │                       │
│ domain_url   │       │ domain                │
│ deployment_id│       │ deployment_id         │
└──────────────┘       │ cert_arn (ACM)        │
                       │ tenant_id (CF)        │
                       │ status: PENDING|ACTIVE│
                       └──────────────────────┘
```

---

## 📡 API Reference

All routes require a valid **Clerk session token** in the `Authorization: Bearer <token>` header unless marked public.

### Deployment

| Method | Path | Description |
|---|---|---|
| `POST` | `/deploy/create-project` | Create a new project and provision its primary domain |
| `POST` | `/deploy/create-deployment` | Queue a new build job for an existing project |
| `POST` | `/deploy/mark-production` | Promote a deployment to production |

### Projects

| Method | Path | Description |
|---|---|---|
| `GET` | `/projects` | List all projects for the authenticated user |
| `GET` | `/projects/:id` | Get project details including deployments |
| `DELETE` | `/projects/:id` | Delete a project and all its deployments |

### GitHub

| Method | Path | Description |
|---|---|---|
| `GET` | `/github/repos` | List GitHub repos accessible via the installed GitHub App |
| `GET` | `/github/installation-token` | Generate a short-lived installation token |
| `POST` | `/github/webhook` | Receive push events and trigger auto-deployments *(HMAC verified)* |

### Domains & Custom Domains

| Method | Path | Description |
|---|---|---|
| `GET` | `/domain` | List platform subdomains for a project |
| `POST` | `/custom-domain/add` | Add a custom domain and request ACM cert |
| `GET` | `/custom-domain/status` | Poll cert/tenant provisioning status |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check — returns `{ status: "ok" }` |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to your branch: `git push origin feat/amazing-feature`
5. Open a **Pull Request**

Please ensure your code passes type-checking and linting before submitting:

```bash
bun run check-types   # turbo run check-types
bun run lint          # turbo run lint
bun run format        # prettier --write
```

---

## 📄 License

This project is for educational and personal use. Feel free to fork and adapt it for your own infrastructure.

---

<div align="center">

Built with ⚡ by [Sharman Maheshwari](https://github.com/sharmanmaheshwari)

*BlitzShip — because shipping should be fast.*

</div>
