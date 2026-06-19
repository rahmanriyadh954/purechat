# WebRTC Calls

PureChat uses WebRTC for media and Socket.IO for signaling.

## Supported Flows

- 1-to-1 audio call
- 1-to-1 video call
- Group call data structure
- Ringing state
- Accept call
- Reject call
- End call
- Call history
- Incoming call notification UI
- Screen sharing structure

## Data Flow

1. Caller clicks audio or video call.
2. Client gets local media with `navigator.mediaDevices.getUserMedia`.
3. Client emits `call:start`.
4. Server creates `Call` and `CallParticipant` records.
5. Server sends `call:incoming` to invited users.
6. Caller and receiver exchange WebRTC offer/answer through Socket.IO.
7. Caller and receiver exchange ICE candidates through Socket.IO.
8. Media flows peer-to-peer through WebRTC.
9. Accept, reject, end, and screen-share states are saved in PostgreSQL.

## Socket.IO Events

- `call:start`
- `call:incoming`
- `call:ringing`
- `call:accept`
- `call:accepted`
- `call:reject`
- `call:rejected`
- `call:offer`
- `call:answer`
- `call:ice_candidate`
- `call:screen_share`
- `call:screen_share_updated`
- `call:end`
- `call:ended`

## TURN/STUN Config

STUN/TURN config is returned by:

```text
GET /api/calls/config
```

Set these environment variables:

```env
TURN_SERVER_URL="turn:turn.example.com:3478"
TURN_USERNAME="purechat-user"
TURN_CREDENTIAL="replace-with-secret"
```

The client uses these values in:

```text
hooks/use-webrtc-calls.ts
```

For development, the app includes a public STUN server:

```text
stun:stun.l.google.com:19302
```

For production, you need a real TURN server such as coturn, Twilio Network Traversal, Cloudflare Calls TURN, or your cloud provider's TURN service. TURN is required for users behind strict NATs, corporate networks, or mobile carriers where direct peer-to-peer media cannot connect.

## Group Calls

The database supports group calls with:

- `Call.isGroupCall`
- many `CallParticipant` rows
- participant join/leave state
- participant mute and screen-sharing state

The current frontend hook includes the group call structure. A production group call should use either:

- mesh peer connections for very small groups, or
- an SFU such as LiveKit, mediasoup, Janus, or Jitsi for larger groups.

For Messenger/WhatsApp-scale group calls, use an SFU. Pure peer-to-peer mesh does not scale well beyond a few participants.
