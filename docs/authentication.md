# Authentication

PureChat supports password login, email or phone OTP login, account verification, refresh tokens, session management, logout, logout from all devices, and a starter two-step verification flow.

## Main API Routes

- `POST /api/auth/register` - create an account and send verification codes.
- `POST /api/auth/login` - sign in with email, phone, or username plus password.
- `POST /api/auth/otp/start` - request a login code for email or phone.
- `POST /api/auth/otp/verify` - verify login code and create a session.
- `POST /api/auth/verify-account` - verify email or phone after registration.
- `POST /api/auth/2fa/enable` - turn on two-step verification.
- `POST /api/auth/2fa/disable` - turn off two-step verification.
- `POST /api/auth/2fa/verify` - finish password login when two-step verification is on.
- `POST /api/auth/refresh` - rotate refresh token and issue a new access cookie.
- `POST /api/auth/logout` - sign out from the current device.
- `POST /api/auth/logout-all` - sign out from all devices.
- `GET /api/auth/me` - get the current signed-in user.
- `GET /api/auth/sessions` - list active sessions.

## Notes

Access and refresh tokens are opaque random tokens stored in secure HTTP-only cookies. Refresh tokens are hashed in PostgreSQL. Short-lived access tokens are mapped to sessions in Redis.

OTP delivery is abstracted in `features/auth/otp.delivery.ts`. In development it logs codes to the server console. In production, connect it to email and SMS providers.
