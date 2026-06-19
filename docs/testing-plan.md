# PureChat Testing Plan

## Smoke Tests

- Register with email.
- Log in with password.
- Request OTP and confirm it prints in the server console.
- Send a 1-to-1 message.
- Create a group.
- Add a member.
- Send a group message.
- Upload an image with local storage.
- Open call history.
- Toggle family-safe mode.
- Report a message and review it as admin.

## Security Tests

- Invalid JSON returns a safe error.
- Oversized upload is rejected.
- Blocked file extensions are rejected.
- Unsafe API requests without a same-origin header are rejected.
- Non-admin users cannot open admin APIs.
- Non-members cannot read chat files.
- Report evidence is encrypted in the database.
- Logout removes the current session.
- Logout all removes other sessions.

## Responsive Tests

- Landing page at 375px, 768px, and desktop.
- Chat list and active chat on mobile.
- Composer with file preview on mobile.
- GIF, emoji, and sticker panels on mobile.
- Admin moderation dashboard on tablet and desktop.
- Dark mode and light mode.

## Performance Tests

- Initial page load stays responsive.
- Chat list renders quickly with 100 chats.
- Message window renders quickly with long history.
- Image previews do not shift layout.
- API routes return safe errors under failed Redis in development.

## Deployment Tests

- `npm install`
- `npx prisma migrate dev`
- `npm run seed`
- `npm run dev`
- `npm run typecheck`
- `npm run build`

Run full deployment checks again after adding production Redis, storage, and Socket.IO hosting.
