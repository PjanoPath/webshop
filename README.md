# Važim si — webshop

Next.js + PostgreSQL webshop. Product catalog is fully self-service: the shop owner adds/edits/deletes
products, photos and shop contact info from `/admin` — no code changes needed. Customers can register
an account or check out as a guest; there's no payment gateway yet — placing an order sends a
confirmation email (to the customer) and a notification email (to the shop) with payment instructions
for a manual bank transfer.

**Phase: local development only.** No deployment setup (Docker/Kubernetes) exists yet for this
Postgres-based version.

## Local development

```
# Start a local Postgres instance (or use an existing local install):
docker run --name vazimsi-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vazimsi -p 5432:5432 -d postgres:16

cp .env.example .env.local   # fill in DATABASE_URL / SMTP_* / ADMIN_USERNAME / ADMIN_PASSWORD / SESSION_SECRET
npm install
npm run dev
```

Site: http://localhost:3000, admin: http://localhost:3000/admin. Tables and the 3 sample products
are created automatically on first request against `DATABASE_URL`.

Order emails need real SMTP credentials (e.g. a Gmail address + an
[app password](https://myaccount.google.com/apppasswords)) in `SMTP_USER`/`SMTP_PASS` — without them,
checkout still works, but sending the confirmation/notification emails fails silently (logged to the
console).

## Adding the real logo

Drop a `logo.png` / `logo.jpg` / `logo.svg` / `logo.webp` file into `public/` — the site picks it up
automatically (see `src/components/Logo.tsx`). Requires a rebuild if running via Docker.

## Project layout

- `src/app/(site)/` — public storefront (home, catalog, product detail, cart, checkout, account)
- `src/app/(site)/ucet/` — customer registration/login/order-history
- `src/app/(site)/kosik/`, `pokladna/`, `objednavka-prijata/` — cart, checkout, order confirmation
- `src/app/admin/` — password-protected admin (`src/proxy.ts` guards `/admin/*`; also guards
  `/ucet/*` for customer accounts, using a separate session cookie)
- `src/lib/db.ts` — PostgreSQL schema + seed data (tables created automatically on first connection)
- `src/lib/products.ts`, `src/lib/settings.ts` — product catalog & shop settings data access
- `src/lib/customers.ts`, `src/lib/customerAuth.ts` — customer accounts (bcrypt-hashed passwords)
- `src/lib/orders.ts` — order creation (transactional, re-checks stock/price server-side) & queries
- `src/lib/email.ts` — order confirmation/notification emails via SMTP (nodemailer)
- `src/context/CartContext.tsx` — client-side cart state, persisted to `localStorage`
