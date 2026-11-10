import fs from 'fs/promises';
import path from 'path';
import { getDb } from './db';
import { ORDER_SELECT, mapOrderRow, getOrderContact, getOrderById } from './orders';
import { getSettings } from './settings';
import { renderInvoicePdf } from './invoice-pdf';

export type Invoice = {
  id: number;
  orderId: number;
  invoiceNumber: string;
  issuedAt: Date;
  pdfPath: string;
  sentAt: Date | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerPostalCode: string | null;
  customerCompanyName: string | null;
  customerIco: string | null;
  customerDic: string | null;
  customerIcDph: string | null;
  sellerName: string;
  sellerAddress: string;
  sellerIco: string | null;
  sellerDic: string | null;
  sellerIcDph: string | null;
  sellerIban: string | null;
};

export const INVOICE_DIR = path.join(process.cwd(), 'storage', 'invoices');

function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    invoiceNumber: row.invoice_number as string,
    issuedAt: row.issued_at as Date,
    pdfPath: row.pdf_path as string,
    sentAt: (row.sent_at as Date | null) ?? null,
    customerName: row.customer_name as string | null,
    customerEmail: row.customer_email as string | null,
    customerPhone: row.customer_phone as string | null,
    customerAddress: row.customer_address as string | null,
    customerCity: row.customer_city as string | null,
    customerPostalCode: row.customer_postal_code as string | null,
    customerCompanyName: row.customer_company_name as string | null,
    customerIco: row.customer_ico as string | null,
    customerDic: row.customer_dic as string | null,
    customerIcDph: row.customer_ic_dph as string | null,
    sellerName: row.seller_name as string,
    sellerAddress: row.seller_address as string,
    sellerIco: row.seller_ico as string | null,
    sellerDic: row.seller_dic as string | null,
    sellerIcDph: row.seller_ic_dph as string | null,
    sellerIban: row.seller_iban as string | null,
  };
}

// Single transaction, all-or-nothing: the PDF is rendered and written to disk *inside* the
// lock, before the counter is ever actually consumed or the row inserted - so any failure
// anywhere (including a render crash) rolls back everything and leaves nothing to clean up.
// Invoices only ever exist for orders that were genuinely confirmed paid (see order-actions.ts
// - "paid" and "invoice generated" are deliberately separate, admin-triggered moments).
export async function generateInvoiceForOrder(orderId: number): Promise<Invoice> {
  const pool = await getDb();
  const client = await pool.connect();
  const year = new Date().getFullYear();

  try {
    await client.query('BEGIN');

    // Lock the current year's counter row before doing anything else - this is the point
    // past which no other concurrent generateInvoiceForOrder call, for any order, proceeds
    // until this transaction commits or rolls back.
    await client.query(
      'INSERT INTO invoice_number_counter (year, last_number) VALUES ($1, 0) ON CONFLICT (year) DO NOTHING',
      [year]
    );
    const { rows: counterRows } = await client.query(
      'SELECT last_number FROM invoice_number_counter WHERE year = $1 FOR UPDATE',
      [year]
    );
    // The number is only *reserved* here (needed to print on the PDF itself) - the counter
    // row stays locked until commit/rollback, so no other transaction can compute the same
    // "next" value in the meantime; it's only actually persisted as consumed further below,
    // after the render has already succeeded.
    const nextNumber = (counterRows[0].last_number as number) + 1;
    const invoiceNumber = `ESH-${year}-${String(nextNumber).padStart(4, '0')}`;

    const { rows: orderRows } = await client.query(`${ORDER_SELECT} WHERE o.id = $1 FOR UPDATE OF o`, [orderId]);
    if (orderRows.length === 0) throw new Error(`Objednávka #${orderId} neexistuje.`);
    const orderRow = mapOrderRow(orderRows[0]);
    if (!orderRow.paidAt) {
      throw new Error(`Objednávka #${orderId} ešte nie je označená ako zaplatená.`);
    }

    const { rows: existingRows } = await client.query('SELECT * FROM invoices WHERE order_id = $1', [orderId]);
    if (existingRows.length > 0) {
      // Idempotent: whether a genuine double-click, two tabs, or a later re-entry, an order
      // that already has an invoice must never get a second one - it stays frozen.
      await client.query('COMMIT');
      return mapInvoiceRow(existingRows[0]);
    }

    const contact = getOrderContact({ ...orderRow, items: [] });
    const settings = await getSettings();
    // order_items/total are immutable once written, so a plain pool read is fine here even
    // mid-transaction - nothing concurrent can change them.
    const orderWithItems = await getOrderById(orderId);
    if (!orderWithItems) throw new Error(`Objednávka #${orderId} neexistuje.`);

    const draft: Invoice = {
      id: 0,
      orderId,
      invoiceNumber,
      issuedAt: new Date(),
      pdfPath: '',
      sentAt: null,
      customerName: contact.name,
      customerEmail: contact.email,
      customerPhone: contact.phone,
      customerAddress: contact.address,
      customerCity: contact.city,
      customerPostalCode: contact.postalCode,
      customerCompanyName: orderRow.companyName,
      customerIco: orderRow.companyIco,
      customerDic: orderRow.companyDic,
      customerIcDph: orderRow.companyIcDph,
      sellerName: settings.shop_name,
      sellerAddress: settings.address,
      sellerIco: settings.ico || null,
      sellerDic: settings.dic || null,
      sellerIcDph: settings.ic_dph || null,
      sellerIban: settings.iban || null,
    };

    const buffer = await renderInvoicePdf(
      draft,
      orderWithItems.items,
      orderWithItems.total,
      orderId,
      orderWithItems.variableSymbol,
      orderWithItems.orderDate
    );
    await fs.mkdir(INVOICE_DIR, { recursive: true });
    const filename = `${invoiceNumber}.pdf`;
    await fs.writeFile(path.join(INVOICE_DIR, filename), buffer);

    // Only now does the number actually get consumed.
    await client.query('UPDATE invoice_number_counter SET last_number = $1 WHERE year = $2', [nextNumber, year]);

    const { rows: insertedRows } = await client.query(
      `INSERT INTO invoices (
        order_id, invoice_number, pdf_path,
        customer_name, customer_email, customer_phone, customer_address, customer_city, customer_postal_code,
        customer_company_name, customer_ico, customer_dic, customer_ic_dph,
        seller_name, seller_address, seller_ico, seller_dic, seller_ic_dph, seller_iban
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        orderId,
        invoiceNumber,
        filename,
        contact.name,
        contact.email,
        contact.phone,
        contact.address,
        contact.city,
        contact.postalCode,
        orderRow.companyName,
        orderRow.companyIco,
        orderRow.companyDic,
        orderRow.companyIcDph,
        settings.shop_name,
        settings.address,
        settings.ico || null,
        settings.dic || null,
        settings.ic_dph || null,
        settings.iban || null,
      ]
    );

    await client.query('COMMIT');
    return mapInvoiceRow(insertedRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getInvoiceByOrderId(orderId: number): Promise<Invoice | null> {
  const pool = await getDb();
  const { rows } = await pool.query('SELECT * FROM invoices WHERE order_id = $1', [orderId]);
  if (rows.length === 0) return null;
  return mapInvoiceRow(rows[0]);
}

export async function getInvoiceById(id: number): Promise<Invoice | null> {
  const pool = await getDb();
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return mapInvoiceRow(rows[0]);
}

export async function markInvoiceSent(id: number): Promise<void> {
  const pool = await getDb();
  await pool.query('UPDATE invoices SET sent_at = now() WHERE id = $1', [id]);
}
