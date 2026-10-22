# Repository Guidance

## Project
- This is an Express 4 application using JavaScript ES modules.
- The server entry point is `src/server.js`; it serves `public/` and mounts authentication at `/auth` and authenticated todo routes at `/todos`.
- Route handlers are in `src/routes/`. JWT verification is handled by `src/middleware/authMiddleware.js`.
- Database-backed routes use the Prisma client from `src/prismaClient.js`. The schema is currently at `prisma/migrations/schema.prisma` and declares PostgreSQL models for `User` and `Todo`.
- `src/db.js` defines an in-memory SQLite database but is not imported by the server or routes. Do not treat it as the active persistence layer without changing the application wiring deliberately.

## Working Conventions
- Preserve the existing ESM style and the surrounding code's formatting when editing JavaScript.
- Keep user-owned todo reads and mutations scoped to `req.userId`.
- Keep authentication secrets in environment variables; do not add credentials to source files.
- The local development command is `npm run dev`; it expects `.env` values for `DATABASE_URL` and `JWT_SECRET`.
- `npm test` is currently a placeholder that exits with an error. There are no configured automated tests, so verify changes with a focused manual/API check or an appropriate lint/type check if one is added.
- Docker Compose defines the app and PostgreSQL services. Its database URL is configured in `docker-compose.yaml`.

## Data and Tooling Caveats
- `package.json` currently declares no Prisma dependencies or Prisma scripts, despite imports from `@prisma/client`; check the installed/generated client setup before relying on Prisma CLI commands.
- The Prisma schema is nested under `prisma/migrations/` rather than Prisma's conventional `prisma/schema.prisma` path. Preserve that location unless intentionally standardizing Prisma configuration and related tooling.