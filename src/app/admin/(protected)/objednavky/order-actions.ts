'use server';

import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { cancelOrder, getOrderById, getOrderContact, markOrderPaid, updateOrderStatus, type OrderRecord } from '@/lib/orders';
import { sendCancelledEmail, sendPaidEmail, sendReadyForPickupEmail, sendShippedEmail } from '@/lib/email';
import { getSettings } from '@/lib/settings';
import { generateInvoiceForOrder, getInvoiceByOrderId, INVOICE_DIR, markInvoiceSent, type Invoice } from '@/lib/invoices';
import { isBackwardTransition, isStatusOnTrack } from '@/lib/orderStatuses';

// The vybavená email - the one that carries the invoice PDF. Records sent_at only on a confirmed
// send, so a failed one (SMTP down, PDF missing on disk) shows up as unsent on the admin orders
// page, where resendInvoiceAction below can retry it.
async function sendInvoiceEmail(order: OrderRecord, invoice: Invoice): Promise<void> {
  const recipientEmail = getOrderContact(order).email;
  if (!recipientEmail) return;
  try {
    const settings = await getSettings();
    const content = await fs.readFile(path.join(INVOICE_DIR, invoice.pdfPath));
    const sent = await sendShippedEmail(order, recipientEmail, settings, {
      filename: `${invoice.invoiceNumber}.pdf`,
      content,
    });
    if (sent) await markInvoiceSent(invoice.id);
  } catch (err) {
    console.error(`Odoslanie faktúry k objednávke #${order.id} zlyhalo:`, err);
  }
}

export async function updateOrderStatusAction(orderId: number, formData: FormData) {
  const status = String(formData.get('status') || 'pending');

  const existing = await getOrderById(orderId);
  if (!existing) return;

  if (!isStatusOnTrack(existing.fulfillmentMethod, status)) {
    console.error(`Odmietnuté: stav "${status}" nepatrí k objednávke #${orderId} (${existing.fulfillmentMethod}).`);
    return;
  }

  // Dropdown already hides backward steps (paid -> pending, ready_for_pickup -> pickup, etc.)
  // and reopening a cancelled order - refuse here too rather than trusting a stale page or a
  // tampered request.
  if (isBackwardTransition(existing.fulfillmentMethod, existing.status, status)) {
    console.error(`Odmietnuté: objednávka #${orderId} sa nemôže vrátiť z "${existing.status}" na "${status}".`);
    return;
  }

  const isPickup = existing.fulfillmentMethod === 'pickup';
  const justShipped = existing.status !== 'shipped' && status === 'shipped';

  // "Objednávka vybavená" requires payment confirmed AND an invoice already generated - the
  // dropdown already hides this option until both are true, but the action itself must not
  // trust that (a stale page, or a tampered request, could still submit it). Silently refuse
  // rather than applying a status that implies an invoice was sent when none exists.
  //
  // Pickup orders skip all of this: they're paid in cash/card at the counter, not by bank
  // transfer, so there's no invoice and nothing to guard here - "shipped" just means "customer
  // collected it in person."
  let invoiceForShipping: Awaited<ReturnType<typeof getInvoiceByOrderId>> = null;
  if (justShipped && !isPickup) {
    if (!existing.paidAt) {
      console.error(`Odmietnuté: objednávka #${orderId} nie je označená ako zaplatená.`);
      return;
    }
    invoiceForShipping = await getInvoiceByOrderId(orderId);
    if (!invoiceForShipping) {
      console.error(`Odmietnuté: objednávka #${orderId} ešte nemá vygenerovanú faktúru.`);
      return;
    }
  }

  // Cancelling also puts unshipped goods back on stock (see cancelOrder) - false means the order
  // was already cancelled by a concurrent submit, so skip the second cancellation email too.
  let justCancelled = false;
  if (status === 'cancelled') {
    justCancelled = await cancelOrder(orderId);
  } else {
    await updateOrderStatus(orderId, status);
  }

  const justPaid = existing.status !== 'paid' && status === 'paid';
  // The pickup-only middle step - "your order is ready, come collect it" - is the one moment
  // that actually needs a customer notification on that track; the final "shipped" step doesn't
  // (they're standing at the counter when it happens), unlike shipping orders where "shipped"
  // is the notification moment.
  const justReadyForPickup = existing.status !== 'ready_for_pickup' && status === 'ready_for_pickup';

  // Marking an order paid only records when payment was confirmed and notifies the customer -
  // it deliberately does NOT generate the invoice itself. Conflating "I've verified the bank
  // transfer landed" with "issue the formal legal invoice" into one click risks issuing a real
  // invoice before money has actually arrived, and loses the audit trail between the two
  // moments. Invoice generation is its own explicit action - see generateInvoiceAction below.
  //
  // Also deliberately not auto-generated: an invoice created outside the paid->shipped flow (or
  // a dobropis created outside an explicit admin click) has no guaranteed path to ever reach the
  // customer - only the vybavená transition emails an invoice, and only the manual "Poslať
  // dobropis zákazníkovi" button emails a dobropis. Auto-generating either one risks a document
  // existing in the system that silently never gets sent. Manual generation keeps "a document
  // was created" and "someone is responsible for making sure it's sent" tied together.
  if (justPaid) await markOrderPaid(orderId);

  if (justPaid || justShipped || justCancelled || justReadyForPickup) {
    const recipientEmail = getOrderContact(existing).email;
    if (recipientEmail) {
      const settings = await getSettings();
      const updated = { ...existing, status };
      if (justPaid) await sendPaidEmail(updated, recipientEmail, settings);
      if (justReadyForPickup) await sendReadyForPickupEmail(updated, recipientEmail, settings);
      if (justShipped && invoiceForShipping) {
        // Guaranteed to exist by the guard above - this is the one moment the customer
        // actually receives the invoice PDF, bundled with the "order processed, here's what's
        // next" message (email_shipped_text, editable in Nastavenia). Pickup orders never reach
        // here with an invoice at all, so this only ever fires for shipping orders.
        await sendInvoiceEmail(updated, invoiceForShipping);
      }
      if (justCancelled) await sendCancelledEmail(updated, recipientEmail, settings);
    }
  }

  revalidatePath('/admin/objednavky');
}

// Manual resend of the vybavená email + invoice PDF - for when the original send failed
// (sent_at still null) or the customer says it never arrived. Only for orders that are actually
// vybavená, so it can't be used to send an invoice ahead of the normal flow.
export async function resendInvoiceAction(orderId: number): Promise<void> {
  const order = await getOrderById(orderId);
  const invoice = order ? await getInvoiceByOrderId(orderId) : null;
  if (order && invoice && order.status === 'shipped') {
    await sendInvoiceEmail(order, invoice);
  }
  revalidatePath('/admin/objednavky');
}

export async function generateInvoiceAction(orderId: number): Promise<void> {
  try {
    await generateInvoiceForOrder(orderId);
  } catch (err) {
    console.error('Generovanie faktúry zlyhalo:', err);
  }
  revalidatePath('/admin/objednavky');
}
