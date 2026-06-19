# PureChat Deployment Guide

## Localhost

Use this path first:

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Localhost does not require paid APIs.

- OTP prints in the server console.
- Uploads use `./uploads`.
- GIFs use mock safe data.
- Moderation uses local rules.
- Redis can be missing in development.

## Supabase

1. Create a Supabase project.
2. Copy the pooled PostgreSQL connection string into `DATABASE_URL`.
3. Copy the direct database connection string into `DIRECT_URL`.
4. Run migrations locally with `npx prisma migrate dev`.
5. Use `npx prisma migrate deploy` for production releases.

## Vercel

Deploy the Next.js app to Vercel and set all required environment variables in Project Settings.

Important production note: the custom Socket.IO server in `server.ts` is for localhost and persistent Node deployments. Vercel serverless functions are not a permanent WebSocket host. For production realtime, run Socket.IO on a persistent Node host and point the web app to that signaling origin, or replace Socket.IO with a managed realtime provider.

## Production Storage

Local storage is only for development. In production:

1. Set `STORAGE_DRIVER="s3"`.
2. Add `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
3. Keep the bucket private.
4. Enable malware scanning and lifecycle cleanup.

## Production Secrets

Replace every sample secret:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DATA_ENCRYPTION_KEY`
- Supabase password
- Redis password
- Storage keys
- TURN credentials

Never paste production secrets into source control.
