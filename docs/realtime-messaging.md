# Realtime Messaging

PureChat uses Socket.IO for live chat events and Prisma/PostgreSQL as the source of truth.

## Server

Run the app with:

```bash
npm run dev
```

The `dev` script starts `server.ts`, which prepares Next.js and attaches Socket.IO to the same HTTP server.

## Events

- `conversation:join` - join a chat room after membership is checked.
- `conversation:leave` - leave a chat room.
- `message:send` - save a text message, then broadcast `message:new`.
- `message:delivered` - save delivered receipt, then broadcast delivery state.
- `message:read` - save read receipt, then broadcast read state.
- `message:edit` - update sender-owned message, then broadcast `message:updated`.
- `message:delete` - soft-delete sender-owned message, then broadcast `message:deleted`.
- `reaction:add` - save reaction, then broadcast `reaction:updated`.
- `reaction:remove` - remove reaction, then broadcast `reaction:updated`.
- `typing:start` / `typing:stop` - broadcast typing state to other chat members.
- `user:online` / `user:offline` - broadcast presence state.

## Data Flow

1. The frontend loads chats from `GET /api/chats`.
2. The frontend loads messages from `GET /api/chats/:chatId/messages`.
3. The Socket.IO client connects with secure cookies.
4. The server authenticates the socket from the access token.
5. The client joins each allowed `chat:{chatId}` room.
6. Message changes are saved to PostgreSQL first.
7. Saved records are broadcast to all chat members.

Group chat support uses the same `Chat` and `ChatMember` tables. Any group member in the Socket.IO room receives the event.
