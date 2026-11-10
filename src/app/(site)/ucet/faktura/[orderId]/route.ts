import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getCustomerSession } from '@/lib/customerAuth';
import { getOrderById } from '@/lib/orders';
import { getInvoiceByOrderId, INVOICE_DIR } from '@/lib/invoices';

// Auth: this route lives under /ucet/, so src/proxy.ts's guardCustomer already enforces a
// logged-in customer session for every request here - but that only proves "some customer is
// logged in," not "this order is theirs". The ownership check below is the one hand-written
// authorization check in this whole feature; a bug here is a direct PII leak (any customer
// could read another customer's invoice by guessing an order id), so it deserves the closest
// review of anything in this file.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getCustomerSession();
  const orderId = Number((await params).orderId);
  if (!orderId || !session.customerId) {
    return new NextResponse('Nenájdené', { status: 404 });
  }

  const order = await getOrderById(orderId);
  if (!order || order.customerId !== session.customerId) {
    // 404, not 403 - don't leak whether this order exists to a non-owner.
    return new NextResponse('Nenájdené', { status: 404 });
  }

  const invoice = await getInvoiceByOrderId(orderId);
  if (!invoice) return new NextResponse('Faktúra nenájdená', { status: 404 });

  const buffer = await fs.readFile(path.join(INVOICE_DIR, invoice.pdfPath));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
