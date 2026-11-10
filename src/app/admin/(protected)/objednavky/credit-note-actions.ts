'use server';

import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { getOrderById, getOrderContact } from '@/lib/orders';
import { getInvoiceById, INVOICE_DIR } from '@/lib/invoices';
import { generateCreditNoteForOrder, getCreditNoteByOrderId, markCreditNoteSent } from '@/lib/credit-notes';
import { sendCreditNoteEmail } from '@/lib/email';
import { getSettings } from '@/lib/settings';

export async function generateCreditNoteAction(orderId: number): Promise<void> {
  try {
    await generateCreditNoteForOrder(orderId);
  } catch (err) {
    console.error('Generovanie dobropisu zlyhalo:', err);
  }
  revalidatePath('/admin/objednavky');
}

export async function sendCreditNoteAction(orderId: number): Promise<void> {
  try {
    const creditNote = await getCreditNoteByOrderId(orderId);
    const order = await getOrderById(orderId);
    const invoice = creditNote ? await getInvoiceById(creditNote.invoiceId) : null;
    const recipientEmail = order ? getOrderContact(order).email : null;

    if (creditNote && order && invoice && recipientEmail) {
      const settings = await getSettings();
      const content = await fs.readFile(path.join(INVOICE_DIR, creditNote.pdfPath));
      // Only mark sent on a confirmed send - the email helper swallows SMTP errors itself.
      const sent = await sendCreditNoteEmail(
        order,
        recipientEmail,
        settings,
        invoice.invoiceNumber,
        creditNote.creditNoteNumber,
        order.total,
        { filename: `${creditNote.creditNoteNumber}.pdf`, content }
      );
      if (sent) await markCreditNoteSent(creditNote.id);
    }
  } catch (err) {
    console.error('Odoslanie dobropisu zlyhalo:', err);
  }
  revalidatePath('/admin/objednavky');
}
