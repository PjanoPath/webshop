import path from 'path';
import { Font, StyleSheet } from '@react-pdf/renderer';

// react-pdf's built-in Helvetica only covers WinAnsi - no č, ľ, ť, ň, ď, ĺ, ŕ, so "IČO",
// "DODÁVATEĽ" and most customer/product names came out with missing letters. DejaVu Sans has
// full Latin Extended and a permissive license (see pdf-fonts/DejaVuSans-LICENSE.txt). It has to
// be a static font: the site's variable fonts render at their default instance in react-pdf,
// which for Nunito Sans is ExtraLight - too faint for a printed invoice. Read from disk at
// runtime; next.config.js traces it into the standalone build at the same relative path.
Font.register({
  family: 'DejaVuSans',
  src: path.join(process.cwd(), 'src', 'lib', 'pdf-fonts', 'DejaVuSans.ttf'),
});
// Default react-pdf hyphenation splits words with no hyphen dictionary for Slovak - keep words whole.
Font.registerHyphenationCallback((word) => [word]);

// Shared between invoice-pdf.tsx and credit-note-pdf.tsx - both are structurally near-identical
// documents (header, seller/customer blocks, line-items table, total row), so the layout is
// defined once here rather than duplicated per template.
export const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#2B301C', fontFamily: 'DejaVuSans' },
  header: { marginBottom: 24 },
  title: { fontSize: 20, marginBottom: 4 },
  meta: { fontSize: 10, color: '#636F3E' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  block: { width: '48%' },
  blockTitle: { fontSize: 9, textTransform: 'uppercase', color: '#7C8B4F', marginBottom: 4 },
  line: { marginBottom: 2 },
  table: { marginTop: 16 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #E1E7CE',
    paddingBottom: 4,
    marginBottom: 4,
    color: '#636F3E',
  },
  tableRow: { flexDirection: 'row', paddingVertical: 3 },
  colName: { width: '46%' },
  colQty: { width: '14%', textAlign: 'right' },
  colPrice: { width: '20%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right' },
  // Narrower price/total columns free up room for a VAT-rate column - only used once an item
  // table actually needs it (seller has an IČ DPH on file), so the no-VAT layout above is
  // untouched for shops that aren't VAT-registered.
  colPriceVat: { width: '14%', textAlign: 'right' },
  colVat: { width: '10%', textAlign: 'right' },
  colTotalVat: { width: '16%', textAlign: 'right' },
  vatRecap: { marginTop: 16 },
  vatRecapTitle: { fontSize: 9, textTransform: 'uppercase', color: '#7C8B4F', marginBottom: 4 },
  recapCol1: { width: '25%' },
  recapCol2: { width: '25%', textAlign: 'right' },
  recapCol3: { width: '25%', textAlign: 'right' },
  recapCol4: { width: '25%', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    borderTop: '1 solid #2B301C',
    paddingTop: 8,
  },
  totalLabel: { fontSize: 12, marginRight: 12 },
  totalValue: { fontSize: 12 },
});

export function splitLines(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

type BuyerFields = {
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
};

// "Odberateľ" block, shared by invoice and credit note. A company order leads with the company
// name and its IČO/DIČ/IČ DPH, with the person who placed the order listed as the contact.
export function buildBuyerLines(b: BuyerFields): string[] {
  const isCompany = Boolean(b.customerCompanyName);
  const cityLine = [b.customerPostalCode, b.customerCity].filter(Boolean).join(' ');
  return [
    isCompany ? b.customerCompanyName : b.customerName,
    isCompany && b.customerName ? `Kontakt: ${b.customerName}` : null,
    b.customerAddress,
    cityLine || null,
    isCompany && b.customerIco ? `IČO: ${b.customerIco}` : null,
    isCompany && b.customerDic ? `DIČ: ${b.customerDic}` : null,
    isCompany && b.customerIcDph ? `IČ DPH: ${b.customerIcDph}` : null,
    b.customerEmail,
    b.customerPhone ? `Tel: ${b.customerPhone}` : null,
  ].filter((line): line is string => Boolean(line));
}

export type VatGroup = { rate: number; base: number; vat: number; gross: number };

// Line prices are stored VAT-inclusive (what the customer was actually charged), so the base
// (pre-VAT) amount is derived here rather than stored - base = gross / (1 + rate/100). Grouped
// by rate because a single order can legitimately mix products taxed at 23/19/5 %, and a
// multi-rate invoice needs its VAT recap broken out per rate, not just a single blended figure.
export function summarizeVat(items: { priceAtOrder: number; quantity: number; vatRate: number }[]): VatGroup[] {
  const byRate = new Map<number, VatGroup>();
  for (const item of items) {
    const gross = item.priceAtOrder * item.quantity;
    const base = gross / (1 + item.vatRate / 100);
    const group = byRate.get(item.vatRate) ?? { rate: item.vatRate, base: 0, vat: 0, gross: 0 };
    group.base += base;
    group.vat += gross - base;
    group.gross += gross;
    byRate.set(item.vatRate, group);
  }
  return [...byRate.values()].sort((a, b) => b.rate - a.rate);
}
