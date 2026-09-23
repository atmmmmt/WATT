# WhatsApp OTP + Support Inbox Platform

This repository contains a multi-tenant SaaS platform built on:

- `NestJS + MongoDB` for the backend API
- `React + Vite` for the dashboard
- `whatsapp-web.js` for QR-based WhatsApp Web sessions

The platform now supports three sellable products inside the same system:

- `otp`: WhatsApp OTP API for developers
- `hr`: HR recruiting workflow with WhatsApp messaging
- `support`: WhatsApp Shared Team Inbox / Customer Support Inbox

## Project structure

```text
apps/
  api/        # NestJS API, MongoDB models, Swagger, WhatsApp session logic
  dashboard/  # React dashboard
frontend/     # Public landing page for selling plans and WhatsApp checkout
legacy/
  standalone-whatsapp-otp/  # Older standalone OTP version
```

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

Main API variables live in:

- [apps/api/.env.example](/E:/StudioProjects/whatsapp-otp/apps/api/.env.example)
- [apps/api/.env.production.example](/E:/StudioProjects/whatsapp-otp/apps/api/.env.production.example)

Important variables:

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `APP_PUBLIC_URL`: public backend base URL used in generated packages
- `DASHBOARD_ORIGIN`: main dashboard origin
- `LANDING_ORIGIN`: public landing page origin
- `CORS_ALLOWED_ORIGINS`: comma-separated list of allowed dashboard and landing origins
- `DEFAULT_ADMIN_EMAIL`: platform owner email for `seed:admin`
- `DEFAULT_ADMIN_PASSWORD`: platform owner password for `seed:admin`

Landing frontend variables live in:

- [frontend/.env.example](/E:/StudioProjects/whatsapp-otp/frontend/.env.example)
- [frontend/.env.production](/E:/StudioProjects/whatsapp-otp/frontend/.env.production)

Important landing variable:

- `VITE_API_BASE_URL`: backend API base URL used to load public landing content
- `VITE_SITE_URL`: public landing website URL used for canonical, hreflang, and OpenGraph SEO tags

## Public landing page

The `frontend` workspace is the public sales website for WaOTP. It loads all editable content from:

```text
GET /landing/public
```

The platform owner controls the landing content from the dashboard:

```text
Dashboard -> صفحة الهبوط
```

Editable items include:

- brand and hero text
- features
- packages, prices, currency, and CTA text
- FAQ content
- WhatsApp order phone number
- prefilled WhatsApp order message

When a visitor selects a plan, the page opens WhatsApp with the configured number and message. The message supports:

```text
{{planName}}
{{price}}
{{currency}}
```

Optional support demo seed variables:

- `SUPPORT_DEMO_NAME`
- `SUPPORT_DEMO_SLUG`
- `SUPPORT_DEMO_CONTACT_EMAIL`
- `SUPPORT_ADMIN_EMAIL`
- `SUPPORT_ADMIN_PASSWORD`
- `SUPPORT_SUPERVISOR_EMAIL`
- `SUPPORT_SUPERVISOR_PASSWORD`
- `SUPPORT_AGENT_EMAIL`
- `SUPPORT_AGENT_PASSWORD`

## Seed scripts

Platform owner:

```bash
npm run seed:admin
```

Support inbox demo tenant, employees, and quick replies:

```bash
npm run seed:support-demo
```

The support demo seed creates:

- one support-enabled tenant
- one support admin
- one support supervisor
- one support agent
- sample quick replies
- a yearly subscription for demo use

## Support Inbox feature

The new Support Inbox product adds:

- QR-based WhatsApp connection for one business number
- employee accounts with `admin`, `supervisor`, and `agent` roles
- shared live inbox
- conversation assignment and claiming
- internal notes
- quick replies
- tags
- support reports
- employee attribution on every outgoing dashboard message

Every outgoing support message is stored with:

- `sentByUserId`
- `sentByUserNameSnapshot`

This keeps the WhatsApp customer experience clean while preserving internal accountability.

### Main backend endpoints

Employees:

- `GET /api/employees`
- `POST /api/employees`
- `PATCH /api/employees/:id`
- `POST /api/employees/:id/disable`
- `DELETE /api/employees/:id`

Conversations:

- `GET /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/:id/read`
- `POST /api/conversations/:id/assign`
- `POST /api/conversations/:id/unassign`
- `POST /api/conversations/:id/claim`
- `PATCH /api/conversations/:id/status`

Notes:

- `GET /api/conversations/:id/notes`
- `POST /api/conversations/:id/notes`
- `DELETE /api/notes/:id`

Quick replies:

- `GET /api/quick-replies`
- `POST /api/quick-replies`
- `PATCH /api/quick-replies/:id`
- `DELETE /api/quick-replies/:id`

Tags:

- `GET /api/tags`
- `POST /api/tags`
- `PATCH /api/tags/:id`
- `DELETE /api/tags/:id`
- `POST /api/conversations/:id/tags`
- `DELETE /api/conversations/:id/tags/:tagId`

Reports:

- `GET /api/reports/support-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Settings:

- `GET /api/support/settings`
- `PATCH /api/support/settings`

### Realtime events

Socket namespace:

```text
/support-realtime
```

Important events:

- `whatsapp:qr`
- `whatsapp:connected`
- `whatsapp:disconnected`
- `conversation:new`
- `conversation:updated`
- `conversation:assigned`
- `conversation:status_changed`
- `message:new`
- `message:status_updated`
- `note:new`
- `typing:start`
- `typing:stop`

## Selling the Support Inbox product

The sales flow is the same platform flow you already use for OTP and HR:

1. Platform owner creates a tenant.
2. Enable `support` inside `enabledProducts`.
3. Create a subscription plan.
4. Create the first support `admin` employee for the tenant.
5. Send the customer:
   - dashboard URL
   - email
   - password
6. The customer logs in, opens `Support Connection`, and scans the QR from the business phone.
7. The customer creates supervisors and agents.
8. The customer starts handling WhatsApp conversations from the shared inbox.

What you send to the support customer:

- Dashboard URL
- Support admin email
- Support admin password
- Short usage steps

What you do **not** send:

- platform `super_admin` credentials
- MongoDB credentials
- project source files
- internal tenant IDs unless needed for your own platform operations

## Customer usage flow

Once the customer logs in:

1. Open `Support Connection`
2. Scan the QR from the company WhatsApp number
3. Open `Support Employees` and create team members
4. Open `Shared Inbox`
5. Start replying to customers
6. Use internal notes, quick replies, tags, and assignments
7. Open `Support Reports` to monitor team performance

## OTP compatibility

The existing OTP flow remains intact:

- `POST /v1/otp/send`
- `POST /v1/otp/verify`

The support inbox reuses the same WhatsApp Web session service when the tenant uses `whatsapp_web`.

## Notes

- The current support UI is text-message-first for dashboard sending.
- Incoming WhatsApp media metadata is stored in the message model for future extension.
- `whatsapp-web.js` session state is shared across OTP, HR, and Support for the same tenant.
