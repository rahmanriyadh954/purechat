# PureChat

PureChat is a premium Islamic-safe modern messenger built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, Supabase PostgreSQL, Redis, Socket.IO, WebRTC, and local/S3-compatible uploads.

The product is designed to feel clean, trustworthy, fast, family-friendly, and production-minded.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Put your real Supabase `DATABASE_URL` and `DIRECT_URL` in `.env`.
3. Keep `OTP_PROVIDER="console"` for local development.
4. Keep `STORAGE_DRIVER="local"` for local uploads.
5. Keep `DISABLE_REDIS="true"` if Redis is not installed. PureChat will use in-memory auth cache, sessions, presence, and rate limits.

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Seeded admin:

```text
admin@purechat.local
Admin123456!
```

Change the seed password before sharing any deployed environment.

## Required Environment Variables

- `DATABASE_URL`: Supabase pooled PostgreSQL URL.
- `DIRECT_URL`: Supabase direct PostgreSQL URL for Prisma migrations.
- `JWT_ACCESS_SECRET`: long random secret for auth.
- `JWT_REFRESH_SECRET`: long random secret for refresh/session security.
- `DATA_ENCRYPTION_KEY`: long random key for encrypted report evidence.
- `APP_ORIGIN`: app origin, such as `http://localhost:3000`.
- `NEXT_PUBLIC_APP_URL`: public app URL shown to the browser.
- `DISABLE_REDIS`: set to `true` to run without Redis installed.
- `REDIS_URL`: Redis URL. PureChat falls back to memory when Redis is disabled or unavailable.
- `STORAGE_DRIVER`: `local` for localhost, `s3` for production.
- `UPLOAD_DIR`: local upload folder when using local storage.
- `WEBRTC_STUN_URL`: STUN server URL.

Never commit real production secrets. The sample secrets in `.env.example` are for local setup only and must be replaced in production.

## Supabase Setup

1. Create a Supabase project.
2. Copy the connection string from Project Settings > Database.
3. Use the pooler URL for `DATABASE_URL`.
4. Use a direct database connection for `DIRECT_URL` when available.
5. Add both values to `.env` locally and to Vercel environment variables.
6. Run `npx prisma migrate dev` locally during development.
7. Use `npx prisma migrate deploy` in production deployment workflows.

## Local Features

- OTP codes print in the server console.
- Moderation uses local rules and keywords.
- GIF search uses safe mock data.
- Uploads are stored under `./uploads`.
- Redis is optional for localhost. Authentication, OTP, sessions, presence, and rate limiting continue with memory cache when Redis is disabled or unavailable.
- WebRTC uses the configured STUN server and only needs TURN for production reliability.

## Vercel Deployment

PureChat’s Next.js app can deploy to Vercel. Production Socket.IO needs a persistent Node.js runtime because Vercel serverless functions are not a long-running WebSocket server.

Recommended production split:

- Vercel: Next.js web app and HTTP API routes.
- Supabase: PostgreSQL.
- Upstash/Redis provider: production rate limits and presence cache.
- S3-compatible storage: production media.
- Persistent Node host: Socket.IO signaling server.
- TURN provider: reliable WebRTC calls across strict networks.

Set Vercel environment variables using the same names from `.env.example`, with production values.

## Scripts

```bash
npm run dev       # Local app with custom Socket.IO server
npm run build     # Prisma generate and Next.js build
npm run start     # Next.js production start
npm run seed      # Create admin, demo user, starter chat, stickers
npm run typecheck # TypeScript check
npm run db:deploy # Production migration deploy
```

## Security Defaults

- Zod input validation at API boundaries.
- Same-origin checks for unsafe API methods.
- Secure HTTP-only cookies.
- Rate limiting with Redis and memory fallback.
- Prisma query APIs by default.
- CSP and browser security headers.
- File type, size, and storage-key validation.
- Role-based access checks for admin and group actions.
- Audit logs for auth and moderation actions.
- Encrypted report evidence.
- Privacy-first moderation defaults.

## Current Product Status

PureChat is wired as a real messaging product rather than a static demo:

- Auth, registration, OTP verification, logout, sessions, and settings are database-backed.
- Chat list, direct chat creation, anonymous safe requests, message sending, reactions, edits, deletes, reports, read receipts, and fallback polling are active.
- Rich message controls either work now or show a clear Coming Soon toast.
- Calls show history and use live WebRTC/Socket.IO where available; anonymous chats disable calls for safety.
- Admin moderation can review reports, warn users, suspend users, ban users, and review suspicious duplicate-account attempts.
- Redis is optional in development; memory fallback keeps login, OTP, sessions, and rate limits working.

Known production notes:

- Vercel serverless deployments should not be the only Socket.IO host. Use the REST and polling fallback for messaging, and run Socket.IO on a persistent Node host for instant delivery.
- WebRTC production calls need a TURN server for strict networks.
- Local GIF data and local moderation rules are intentionally free for localhost. Add external providers only when production keys are ready.

## Final UI Audit Checklist

- Click every visible button on desktop and mobile.
- Confirm every action either works, is hidden, or shows a clear Coming Soon toast.
- Confirm wrong credentials, validation failures, upload failures, and moderation failures never show raw JSON.
- Confirm all toasts are dismissible and swipe-removable.
- Confirm mobile chat input stays above the browser safe area.
- Confirm chat list and chat window switch cleanly on mobile.
- Confirm message send, retry, edit, delete, report, reaction, emoji, GIF, sticker, and image upload paths.
- Confirm anonymous chats hide identity and disable calls/media as designed.
- Confirm Calls page has history and a back button.
- Confirm Settings, Profile, Security, and Admin dashboards have loading, empty, success, and error states.
- Confirm dark mode and light mode are readable.
- Confirm keyboard navigation reaches menus, modals, buttons, and form fields.

## Main Folders

- `app`: App Router pages and API routes.
- `components`: UI, chat, calls, groups, admin, auth, settings.
- `features`: Domain logic for auth, messages, moderation, calls, groups.
- `hooks`: Realtime and WebRTC hooks.
- `lib`: Shared constants, env, Prisma, utilities.
- `prisma`: Database schema and seed.
- `server`: Redis, security, storage, and Socket.IO services.
- `docs`: Architecture, deployment, moderation, security, and testing notes.
