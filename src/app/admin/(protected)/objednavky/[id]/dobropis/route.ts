import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getCreditNoteByOrderId } from '@/lib/credit-notes';
import { INVOICE_DIR } from '@/lib/invoices';

// Auth: this route lives under /admin/(protected)/, so src/proxy.ts's guardAdmin already
// enforces a logged-in admin session for every request here - protection is proxy-provided,
// not self-contained (same caveat as the faktura route this mirrors).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orderId = Number((await params).id);
  if (!orderId) return new NextResponse('Neplatná objednávka', { status: 404 });

  const creditNote = await getCreditNoteByOrderId(orderId);
  if (!creditNote) return new NextResponse('Dobropis nenájdený', { status: 404 });

  const buffer = await fs.readFile(path.join(INVOICE_DIR, creditNote.pdfPath));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${creditNote.creditNoteNumber}.pdf"`,
    },
  });
}
