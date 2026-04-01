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
