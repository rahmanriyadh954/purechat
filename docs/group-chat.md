# Group Chat

PureChat group chat is built on the same `Chat` table as direct messages. A group is a `Chat` with `type = GROUP` and extra settings in the `Group` table.

## Roles

- `OWNER` - full control of the group.
- `ADMIN` - can manage members, invites, permissions, and announcements.
- `MEMBER` - normal group participant.

## Main Features

- Create group: `POST /api/chats`
- Group details: `GET /api/groups/:chatId`
- Update name, avatar, description: `PATCH /api/groups/:chatId`
- Add members: `POST /api/groups/:chatId/members`
- Remove member: `DELETE /api/groups/:chatId/members/:userId`
- Change role: `PATCH /api/groups/:chatId/members/:userId`
- Update permissions: `PATCH /api/groups/:chatId/permissions`
- Create invite link: `POST /api/groups/:chatId/invites`
- Request to join: `POST /api/groups/join/:code`
- Review join request: `PATCH /api/groups/:chatId/join-requests/:requestId`
- Pin announcement: `POST /api/groups/:chatId/announcements`
- Shared media: `GET /api/groups/:chatId/media`

## Permissions

Group permissions are stored on `Group`:

- `membersCanSend`
- `membersCanInvite`
- `membersCanUploadMedia`
- `membersCanReact`
- `onlyAdminsCanPost`
- `approvalRequired`

The message service enforces these permissions before sending messages, uploading media, or reacting.

## Invite Flow

1. Admin creates an invite link.
2. User opens `/join/:code`.
3. If approval is not required, the user joins immediately.
4. If approval is required, a `GroupJoinRequest` is created.
5. An admin approves or rejects the request.

## UI

The group details panel inside the chat includes:

- Group avatar and description
- Invite link creation
- Permission toggles
- Pinned announcements
- Join requests
- Member role controls
- Shared media section
