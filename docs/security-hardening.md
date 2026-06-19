# PureChat Security Hardening

PureChat treats security as part of the product, not a late checklist. This guide explains the safeguards already wired into the codebase and the production controls that must be configured before launch.

## Request Protection

- Validate every request body with Zod before it reaches business logic.
- Reject unsafe API requests that do not come from the same origin.
- Keep JSON request bodies small with a server-side size limit.
- Return generic error messages to users and keep detailed traces out of responses.
- Use Prisma query APIs for database access instead of raw SQL by default.

## Browser Protection

- Send strict security headers from `next.config.ts`.
- Use a Content Security Policy that allows only the app, approved image sources, and configured S3 media.
- Use `frame-ancestors 'none'` to prevent clickjacking.
- Use `X-Content-Type-Options: nosniff` and a limited permissions policy.
- Escape UI output through React rendering and sanitize user-generated plain text before storage.

## Cookies And Sessions

- Store access and refresh tokens only in `httpOnly` cookies.
- Mark cookies as `secure` in production.
- Use `sameSite: "strict"` to reduce cross-site request risk.
- Rotate refresh tokens after use.
- Track sessions by device, IP address, user agent, and expiration time.
- Allow users to remove one device session or log out everywhere.

## Rate Limiting

- Apply Redis-backed rate limits to authentication, uploads, calls, and reports.
- Apply Socket.IO rate limits to messages, attachments, and call signaling.
- Keep separate limits per user and per sensitive action.
- In production, add edge-level protection for abusive IPs and bot traffic.

## Files And Media

- Validate file name, MIME type, size, and media category before issuing upload URLs.
- Store uploads under scoped S3 object keys that include the uploader and upload record.
- Confirm an attachment only when the storage key belongs to the expected upload.
- Serve private media through signed download URLs.
- Do not trust client-provided file metadata after upload. Re-scan and re-check files in a background worker before broad sharing.

## Privacy And Moderation

- Keep private messages private unless a user reports a message.
- Store report evidence as an encrypted snapshot so admins review only the reported content.
- Do not expose live private message bodies in admin report lists.
- Write audit logs for report creation, report review, warnings, suspensions, bans, login, logout, and family-mode changes.
- Keep moderation decisions explainable and tied to a report, rule, or admin action.

## Role-Based Access

- Require admin sessions before admin APIs return data or perform actions.
- Require group owner/admin roles for group moderation actions.
- Require active chat membership before sending, reading, editing, deleting, or reacting in a chat.
- Keep server-side permission checks even when the UI hides actions.

## Sensitive Data

- Encrypt sensitive report evidence with AES-256-GCM.
- Keep encryption keys outside source control.
- Rotate secrets through deployment configuration, not code changes.
- Hash OTPs and refresh tokens before storage.
- Never log access tokens, refresh tokens, OTP values, or raw file URLs.

## Production Checklist

- Use strong values for `AUTH_SECRET` and `DATA_ENCRYPTION_KEY`.
- Serve the app only over HTTPS.
- Set trusted production origins for the app, Socket.IO, and S3/CDN.
- Enable database backups, point-in-time recovery, and restricted database users.
- Enable S3 bucket private access, object encryption, malware scanning, and lifecycle cleanup.
- Add structured security alerts for unusual login, upload, report, and admin activity.
- Run dependency scanning, secret scanning, and static analysis in CI.
- Add penetration testing before public launch.
