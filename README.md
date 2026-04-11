# Compliance Tracker

A Next.js app for tracking company compliance obligations.

## Environment Variables

Required environment variables:

- `TURSO_DATABASE_URL` - Your Turso database URL (e.g., `libsql://[your-db].turso.io`)
- `TURSO_AUTH_TOKEN` - Your Turso auth token

Get these by creating a free Turso account at https://turso.tech

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env.local` and add your Turso credentials
4. Run the seed script: `npm run seed`
5. Start the dev server: `npm run dev`

## Deployment

This app is designed for serverless deployment (Vercel, Netlify, etc.) and uses Turso as a hosted database.

## AI Agent Access

AI agents (Claude Code sessions, automation scripts, bots) can read and
manage obligations via the REST API using bearer tokens.

**Create a token:** Sign in as an admin, go to **Settings → Agents**, click
**New Agent**, pick a role (viewer / editor / admin), and copy the token
that's shown once.

**Use the skill:** Copy `docs/skills/compliance-tracker/SKILL.md` into your
Claude Code project at `.claude/skills/compliance-tracker/SKILL.md` and
export the token as `COMPLIANCE_TRACKER_TOKEN`. Ask Claude to do
compliance-related work and it will use the API.

**Raw API:** See `docs/skills/compliance-tracker/SKILL.md` for the full
endpoint reference.
