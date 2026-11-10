import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getInvoiceByOrderId, INVOICE_DIR } from '@/lib/invoices';

// Auth: this route lives under /admin/(protected)/, so src/proxy.ts's guardAdmin already
// enforces a logged-in admin session for every request here - protection is proxy-provided,
// not self-contained. Anyone moving this route out from under /admin/ must add an explicit
// check.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orderId = Number((await params).id);
  if (!orderId) return new NextResponse('Neplatná objednávka', { status: 404 });

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
