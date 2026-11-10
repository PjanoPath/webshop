import fs from 'fs/promises';
import path from 'path';
import { getDb } from './db';
import { ORDER_SELECT, mapOrderRow, getOrderContact, getOrderById } from './orders';
import { getSettings } from './settings';
import { getInvoiceByOrderId, INVOICE_DIR } from './invoices';
import { renderCreditNotePdf } from './credit-note-pdf';

export type CreditNote = {
  id: number;
  orderId: number;
  invoiceId: number;
  creditNoteNumber: string;
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

function mapCreditNoteRow(row: Record<string, unknown>): CreditNote {
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    invoiceId: row.invoice_id as number,
    creditNoteNumber: row.credit_note_number as string,
    issuedAt: row.issued_at as Date,
    pdfPath: row.pdf_path as string,
    sentAt: row.sent_at as Date | null,
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

// Same single-transaction, all-or-nothing shape as generateInvoiceForOrder in lib/invoices.ts -
// see that file's comments for the full reasoning. A dobropis only ever exists for an order
// that is cancelled AND already has an invoice; the button that triggers this is only shown
// under those conditions, but this function re-checks both itself rather than trusting the
// caller (same "don't trust the caller" pattern used there for paidAt).
export async function generateCreditNoteForOrder(orderId: number): Promise<CreditNote> {
  const pool = await getDb();
  const client = await pool.connect();
  const year = new Date().getFullYear();

  try {
    await client.query('BEGIN');

    // Lock the credit-note counter for this year - independent sequence from
    // invoice_number_counter, same locking scheme (see that table's comment in db.ts).
    await client.query(
      'INSERT INTO credit_note_counter (year, last_number) VALUES ($1, 0) ON CONFLICT (year) DO NOTHING',
      [year]
    );
    const { rows: counterRows } = await client.query(
      'SELECT last_number FROM credit_note_counter WHERE year = $1 FOR UPDATE',
      [year]
    );
    const nextNumber = (counterRows[0].last_number as number) + 1;
    const creditNoteNumber = `DOB-${year}-${String(nextNumber).padStart(4, '0')}`;

    const { rows: orderRows } = await client.query(`${ORDER_SELECT} WHERE o.id = $1 FOR UPDATE OF o`, [orderId]);
    if (orderRows.length === 0) throw new Error(`Objednávka #${orderId} neexistuje.`);
    const orderRow = mapOrderRow(orderRows[0]);
    if (orderRow.status !== 'cancelled') {
      throw new Error(`Objednávka #${orderId} nie je zrušená.`);
    }

    const invoice = await getInvoiceByOrderId(orderId);
    if (!invoice) {
      throw new Error(`Objednávka #${orderId} ešte nemá vystavenú faktúru, dobropis nie je možné vystaviť.`);
    }

    const { rows: existingRows } = await client.query('SELECT * FROM credit_notes WHERE order_id = $1', [orderId]);
    if (existingRows.length > 0) {
      // Idempotent, same reasoning as invoices: never issue a second credit note for an
      // order that already has one.
      await client.query('COMMIT');
      return mapCreditNoteRow(existingRows[0]);
    }

    const contact = getOrderContact({ ...orderRow, items: [] });
    const settings = await getSettings();
    const orderWithItems = await getOrderById(orderId);
    if (!orderWithItems) throw new Error(`Objednávka #${orderId} neexistuje.`);

    const draft: CreditNote = {
      id: 0,
      orderId,
      invoiceId: invoice.id,
      creditNoteNumber,
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

    const buffer = await renderCreditNotePdf(
      draft,
      invoice.invoiceNumber,
      orderWithItems.items,
      orderWithItems.total,
      orderId
    );
    await fs.mkdir(INVOICE_DIR, { recursive: true });
    const filename = `${creditNoteNumber}.pdf`;
    await fs.writeFile(path.join(INVOICE_DIR, filename), buffer);

    // Only now does the number actually get consumed.
    await client.query('UPDATE credit_note_counter SET last_number = $1 WHERE year = $2', [nextNumber, year]);

    const { rows: insertedRows } = await client.query(
      `INSERT INTO credit_notes (
        order_id, invoice_id, credit_note_number, pdf_path,
        customer_name, customer_email, customer_phone, customer_address, customer_city, customer_postal_code,
        customer_company_name, customer_ico, customer_dic, customer_ic_dph,
        seller_name, seller_address, seller_ico, seller_dic, seller_ic_dph, seller_iban
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [
        orderId,
        invoice.id,
        creditNoteNumber,
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
    return mapCreditNoteRow(insertedRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCreditNoteByOrderId(orderId: number): Promise<CreditNote | null> {
  const pool = await getDb();
  const { rows } = await pool.query('SELECT * FROM credit_notes WHERE order_id = $1', [orderId]);
  if (rows.length === 0) return null;
  return mapCreditNoteRow(rows[0]);
}

export async function getCreditNoteById(id: number): Promise<CreditNote | null> {
  const pool = await getDb();
  const { rows } = await pool.query('SELECT * FROM credit_notes WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return mapCreditNoteRow(rows[0]);
}

export async function markCreditNoteSent(id: number): Promise<void> {
  const pool = await getDb();
  await pool.query('UPDATE credit_notes SET sent_at = now() WHERE id = $1', [id]);
}
