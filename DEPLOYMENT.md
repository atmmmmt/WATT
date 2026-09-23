# Deployment and Sales Flow

## Public domains

- Admin dashboard: `https://whatsapp-otp.prootech-agency.com`
- API and Swagger: `https://api.prootech-cloud.com`

## Local vs production

- Local development stays on `localhost`.
- Production uses the public domains below.

## Production environment values

API:

- `APP_PUBLIC_URL=https://api.prootech-cloud.com`
- `DASHBOARD_ORIGIN=https://whatsapp-otp.prootech-agency.com`
- `CORS_ALLOWED_ORIGINS=https://whatsapp-otp.prootech-agency.com,http://localhost:5173,http://localhost:5174`

Dashboard production:

- `VITE_API_BASE_URL=https://api.prootech-cloud.com`

## Build

From the project root:

```bash
npm install
npm run build
```

## Deploy the API

1. Upload the API app to your server.
2. Copy `apps/api/.env.production.example` to `apps/api/.env` on the server and set the production secrets.
3. Install dependencies on the server:

```bash
npm install
```

4. Build the API:

```bash
npm run build --workspace @waotp/api
```

5. Seed the first admin if needed:

```bash
npm run seed:admin --workspace @waotp/api
```

6. Optionally remove dev dependencies after build:

```bash
npm prune --omit=dev
```

7. Start the API with PM2:

```bash
pm2 start apps/api/server.js --name waotp-api
pm2 save
```

8. Put a reverse proxy in front of port `4000` and point `api.prootech-cloud.com` to it.

## Deploy the dashboard

1. Build the dashboard:

```bash
npm run build --workspace @waotp/dashboard
```

The dashboard build will use `apps/dashboard/.env.production`.

2. Upload everything inside `apps/dashboard/dist/` to the document root of:

- `whatsapp-otp.prootech-agency.com`

3. If you host the dashboard on Apache, also upload:

- `deployment/dashboard.htaccess` as `.htaccess`

This keeps React SPA routes working after refresh.

## Admin usage flow

1. Open the admin dashboard.
2. Create a tenant.
3. Create a subscription.
4. Save the provider.
5. Create an API key.
6. Export the PDF package.
7. Send the customer:
   - Base URL
   - Swagger URL
   - API key
   - PDF package

## What the customer receives

- Base URL: `https://api.prootech-cloud.com`
- Docs: `https://api.prootech-cloud.com/docs`
- Header: `x-api-key: <customer-key>`
- Endpoints:
  - `POST /v1/otp/send`
  - `POST /v1/otp/verify`

## Security model

- Admin routes are protected by JWT.
- Customer OTP routes are protected by `x-api-key`.
- Inactive tenants, inactive subscriptions, or inactive API keys are blocked automatically.
