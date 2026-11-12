# TopGuardian API

A Node.js REST API for the TopGuardian safety management system, built with Express, SQLite, and cookie-based JWT sessions.

## Features

- HttpOnly session cookies for administrative users and employees
- CSRF validation for state-changing requests
- CORS allowlist with credential support
- Role-based write access for administrative API routes
- OpenAPI documentation and SQLite persistence

## Installation

```bash
npm install
npm run dev
```

The API listens on `http://localhost:9000` by default. Swagger UI is available at `/api-docs`.

## Authentication

- `POST /auth/login` - Administrative login
- `GET /auth/session` - Restore the current administrative session
- `POST /auth/refresh` - Renew the administrative session
- `POST /auth/logout` - End the administrative session
- `POST /auth/training-login` - Employee portal login
- `GET /auth/training-session` - Restore the employee portal session
- `POST /auth/training-logout` - End the employee portal session

The API sets separate `HttpOnly` cookies for the two applications. Frontend code must not read or store access/refresh tokens. Requests must include credentials; state-changing authenticated requests must send the CSRF token returned by login/session in the `X-CSRF-Token` header.

All business API routes require a valid session. Administrative writes require `Administrador` or `Editor`. Employee sessions can only access assigned course content and submit their own completion record.

## Deployment configuration

Set these environment variables for production:

- `JWT_SECRET` and `JWT_REFRESH_SECRET`: unique, strong secrets. Both are required in production.
- `CSRF_SECRET`: optional separate key for signed CSRF tokens; defaults to `JWT_SECRET`.
- `CORS_ORIGINS`: comma-separated exact origins of the frontends, such as `https://admin.example.com,https://training.example.com`.
- `COOKIE_SECURE`: defaults to `true` in production; keep enabled when using HTTPS.
- `COOKIE_SAME_SITE`: defaults to `lax`. Use `none` only for cross-site frontend/API deployments and only with `COOKIE_SECURE=true`.
- `COOKIE_DOMAIN`: optional cookie domain if the deployment uses sibling subdomains.

Local development allows the Vite origins on ports 8080 and 8081. Adjust `CORS_ORIGINS` when using different hosts or ports.

## Database

SQLite uses `TopGuardian_Api.db` by default. Development seed data is only intended for local testing; do not deploy sample credentials.
