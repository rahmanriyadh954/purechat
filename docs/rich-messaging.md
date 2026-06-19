# Rich Messaging

PureChat stores media files in private S3-compatible storage and stores only metadata in PostgreSQL.

## Upload Flow

1. Client picks a file and shows a local preview.
2. Client calls `POST /api/attachments/presign`.
3. Server validates file type, size, extension, chat membership, and creates a storage key.
4. Client uploads directly to S3 with the signed URL.
5. Client emits `attachment:complete` over Socket.IO.
6. Server creates the message and attachment metadata in PostgreSQL.
7. Server broadcasts `message:new` to the chat room.

## Storage Key Layout

```text
chats/{chatId}/{kind}/{yyyy-mm}/{userId}/{uuid}.{ext}
```

Examples:

```text
chats/chat_123/image/2026-06/user_123/uuid.webp
chats/chat_123/voice/2026-06/user_123/uuid.webm
chats/chat_123/document/2026-06/user_123/uuid.pdf
```

## Supported Media

- Images: JPEG, PNG, WebP, GIF
- Videos: MP4, WebM, QuickTime
- Documents: PDF, text, Word, Excel
- Audio: MP3, MP4 audio, WAV, WebM, OGG
- Voice messages: WebM, OGG, MP3, MP4 audio

## Security

- Files are uploaded to private S3 buckets.
- File extensions and MIME types are validated.
- Executable/script-like files are blocked.
- File size limits are enforced by media kind.
- Downloads use `GET /api/files/:key*`, which checks chat membership before redirecting to a signed S3 URL.
- Upload metadata starts with `scanStatus = PENDING`, ready for malware scanning workers.

## Rich Message UI

The composer supports:

- Attachment preview before sending
- Image, video, document, audio, and voice upload structure
- Emoji panel
- GIF search panel
- Sticker panel
- Media gallery inside the chat
