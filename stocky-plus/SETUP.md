# Stocky++ — Getting Started

The app code is complete. These steps wire up the environment this machine
still needs.

## 1. Install infrastructure tools

This Mac currently has neither Docker nor Homebrew. Install one of:

**Option A — Docker Desktop** (recommended; matches `docker-compose.yml`)

1. Download from https://www.docker.com/products/docker-desktop/
2. Open Docker Desktop, wait until it is running
3. From this directory:

```bash
docker compose up -d
```

**Option B — Homebrew + native Postgres/Redis**

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
createdb stocky_plus
# Then set DATABASE_URL=postgresql://$(whoami)@localhost:5432/stocky_plus in .env
```

**Option C — Hosted Postgres** (Neon, Supabase, Railway)

Create a free Postgres database, paste the connection string into `.env` as
`DATABASE_URL`, and still run Redis locally (or use Upstash for Redis).

## 2. Apply the database schema

```bash
cp .env.example .env   # if needed
npx prisma migrate deploy
npx prisma generate
npm run db:seed        # optional demo supplier
```

## 3. Link the Shopify Partner app

```bash
shopify auth login
shopify app config link   # creates or links a Partner app
```

Create a **development store** in [partners.shopify.com](https://partners.shopify.com)
(Stores → Add store). Do not use your live business store yet.

## 4. Run the app

Two terminals:

```bash
npm run dev       # Shopify CLI + tunnel + embedded app
npm run worker    # BullMQ: webhooks, ABC cron, catalog sync
```

Open the app from the Shopify admin of your **dev store**, then click
**Sync catalog** on the dashboard (or wait for the after-auth enqueue).

## 5. Push to GitHub

This repo has no `origin` remote yet. Create a GitHub repository, then:

```bash
# from the git root (/Users/Odoo/Documents today)
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin cursor/stocky-plus-inventory-app
```

Or paste the repo URL into Cursor chat and ask to push.
