import nodemailer from 'nodemailer';
import { getOrderContact, formatOrderItemLine, type OrderRecord } from './orders';
import type { ShopSettings } from './settings';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER a SMTP_PASS musia byť nastavené (pozri .env.example).');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function formatOrderSummary(order: OrderRecord, paymentInstructions: string): string {
  const lines = order.items.map((item) => {
    const line = formatOrderItemLine(item);
    return `${line.quantity} × ${line.name} — ${(item.priceAtOrder * item.quantity).toFixed(2)} €`;
  });
  return [
    `Objednávka #${order.id}`,
    '',
    ...lines,
    '',
    `Celkom: ${order.total.toFixed(2)} €`,
    '',
    paymentInstructions ? `Platobné inštrukcie:\n${paymentInstructions}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatShippingInfo(order: OrderRecord): string {
  const contact = getOrderContact(order);
  const addressLine = [contact.address, [contact.postalCode, contact.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const lines = [
    order.buyerType === 'company' && order.companyName && `Firma: ${order.companyName}`,
    order.buyerType === 'company' && order.companyIco && `IČO: ${order.companyIco}`,
    order.buyerType === 'company' && order.companyDic && `DIČ: ${order.companyDic}`,
    order.buyerType === 'company' && order.companyIcDph && `IČ DPH: ${order.companyIcDph}`,
    contact.name && `Meno: ${contact.name}`,
    contact.email && `E-mail: ${contact.email}`,
    contact.phone && `Telefón: ${contact.phone}`,
    addressLine && `Adresa: ${addressLine}`,
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : '';
}

// Footer used on all customer-facing status emails (pending/shipped/cancelled) - not on the
// owner's internal "new order" notification, which doesn't need the shop's own contact info.
function formatFooter(settings: ShopSettings): string {
  const lines = [
    settings.shop_name,
    settings.address,
    '',
    settings.website_url,
    settings.phone,
  ].filter((line) => line !== '');
  return lines.join('\n');
}

function orderUrl(settings: ShopSettings, orderId: number): string | null {
  if (!settings.website_url) return null;
  return `${settings.website_url.replace(/\/$/, '')}/objednavka-prijata?id=${orderId}`;
}

// Lets the shop owner edit email wording from Nastavenia without a redeploy - templates
// are plain text with {{token}} placeholders, substituted here at send time.
function renderTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => tokens[key] ?? match);
}

export async function sendOrderEmails(
  order: OrderRecord,
  recipientEmail: string,
  settings: ShopSettings
): Promise<void> {
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    const isPickup = order.fulfillmentMethod === 'pickup';
    const link = orderUrl(settings, order.id);
    const customerText = [
      renderTemplate(isPickup ? settings.email_pickup_text : settings.email_pending_text, {
        cislo: String(order.id),
      }),
      '',
      [
        link ? `Detaily objednávky nájdete tu: ${link}` : '',
        `Suma: ${order.total.toFixed(2)} €`,
        // Pickup orders are paid in person at the counter - bank-transfer instructions here
        // would be actively wrong, not just unnecessary.
        isPickup
          ? 'Platba prebehne pri vyzdvihnutí na predajni.'
          : [
              settings.iban ? `IBAN: ${settings.iban}` : '',
              order.variableSymbol ? `Variabilný symbol: ${order.variableSymbol}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
      ]
        .filter(Boolean)
        .join('\n'),
      '',
      settings.email ? `V prípade akýchkoľvek otázok nás môžete kontaktovať na e-maile ${settings.email}` : '',
      '',
      formatFooter(settings),
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: isPickup
        ? `Objednávka č. ${order.id} – pripravuje sa na vyzdvihnutie`
        : `Čaká sa na úhradu – Objednávka č. ${order.id}`,
      text: customerText,
    });

    if (settings.email) {
      const shipping = formatShippingInfo(order);
      const summary = formatOrderSummary(order, settings.payment_instructions);
      const ownerText = [shipping, '', summary].filter(Boolean).join('\n');
      await transporter.sendMail({
        from,
        to: settings.email,
        subject: `Nová objednávka #${order.id}`,
        text: ownerText,
      });
    }
  } catch (err) {
    console.error('Odoslanie e-mailu o objednávke zlyhalo:', err);
  }
}

export async function sendPaidEmail(
  order: OrderRecord,
  recipientEmail: string,
  settings: ShopSettings
): Promise<void> {
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    const text = [
      renderTemplate(settings.email_paid_text, { cislo: String(order.id) }),
      '',
      settings.email ? `V prípade akýchkoľvek otázok nás môžete kontaktovať na e-maile ${settings.email}` : '',
      '',
      formatFooter(settings),
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: `Platba prijatá – Objednávka č. ${order.id}`,
      text,
    });
  } catch (err) {
    console.error('Odoslanie e-mailu o prijatí platby zlyhalo:', err);
  }
}

// "Objednávka vybavená" (internal status code stays "shipped") is only reachable once an order
// is paid and invoiced (enforced in order-actions.ts), so this always carries the invoice PDF -
// the customer's one guaranteed delivery of it. No "dobierka" (cash-on-delivery amount) line
// here anymore: by definition, an order that reached this status was already paid by transfer,
// so mentioning a COD amount owed would be actively wrong.
export async function sendShippedEmail(
  order: OrderRecord,
  recipientEmail: string,
  settings: ShopSettings,
  invoiceAttachment: { filename: string; content: Buffer }
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    const text = [
      renderTemplate(settings.email_shipped_text, { cislo: String(order.id) }),
      '',
      settings.email ? `V prípade akýchkoľvek otázok nás môžete kontaktovať na e-maile ${settings.email}` : '',
      '',
      formatFooter(settings),
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: `Objednávka č. ${order.id} bola vybavená`,
      text,
      attachments: [invoiceAttachment],
    });
    return true;
  } catch (err) {
    console.error('Odoslanie e-mailu o vybavení objednávky zlyhalo:', err);
    return false;
  }
}

export async function sendReadyForPickupEmail(
  order: OrderRecord,
  recipientEmail: string,
  settings: ShopSettings
): Promise<void> {
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    const text = [
      renderTemplate(settings.email_ready_for_pickup_text, { cislo: String(order.id) }),
      '',
      settings.email ? `V prípade akýchkoľvek otázok nás môžete kontaktovať na e-maile ${settings.email}` : '',
      '',
      formatFooter(settings),
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: `Objednávka č. ${order.id} je pripravená na vyzdvihnutie`,
      text,
    });
  } catch (err) {
    console.error('Odoslanie e-mailu o pripravenosti na vyzdvihnutie zlyhalo:', err);
  }
}

export async function sendCancelledEmail(
  order: OrderRecord,
  recipientEmail: string,
  settings: ShopSettings
): Promise<void> {
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    const text = [
      renderTemplate(settings.email_cancelled_text, { cislo: String(order.id) }),
      '',
      settings.email
        ? `V prípade akýchkoľvek otázok alebo ak si prajete objednávku obnoviť, nás môžete kontaktovať na e-maile ${settings.email}.`
        : '',
      '',
      formatFooter(settings),
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: `Zrušenie objednávky č. ${order.id}`,
      text,
    });
  } catch (err) {
    console.error('Odoslanie e-mailu o zrušení objednávky zlyhalo:', err);
  }
}

export async function sendCreditNoteEmail(
  order: OrderRecord,
  recipientEmail: string,
  settings: ShopSettings,
  invoiceNumber: string,
  creditNoteNumber: string,
  refundAmount: number,
  attachment: { filename: string; content: Buffer }
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    const text = [
      renderTemplate(settings.email_credit_note_text, {
        cislo: String(order.id),
        faktura: invoiceNumber,
        dobropis: creditNoteNumber,
        suma: refundAmount.toFixed(2),
      }),
      '',
      settings.email ? `V prípade akýchkoľvek otázok nás môžete kontaktovať na e-maile ${settings.email}` : '',
      '',
      formatFooter(settings),
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: `Dobropis k objednávke č. ${order.id}`,
      text,
      attachments: [attachment],
    });
    return true;
  } catch (err) {
    console.error('Odoslanie e-mailu s dobropisom zlyhalo:', err);
    return false;
  }
}
