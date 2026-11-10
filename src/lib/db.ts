import { Pool, types } from 'pg';

// node-postgres returns NUMERIC columns as strings by default to avoid precision
// loss; this app only uses them as plain JS numbers (prices, totals), so parse
// them back to numbers once, globally, instead of casting at every call site.
types.setTypeParser(1700, (val) => parseFloat(val));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL musí byť nastavený (pozri .env.example).');
}

declare global {
  // eslint-disable-next-line no-var
  var __vazimsiPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __vazimsiDbReady: Promise<void> | undefined;
}

async function initSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (category_id, slug)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE RESTRICT,
      stock INTEGER NOT NULL DEFAULT 0,
      featured BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Idempotent migration for a DB that already has the old category TEXT column
    -- (products.subcategory_id can't be NOT NULL here since it's added to a table
    -- that may already have rows; "required" is enforced at the app layer instead).
    ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE RESTRICT;
    ALTER TABLE products DROP COLUMN IF EXISTS category;

    -- Slovak VAT rates as of 2026: 23 % base, 19 % / 5 % reduced (food, books, etc.) - set
    -- per product since a single shop can sell across multiple rates. Defaults to 23 % (base
    -- rate) for products that predate this column. Invoice/dobropis PDFs only ever print a VAT
    -- breakdown when the seller has an IČ DPH on file (see sellerIcDph in invoices.ts) - this
    -- column existing doesn't by itself change anything for a shop that isn't VAT-registered.
    ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate SMALLINT NOT NULL DEFAULT 23 CHECK (vat_rate IN (5, 19, 23));

    -- How a product is actually sold:
    --   piece   - one price/stock, sold as whole units (unchanged default behaviour)
    --   bulk    - sold loose in 25 g/ml steps; price/stock stay on the product row but mean
    --             "price per kg/L" and "stock in 25-unit steps", not "per piece" - see
    --             BULK_STEP in products.ts for the conversion, kept in one place
    --   variant - sold as a fixed set of package sizes (e.g. 30 ml / 50 ml / 100 ml tincture),
    --             each its own price/stock in product_variants; the product row's own
    --             price/stock go unused for these
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_mode TEXT NOT NULL DEFAULT 'piece'
      CHECK (sale_mode IN ('piece', 'bulk', 'variant'));
    ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_unit TEXT CHECK (bulk_unit IN ('g', 'ml'));

    -- Some products (fresh/fragile/local-only goods) can only be collected in person - shown as
    -- an "Iba na predajni" badge on the photo, and enforced at checkout (a cart containing one
    -- of these can't choose "Doručenie na adresu").
    ALTER TABLE products ADD COLUMN IF NOT EXISTS pickup_only BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS product_variants (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_tags (
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (product_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '';

    -- Saved business details, same shape as orders.buyer_type/company_* - lets a repeat B2B
    -- customer skip retyping IČO/DIČ at checkout. Still just a pre-fill: the order's own
    -- buyer_type/company_* fields (set at checkout) are what actually lands on the invoice,
    -- so a customer can still buy personally, or edit stale company details, per order.
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS buyer_type TEXT NOT NULL DEFAULT 'individual'
      CHECK (buyer_type IN ('individual', 'company'));
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_ico TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_dic TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_ic_dph TEXT;

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      guest_name TEXT,
      guest_email TEXT,
      guest_address TEXT,
      order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL DEFAULT 'pending',
      total NUMERIC(10,2) NOT NULL,
      payment_method TEXT
    );

    -- Bank-transfer reference number shown to the customer in the pending-payment
    -- email; generated per order (see createOrder), nullable since existing rows
    -- predate this column and never get one retroactively.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS variable_symbol TEXT UNIQUE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_phone TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_city TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_postal_code TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

    -- How the order will reach the customer, chosen at checkout (see createOrder). Kept as its
    -- own column - separate from status - so the shop still knows "this needs to stay at the
    -- counter, not get shipped" even after status has moved on to paid/shipped/cancelled.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_method TEXT NOT NULL DEFAULT 'shipping'
      CHECK (fulfillment_method IN ('shipping', 'pickup'));

    -- B2C vs B2B, chosen at checkout. Company details are captured per order (not on the
    -- customer profile) and only filled for buyer_type = 'company'; they get snapshotted onto
    -- the invoice / credit note at generation time like every other buyer field.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_type TEXT NOT NULL DEFAULT 'individual'
      CHECK (buyer_type IN ('individual', 'company'));
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_name TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_ico TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_dic TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_ic_dph TEXT;

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      price_at_order NUMERIC(10,2) NOT NULL
    );

    -- Snapshot of the product's VAT rate at the moment of purchase, same reasoning as
    -- price_at_order: a product's rate (or the shop's VAT registration status) can change
    -- later, but an already-placed order's invoice must keep reflecting what applied when it
    -- was actually sold. Defaults to 23 for historical rows, which never render a VAT
    -- breakdown anyway since they predate the shop having an IČ DPH.
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_rate SMALLINT NOT NULL DEFAULT 23 CHECK (vat_rate IN (5, 19, 23));

    -- RESTRICT (not CASCADE/SET NULL): a variant that has ever been ordered must stay
    -- addressable so historical invoices keep resolving correctly - see the "don't hard-delete a
    -- variant with order history" guard in products.ts. variant_label is a snapshot, same
    -- reasoning as price_at_order - an admin renaming/removing a variant later must not alter an
    -- already-issued invoice's wording.
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE RESTRICT;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label TEXT;

    -- Gap-free per-year invoice number counter - see generateInvoiceForOrder in
    -- lib/invoices.ts. Locked via SELECT ... FOR UPDATE before any work happens and
    -- only incremented after the PDF has already been rendered and written, so a
    -- rollback (for any reason) never burns a number without a matching invoice.
    CREATE TABLE IF NOT EXISTS invoice_number_counter (
      year INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT, -- RESTRICT not
        -- CASCADE: an invoice is a legal/accounting record, must not vanish if an order
        -- row is ever deleted
      invoice_number TEXT UNIQUE NOT NULL, -- e.g. 'ESH-2026-0001', gap-free, see counter above
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      pdf_path TEXT NOT NULL, -- always set: the row only gets inserted after the PDF has
        -- already been rendered and written, in the same transaction
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      customer_city TEXT,
      customer_postal_code TEXT,
      seller_name TEXT NOT NULL,
      seller_address TEXT NOT NULL,
      seller_ico TEXT,
      seller_dic TEXT,
      seller_ic_dph TEXT,
      seller_iban TEXT,
      UNIQUE (order_id) -- one invoice per order, DB-level backstop matching the
        -- app-level idempotency check in generateInvoiceForOrder
    );

    -- Gap-free per-year credit-note counter - same locking scheme as invoice_number_counter,
    -- but kept as a separate table/sequence since a dobropis series (DOB-...) is independent
    -- from the invoice series (ESH-...), not a continuation of it.
    CREATE TABLE IF NOT EXISTS credit_note_counter (
      year INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS credit_notes (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT, -- the invoice
        -- being credited - a dobropis always references a specific prior invoice
      credit_note_number TEXT UNIQUE NOT NULL, -- e.g. 'DOB-2026-0001', gap-free
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      pdf_path TEXT NOT NULL,
      sent_at TIMESTAMPTZ, -- null until first successful send; informational only, resending
        -- is always allowed (unlike generation, which is strictly one-shot)
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      customer_city TEXT,
      customer_postal_code TEXT,
      seller_name TEXT NOT NULL,
      seller_address TEXT NOT NULL,
      seller_ico TEXT,
      seller_dic TEXT,
      seller_ic_dph TEXT,
      seller_iban TEXT,
      UNIQUE (order_id) -- one credit note per order (full-order credit notes only)
    );

    -- When the invoice PDF last reached the customer by email (the vybavená email, or a manual
    -- resend from admin). Null = never confirmed sent, e.g. SMTP was down at vybavená time -
    -- the admin orders page flags that and offers a resend. Same idea as credit_notes.sent_at.
    -- One-time backfill when the column is first added: invoices of orders already vybavená
    -- went out with that email back then (failures weren't tracked), so don't flag them all.
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'invoices' AND column_name = 'sent_at') THEN
        ALTER TABLE invoices ADD COLUMN sent_at TIMESTAMPTZ;
        UPDATE invoices i SET sent_at = i.issued_at FROM orders o
          WHERE o.id = i.order_id AND o.status = 'shipped';
      END IF;
    END $$;

    -- Buyer company snapshot (B2B orders) - null for private-person orders.
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_company_name TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_ico TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_dic TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_ic_dph TEXT;
    ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS customer_company_name TEXT;
    ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS customer_ico TEXT;
    ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS customer_dic TEXT;
    ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS customer_ic_dph TEXT;
  `);

  await seedIfEmpty(pool);
}

async function seedIfEmpty(pool: Pool): Promise<void> {
  const { rows: catCountRows } = await pool.query('SELECT COUNT(*)::int as count FROM categories');
  let subcategoryIds: Record<string, number> = {};
  let tagIds: Record<string, number> = {};

  if (catCountRows[0].count === 0) {
    const { rows: catRows } = await pool.query(
      `INSERT INTO categories (slug, name) VALUES ('kozmetika', 'Kozmetika') RETURNING id`
    );
    const categoryId = catRows[0].id as number;

    const subcategories = [
      { slug: 'mydla', name: 'Mydlá' },
      { slug: 'kremy', name: 'Krémy' },
      { slug: 'eterické-oleje', name: 'Éterické oleje' },
    ];
    for (const s of subcategories) {
      const { rows } = await pool.query(
        `INSERT INTO subcategories (category_id, slug, name) VALUES ($1,$2,$3) RETURNING id`,
        [categoryId, s.slug, s.name]
      );
      subcategoryIds[s.slug] = rows[0].id;
    }

    const tags = [
      { slug: 'hydratacia', name: 'Hydratácia' },
      { slug: 'upokojenie', name: 'Upokojenie' },
    ];
    for (const t of tags) {
      const { rows } = await pool.query(`INSERT INTO tags (slug, name) VALUES ($1,$2) RETURNING id`, [
        t.slug,
        t.name,
      ]);
      tagIds[t.slug] = rows[0].id;
    }
  }

  const { rows: prodCountRows } = await pool.query('SELECT COUNT(*)::int as count FROM products');
  if (prodCountRows[0].count === 0 && Object.keys(subcategoryIds).length > 0) {
    const samples = [
      {
        slug: 'levandulove-mydlo',
        name: 'Levanduľové mydlo',
        description:
          'Ručne vyrábané mydlo so sušenou levanduľou a bio bambuckým maslom. Jemne čistí a upokojuje pokožku.',
        price: 5.5,
        subcategorySlug: 'mydla',
        stock: 20,
        featured: true,
        tagSlugs: ['upokojenie'],
      },
      {
        slug: 'nechtikovy-krem',
        name: 'Nechtíkový krém',
        description: 'Výživný telový krém s výťažkom z nechtíka lekárskeho. Vhodný na citlivú a suchú pokožku.',
        price: 8.9,
        subcategorySlug: 'kremy',
        stock: 15,
        featured: true,
        tagSlugs: ['hydratacia'],
      },
      {
        slug: 'levandulovy-etericky-olej',
        name: 'Levanduľový éterický olej',
        description: '100% čistý éterický olej z levandule pravej. 10 ml, vhodný do difuzéra alebo na masáž.',
        price: 9.9,
        subcategorySlug: 'eterické-oleje',
        stock: 10,
        featured: false,
        tagSlugs: ['upokojenie'],
      },
    ];

    for (const s of samples) {
      const { rows } = await pool.query(
        `INSERT INTO products (slug, name, description, price, subcategory_id, stock, featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [s.slug, s.name, s.description, s.price, subcategoryIds[s.subcategorySlug], s.stock, s.featured]
      );
      const productId = rows[0].id as number;
      for (const tagSlug of s.tagSlugs) {
        if (tagIds[tagSlug]) {
          await pool.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [
            productId,
            tagIds[tagSlug],
          ]);
        }
      }
    }
  }

  const defaultSettings: Record<string, string> = {
    shop_name: 'Važim si',
    tagline: 'Obchodík s krásou a prírodou',
    about_text:
      'Vitajte v mojom malom obchodíku. Ručne vyrábam prírodnú kozmetiku s láskou a úctou k prírode — bez zbytočnej chémie, tak ako to robili naše babičky.',
    whatsapp_number: '',
    email: '',
    instagram_url: '',
    facebook_url: '',
    payment_instructions: '',
    address: '',
    phone: '',
    website_url: '',
    iban: 'SK89 1200 0000 1987 4263 7541',
    ico: '',
    dic: '',
    ic_dph: '',
    email_pending_text:
      'Ďakujeme za objednávku,\n\nObjednávka č. {{cislo}}\nPo prijatí platby prevodom bude objednávka automaticky odoslaná a obdržíte e-mail o aktuálnom stave.',
    email_pickup_text:
      'Ďakujeme za objednávku,\n\nObjednávka č. {{cislo}}\nVaša objednávka sa pripravuje na vyzdvihnutie na predajni. Hneď ako bude pripravená, ozveme sa e-mailom.',
    email_paid_text:
      'Ďakujeme,\n\nPrijali sme platbu za Vašu objednávku č. {{cislo}}. Objednávka je teraz spracovávaná a čoskoro bude odoslaná.',
    email_shipped_text:
      'Ďakujeme za objednávku,\n\nPlatba za Vašu objednávku č. {{cislo}} bola prijatá. Objednávka sa práve pripravuje na odoslanie. Predpokladaný čas doručenia je do 4 pracovných dní. V prílohe nájdete faktúru.',
    email_cancelled_text:
      'Dobrý deň,\n\nVaša objednávka č. {{cislo}} bola zrušená.\n\nPokiaľ už bola platba vykonaná, finančné prostriedky Vám budú vrátené späť na účet.',
    email_credit_note_text:
      'Dobrý deň,\n\nzasielame Vám dobropis č. {{dobropis}} k faktúre č. {{faktura}} (objednávka č. {{cislo}}). Suma na vrátenie: {{suma}} €.',
    email_ready_for_pickup_text:
      'Dobrý deň,\n\nVaša objednávka č. {{cislo}} je pripravená na vyzdvihnutie na predajni. Platbu je možné uhradiť priamo pri prevzatí.',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [
      key,
      value,
    ]);
  }
}

function createPool(): Pool {
  return new Pool({ connectionString });
}

export async function getDb(): Promise<Pool> {
  if (!global.__vazimsiPool) {
    global.__vazimsiPool = createPool();
    global.__vazimsiDbReady = initSchema(global.__vazimsiPool);
  }
  await global.__vazimsiDbReady;
  return global.__vazimsiPool;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23503';
}
