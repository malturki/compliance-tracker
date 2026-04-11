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

**Hosted skill:** The skill file is served at a public, agent-discoverable URL
so you don't have to copy any files. Point your agent at:

```
https://compliance-tracker-alturki.vercel.app/.well-known/compliance-tracker-skill
```

Export the token as `COMPLIANCE_TRACKER_TOKEN` and tell your agent to read
the URL above. It will fetch the latest skill content and start managing
obligations.

**Local copy:** If you prefer to ship the skill with your project, copy
`docs/skills/compliance-tracker/SKILL.md` into your Claude Code project at
`.claude/skills/compliance-tracker/SKILL.md`. The canonical source of truth
is `src/lib/compliance-tracker-skill.ts` — keep the two in sync when
editing.

**Raw API:** See the skill file for the full endpoint reference.
