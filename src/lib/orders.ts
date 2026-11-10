import crypto from 'crypto';
import { getDb } from './db';
import { BULK_STEP } from './productConstants';

export type OrderItemRecord = {
  productId: number;
  productName: string;
  quantity: number;
  priceAtOrder: number;
  vatRate: number;
  variantId: number | null;
  variantLabel: string | null;
  // Live-joined from the product (not snapshotted, same as productName) - only meaningful for
  // sale_mode 'bulk', where `quantity` is a count of 25-unit steps, not pieces.
  saleMode: 'piece' | 'bulk' | 'variant';
  bulkUnit: 'g' | 'ml' | null;
};

// Shared display formatting for one order line - a bulk item's quantity is a step count
// internally (see BULK_STEP) but should read as real grams/ml; a variant item's product name
// should carry its package size. Used anywhere an order's items are listed: admin/account order
// lists, invoice and dobropis PDFs, order-confirmation email.
export function formatOrderItemLine(item: OrderItemRecord): { name: string; quantity: string } {
  return {
    name: item.variantLabel ? `${item.productName} (${item.variantLabel})` : item.productName,
    quantity: item.saleMode === 'bulk' ? `${item.quantity * BULK_STEP} ${item.bulkUnit ?? 'g'}` : `${item.quantity} ks`,
  };
}

export type OrderRecord = {
  id: number;
  customerId: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerPostalCode: string | null;
  customerPhone: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestAddress: string | null;
  guestCity: string | null;
  guestPostalCode: string | null;
  guestPhone: string | null;
  variableSymbol: string | null;
  orderDate: Date;
  status: string;
  paidAt: Date | null;
  total: number;
  paymentMethod: string | null;
  fulfillmentMethod: 'shipping' | 'pickup';
  buyerType: 'individual' | 'company';
  companyName: string | null;
  companyIco: string | null;
  companyDic: string | null;
  companyIcDph: string | null;
  items: OrderItemRecord[];
};

// Resolves the "who is this order for and where does it ship" fields regardless of
// whether it's a customer-account order (live-joined from customers) or a guest order
// (captured directly on the order) - avoids repeating this ternary in every place that
// displays or emails order/shipping info.
export type OrderContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
};

export function getOrderContact(order: OrderRecord): OrderContact {
  if (order.customerId) {
    return {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      address: order.customerAddress,
      city: order.customerCity,
      postalCode: order.customerPostalCode,
    };
  }
  return {
    name: order.guestName,
    email: order.guestEmail,
    phone: order.guestPhone,
    address: order.guestAddress,
    city: order.guestCity,
    postalCode: order.guestPostalCode,
  };
}

export type CreateOrderInput = {
  items: { productId: number; quantity: number; variantId?: number }[];
  customerId?: number;
  guestName?: string;
  guestEmail?: string;
  guestAddress?: string;
  guestCity?: string;
  guestPostalCode?: string;
  guestPhone?: string;
  fulfillmentMethod?: 'shipping' | 'pickup';
  buyerType?: 'individual' | 'company';
  companyName?: string;
  companyIco?: string;
  companyDic?: string;
  companyIcDph?: string;
};

export type CreateOrderResult = { order: OrderRecord } | { error: string };

// Bank-transfer reference number shown to the customer (10 digits, e.g. "0042817360").
// Generated outside the order transaction, checked for uniqueness up front - a genuine
// collision would still be caught by the column's UNIQUE constraint at insert time
// (astronomically unlikely at 10^10 possibilities, so no retry-on-conflict needed there).
async function generateUniqueVariableSymbol(pool: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  for (;;) {
    const candidate = crypto.randomInt(0, 10_000_000_000).toString().padStart(10, '0');
    const { rows } = await pool.query('SELECT 1 FROM orders WHERE variable_symbol = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (input.items.length === 0) return { error: 'Košík je prázdny.' };

  // The cart UI only ever sends whole, positive quantities with one line per product/variant -
  // but this is a server action, so re-check rather than trust it: a negative quantity would
  // otherwise pass the stock check, produce a negative total and *raise* stock, and two lines
  // for the same product would each pass the stock check separately (stock is only decremented
  // after the loop) and oversell. Duplicate lines are merged so the stock check sees the sum.
  const merged = new Map<string, { productId: number; quantity: number; variantId?: number }>();
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isInteger(item.productId)) {
      return { error: 'Neplatné množstvo v košíku.' };
    }
    const key = `${item.productId}:${item.variantId ?? ''}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += item.quantity;
    else merged.set(key, { ...item });
  }
  const items = [...merged.values()];

  const pool = await getDb();
  const variableSymbol = await generateUniqueVariableSymbol(pool);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const fulfillmentMethod = input.fulfillmentMethod === 'pickup' ? 'pickup' : 'shipping';

    let total = 0;
    const lineItems: {
      productId: number;
      productName: string;
      quantity: number;
      price: number;
      vatRate: number;
      variantId: number | null;
      variantLabel: string | null;
      saleMode: 'piece' | 'bulk' | 'variant';
      bulkUnit: 'g' | 'ml' | null;
    }[] = [];

    for (const item of items) {
      const { rows } = await client.query(
        'SELECT id, name, price, stock, vat_rate, sale_mode, bulk_unit, pickup_only FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      );
      const product = rows[0];
      if (!product) {
        await client.query('ROLLBACK');
        return { error: `Produkt s ID ${item.productId} neexistuje.` };
      }
      // Checked server-side, not just hidden in the checkout UI - a pickup-only product (fresh/
      // fragile/local-only goods) must never end up on a "shipping" order, tampered request or not.
      if (product.pickup_only && fulfillmentMethod === 'shipping') {
        await client.query('ROLLBACK');
        return { error: `Produkt "${product.name}" je dostupný iba na predajni, nedá sa odoslať poštou.` };
      }

      // A variant product's own price/stock columns are unused (see db.ts) - ordering one
      // without a variant would sell it at that meaningless price, typically 0 €.
      if (product.sale_mode === 'variant' && !item.variantId) {
        await client.query('ROLLBACK');
        return { error: `Pri produkte "${product.name}" vyber prosím veľkosť balenia.` };
      }
      if (product.sale_mode !== 'variant' && item.variantId) {
        await client.query('ROLLBACK');
        return { error: `Produkt "${product.name}" nemá varianty.` };
      }

      if (item.variantId) {
        const { rows: variantRows } = await client.query(
          'SELECT * FROM product_variants WHERE id = $1 AND product_id = $2 FOR UPDATE',
          [item.variantId, item.productId]
        );
        const variant = variantRows[0];
        if (!variant) {
          await client.query('ROLLBACK');
          return { error: `Varianta produktu "${product.name}" neexistuje.` };
        }
        if (variant.stock < item.quantity) {
          await client.query('ROLLBACK');
          return { error: `Varianta "${variant.label}" produktu "${product.name}" nie je skladom v požadovanom množstve.` };
        }
        total += variant.price * item.quantity;
        lineItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          price: variant.price,
          vatRate: product.vat_rate,
          variantId: variant.id,
          variantLabel: variant.label,
          saleMode: product.sale_mode,
          bulkUnit: product.bulk_unit,
        });
        await client.query('UPDATE product_variants SET stock = stock - $1 WHERE id = $2', [
          item.quantity,
          variant.id,
        ]);
        continue;
      }

      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return { error: `Produkt "${product.name}" nie je skladom v požadovanom množstve.` };
      }
      // Bulk products price/stock per kg/L; price_at_order needs to be per BULK_STEP so it
      // stays meaningful at 2 decimal places (see productConstants.ts).
      const price =
        product.sale_mode === 'bulk' ? Math.round(((product.price * BULK_STEP) / 1000) * 100) / 100 : product.price;
      total += price * item.quantity;
      lineItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price,
        vatRate: product.vat_rate,
        variantId: null,
        variantLabel: null,
        saleMode: product.sale_mode,
        bulkUnit: product.bulk_unit,
      });
    }

    // Pickup orders skip "čaká sa na platbu" (bank-transfer wait) entirely - payment happens
    // in person at the counter, so there's nothing to wait on before that point.
    const initialStatus = fulfillmentMethod === 'pickup' ? 'pickup' : 'pending';

    // Company fields only stick for company orders - a private order never carries them, even
    // if a stale client happens to send some.
    const isCompany = input.buyerType === 'company';
    const buyerType = isCompany ? 'company' : 'individual';
    const companyName = isCompany ? input.companyName?.trim() || null : null;
    const companyIco = isCompany ? input.companyIco?.trim() || null : null;
    const companyDic = isCompany ? input.companyDic?.trim() || null : null;
    const companyIcDph = isCompany ? input.companyIcDph?.trim() || null : null;

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (customer_id, guest_name, guest_email, guest_address, guest_city, guest_postal_code, guest_phone, status, total, variable_symbol, fulfillment_method,
                           buyer_type, company_name, company_ico, company_dic, company_ic_dph)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id, order_date`,
      [
        input.customerId ?? null,
        input.guestName ?? null,
        input.guestEmail ?? null,
        input.guestAddress ?? null,
        input.guestCity ?? null,
        input.guestPostalCode ?? null,
        input.guestPhone ?? null,
        initialStatus,
        total,
        variableSymbol,
        fulfillmentMethod,
        buyerType,
        companyName,
        companyIco,
        companyDic,
        companyIcDph,
      ]
    );
    const orderId = orderRows[0].id as number;

    let customerName: string | null = null;
    let customerEmail: string | null = null;
    let customerAddress: string | null = null;
    let customerCity: string | null = null;
    let customerPostalCode: string | null = null;
    let customerPhone: string | null = null;
    if (input.customerId) {
      const { rows: customerRows } = await client.query(
        'SELECT name, email, address, city, postal_code, phone FROM customers WHERE id = $1',
        [input.customerId]
      );
      if (customerRows[0]) {
        customerName = customerRows[0].name;
        customerEmail = customerRows[0].email;
        customerAddress = customerRows[0].address;
        customerCity = customerRows[0].city;
        customerPostalCode = customerRows[0].postal_code;
        customerPhone = customerRows[0].phone;
      }
    }

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_order, vat_rate, variant_id, variant_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, li.productId, li.quantity, li.price, li.vatRate, li.variantId, li.variantLabel]
      );
      // Variant stock was already locked and decremented above, on product_variants - a
      // variant-mode product's own stock column is unused, so it's left untouched here.
      if (!li.variantId) {
        await client.query('UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2', [
          li.quantity,
          li.productId,
        ]);
      }
    }

    await client.query('COMMIT');

    return {
      order: {
        id: orderId,
        customerId: input.customerId ?? null,
        customerName,
        customerEmail,
        customerAddress,
        customerCity,
        customerPostalCode,
        customerPhone,
        guestName: input.guestName ?? null,
        guestEmail: input.guestEmail ?? null,
        guestAddress: input.guestAddress ?? null,
        guestCity: input.guestCity ?? null,
        guestPostalCode: input.guestPostalCode ?? null,
        guestPhone: input.guestPhone ?? null,
        variableSymbol,
        orderDate: orderRows[0].order_date,
        status: initialStatus,
        paidAt: null,
        total,
        paymentMethod: null,
        fulfillmentMethod,
        buyerType,
        companyName,
        companyIco,
        companyDic,
        companyIcDph,
        items: lineItems.map((li) => ({
          productId: li.productId,
          productName: li.productName,
          quantity: li.quantity,
          priceAtOrder: li.price,
          vatRate: li.vatRate,
          variantId: li.variantId,
          variantLabel: li.variantLabel,
          saleMode: li.saleMode,
          bulkUnit: li.bulkUnit,
        })),
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Maps one raw ORDER_SELECT row into everything but `items` - split out from attachItems so
// invoices.ts can build an OrderRecord-shaped object from a row it locks itself (inside its
// own transaction), without going through getOrderById()'s separate pool connection.
export function mapOrderRow(o: Record<string, unknown>): Omit<OrderRecord, 'items'> {
  return {
    id: o.id as number,
    customerId: o.customer_id as number | null,
    customerName: (o.customer_name as string | null) ?? null,
    customerEmail: (o.customer_email as string | null) ?? null,
    customerAddress: (o.customer_address as string | null) ?? null,
    customerCity: (o.customer_city as string | null) ?? null,
    customerPostalCode: (o.customer_postal_code as string | null) ?? null,
    customerPhone: (o.customer_phone as string | null) ?? null,
    guestName: o.guest_name as string | null,
    guestEmail: o.guest_email as string | null,
    guestAddress: o.guest_address as string | null,
    guestCity: o.guest_city as string | null,
    guestPostalCode: o.guest_postal_code as string | null,
    guestPhone: o.guest_phone as string | null,
    variableSymbol: o.variable_symbol as string | null,
    orderDate: o.order_date as Date,
    status: o.status as string,
    paidAt: o.paid_at as Date | null,
    total: o.total as number,
    paymentMethod: o.payment_method as string | null,
    fulfillmentMethod: o.fulfillment_method as 'shipping' | 'pickup',
    buyerType: o.buyer_type as 'individual' | 'company',
    companyName: o.company_name as string | null,
    companyIco: o.company_ico as string | null,
    companyDic: o.company_dic as string | null,
    companyIcDph: o.company_ic_dph as string | null,
  };
}

async function attachItems(pool: Awaited<ReturnType<typeof getDb>>, orders: Record<string, unknown>[]): Promise<OrderRecord[]> {
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id as number);
  const { rows } = await pool.query(
    `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_at_order, oi.vat_rate, oi.variant_id, oi.variant_label,
            p.name as product_name, p.sale_mode, p.bulk_unit
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1)`,
    [ids]
  );

  const byOrder = new Map<number, OrderItemRecord[]>();
  for (const row of rows) {
    const arr = byOrder.get(row.order_id) ?? [];
    arr.push({
      productId: row.product_id,
      productName: row.product_name,
      quantity: row.quantity,
      priceAtOrder: row.price_at_order,
      vatRate: row.vat_rate,
      variantId: row.variant_id,
      variantLabel: row.variant_label,
      saleMode: row.sale_mode,
      bulkUnit: row.bulk_unit,
    });
    byOrder.set(row.order_id, arr);
  }

  return orders.map((o) => ({
    ...mapOrderRow(o),
    items: byOrder.get(o.id as number) ?? [],
  }));
}

export const ORDER_SELECT = `SELECT o.*, c.name as customer_name, c.email as customer_email, c.address as customer_address,
     c.city as customer_city, c.postal_code as customer_postal_code, c.phone as customer_phone
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id`;

export async function getOrdersForCustomer(customerId: number): Promise<OrderRecord[]> {
  const pool = await getDb();
  const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.customer_id = $1 ORDER BY o.order_date DESC`, [
    customerId,
  ]);
  return attachItems(pool, rows);
}

export async function getAllOrders(): Promise<OrderRecord[]> {
  const pool = await getDb();
  const { rows } = await pool.query(`${ORDER_SELECT} ORDER BY o.order_date DESC`);
  return attachItems(pool, rows);
}

export async function getOrderById(id: number): Promise<OrderRecord | null> {
  const pool = await getDb();
  const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  if (rows.length === 0) return null;
  return (await attachItems(pool, rows))[0];
}

export async function updateOrderStatus(id: number, status: string): Promise<void> {
  const pool = await getDb();
  await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
}

// Cancels and puts the ordered goods back on stock, in one transaction - the status flip is
// conditional on the order not already being cancelled, so a double-submit can't restock twice.
// Goods are only restocked if they never left the shop: a "shipped" (vybavená) order that gets
// cancelled afterwards is a return, and whether those goods come back sellable is the admin's
// call (manual stock control), not something to assume here.
// Returns false if the order was already cancelled (nothing changed).
export async function cancelOrder(id: number): Promise<boolean> {
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0] || rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      return false;
    }
    const restock = rows[0].status !== 'shipped';
    await client.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [id]);
    if (restock) {
      const { rows: items } = await client.query(
        'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = $1',
        [id]
      );
      for (const item of items) {
        if (item.variant_id) {
          await client.query('UPDATE product_variants SET stock = stock + $1 WHERE id = $2', [
            item.quantity,
            item.variant_id,
          ]);
        } else {
          await client.query('UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2', [
            item.quantity,
            item.product_id,
          ]);
        }
      }
    }
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Only sets paid_at the first time - a later paid -> shipped -> paid bounce must not overwrite
// the original "payment confirmed" timestamp, since that's the audit trail this exists for.
export async function markOrderPaid(id: number): Promise<void> {
  const pool = await getDb();
  await pool.query('UPDATE orders SET paid_at = now() WHERE id = $1 AND paid_at IS NULL', [id]);
}
