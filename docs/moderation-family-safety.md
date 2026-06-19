# Moderation And Family Safety

PureChat uses a privacy-first moderation model.

## Principles

- Private messages stay private by default.
- Admins do not get automatic access to private chat content.
- Private message content enters the admin review queue only when a user reports it.
- Family-safe mode blocks or limits risky content before sending where possible.
- Group admins can enable message approval for their own groups.
- Permanent bans and suspensions are explicit admin actions and are logged.

## Automated Text Safety

The moderation service includes structures for:

- Bad language filter
- Adult text filter
- Harassment detection
- Scam and spam detection

The current implementation uses simple pattern lists in:

```text
features/moderation/moderation.service.ts
```

For production, replace or supplement these lists with a dedicated moderation provider or local classifier. Keep user trust in mind: automated systems should block only clear high-risk content and should avoid exposing private content to admins unless users report it.

## Reports

Users can report:

- Messages
- Users
- Chats
- Groups
- Attachments

Reports are created with:

```text
POST /api/reports
```

When a message is reported, PureChat stores a limited message snapshot as evidence. This is intentional: it lets admins review the reported content without opening the full private conversation.

## Admin Actions

Admins can:

- Review reports
- Warn users
- Temporarily suspend users
- Permanently ban users

Main routes:

```text
GET /api/admin/reports
PATCH /api/admin/reports/:reportId
POST /api/admin/warnings
POST /api/admin/users/suspend
POST /api/admin/users/ban
```

## Family-Safe Mode

Users can turn family-safe mode on from the security settings UI.

It can:

- Block unsafe text before sending
- Filter GIFs
- Filter stickers
- Optionally block media uploads
- Restrict unknown contacts in future contact flows

Route:

```text
PATCH /api/users/me/family-mode
```

## Group Message Approval

Group admins can enable message approval mode.

When enabled:

- Member messages are saved as `PENDING_APPROVAL`.
- The sender and group admins can see the pending message.
- Other members cannot see it yet.
- Admins approve or reject it.

Route:

```text
PATCH /api/groups/:chatId/messages/:messageId/approval
```
