# WhatsApp OTP + Support Inbox Platform

This repository contains a multi-tenant WhatsApp SaaS platform built on:

- `NestJS + MongoDB` for the backend API
- `React + Vite` for the dashboard
- `Baileys` for lightweight QR-based WhatsApp WebSocket sessions without Chromium/Puppeteer

The platform supports multiple sellable products inside the same system:

- `otp`: WhatsApp OTP API for developers
- `hr`: HR recruiting workflow with WhatsApp messaging
- `support`: WhatsApp Shared Team Inbox / Customer Support Inbox
- Doctor/Client Privacy Relay: two parties communicate through the platform number without exposing their phone numbers to each other

## Project structure

```text
apps/
  api/        # NestJS API, MongoDB models, Swagger, WhatsApp session logic
  dashboard/  # React dashboard
frontend/     # Public landing page for selling plans and WhatsApp checkout
legacy/
  standalone-whatsapp-otp/  # Older standalone OTP version
```

## WhatsApp architecture

The application depends on the stable `WhatsappSessionsService` contract. `WhatsappSessionsModule` currently provides that contract through a Baileys gateway.

```text
OTP / HR / Support / Privacy Relay
              |
     WhatsappSessionsService
              |
      Compatibility Adapter
              |
       Baileys WebSocket
              |
           WhatsApp
```

Baileys uses one lightweight socket session per connected business number. Session credentials and Signal keys are stored in MongoDB (`whatsapp_baileys_auth`) instead of browser profiles. Existing application chat IDs stay on the historic `@c.us` format through an adapter while Baileys uses its native JIDs internally.

## Requirements

- Node.js 20 or newer
- MongoDB

No Chromium/Puppeteer runtime is required by the active WhatsApp engine.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy environment files:

```bash
copy apps\api\.env.example apps\api\.env
copy apps\dashboard\.env.example apps\dashboard\.env
```

3. Start MongoDB.

4. Seed the platform owner:

```bash
npm run seed:admin
```

5. Start the backend, dashboard, and public landing page:

```bash
npm run dev:api
npm run dev:dashboard
npm run dev:frontend
```

Backend:

```text
http://localhost:4000
http://localhost:4000/docs
```

Dashboard:

```text
http://localhost:5173
```

Public landing page:

```text
http://localhost:5174
http://localhost:5174/ar
http://localhost:5174/en
http://localhost:5174/tr
http://localhost:5174/fr
```

## Environment variables

Main API variables live in `apps/api/.env`.

Important variables:

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `APP_PUBLIC_URL`: public backend base URL
- `DASHBOARD_ORIGIN`: main dashboard origin
- `LANDING_ORIGIN`: public landing page origin
- `CORS_ALLOWED_ORIGINS`: comma-separated allowed origins
- `DEFAULT_ADMIN_EMAIL`: platform owner email for `seed:admin`
- `DEFAULT_ADMIN_PASSWORD`: platform owner password for `seed:admin`
- `WA_DISABLE_SESSIONS`: set to `true` on maintenance/API copies that must not connect WhatsApp sessions
- `WA_MESSAGE_CACHE_LIMIT`: in-process recent-message cache per tenant, default `1000`
- `WA_HISTORY_CHAT_LIMIT`: recent chat cache per tenant, default `100`
- `WA_HISTORY_MESSAGE_LIMIT`: recent messages retained per cached chat, default `100`

## Support Inbox

The Support product includes:

- QR-based WhatsApp connection for a business number
- employee accounts with `admin`, `supervisor`, and `agent` roles
- shared live inbox
- conversation assignment and claiming
- internal notes
- quick replies
- tags
- support reports
- employee attribution on outgoing dashboard messages
- realtime Socket.IO updates

Every outgoing support message keeps internal attribution such as `sentByUserId` and `sentByUserNameSnapshot`, while the WhatsApp customer only communicates with the business number.

## Privacy Relay

The Doctor/Client Privacy Relay keeps both endpoints private:

```text
Patient/Client -> Platform WhatsApp Number -> Doctor/Professional
Doctor/Professional -> Platform WhatsApp Number -> Patient/Client
```

Neither party needs to receive the other party's phone number. The relay supports text and media forwarding and keeps its routing/link state in the application database.

## OTP compatibility

The existing OTP API remains:

```text
POST /v1/otp/send
POST /v1/otp/verify
```

OTP verification remains application-side. Only the WhatsApp transport used for sending changed from the Chromium client to Baileys.

## Session migration note

Existing `whatsapp-web.js` LocalAuth browser sessions cannot be converted into Baileys Signal credentials. A tenant already connected with the old engine must scan one fresh QR the first time it is moved to Baileys. After that, credentials are restored from MongoDB across process restarts unless WhatsApp logs the linked device out.

## Deployment

See `DEPLOYMENT.md` for the production build, PM2, Nginx and migration notes.
