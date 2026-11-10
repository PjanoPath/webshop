import { Document, Page, View, Text, renderToBuffer } from '@react-pdf/renderer';
import type { CreditNote } from './credit-notes';
import { formatOrderItemLine, type OrderItemRecord } from './orders';
import { pdfStyles as styles, splitLines, summarizeVat, buildBuyerLines } from './pdf-styles';

export async function renderCreditNotePdf(
  creditNote: CreditNote,
  invoiceNumber: string,
  items: OrderItemRecord[],
  orderTotal: number,
  orderId: number
): Promise<Buffer> {
  const sellerLines = [
    creditNote.sellerName,
    ...splitLines(creditNote.sellerAddress),
    creditNote.sellerIco ? `IČO: ${creditNote.sellerIco}` : null,
    creditNote.sellerDic ? `DIČ: ${creditNote.sellerDic}` : null,
    creditNote.sellerIcDph ? `IČ DPH: ${creditNote.sellerIcDph}` : null,
    creditNote.sellerIban ? `IBAN: ${creditNote.sellerIban}` : null,
  ].filter((line): line is string => Boolean(line));

  const customerLines = buildBuyerLines(creditNote);

  const issuedDate = creditNote.issuedAt.toLocaleDateString('sk-SK');
  const isVatPayer = Boolean(creditNote.sellerIcDph);
  const vatGroups = isVatPayer ? summarizeVat(items) : [];

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Dobropis {creditNote.creditNoteNumber}</Text>
          <Text style={styles.meta}>Dátum vystavenia: {issuedDate}</Text>
          <Text style={styles.meta}>Dobropis k faktúre č. {invoiceNumber}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Dodávateľ</Text>
            {sellerLines.map((line, i) => (
              <Text key={i} style={styles.line}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Odberateľ</Text>
            {customerLines.length > 0 ? (
              customerLines.map((line, i) => (
                <Text key={i} style={styles.line}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={styles.line}>Údaje zákazníka neboli k dispozícii</Text>
            )}
          </View>
        </View>

        <Text style={styles.line}>Objednávka č. {orderId}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colName}>Produkt</Text>
            <Text style={styles.colQty}>Množstvo</Text>
            <Text style={isVatPayer ? styles.colPriceVat : styles.colPrice}>Cena/jedn.</Text>
            {isVatPayer && <Text style={styles.colVat}>DPH</Text>}
            <Text style={isVatPayer ? styles.colTotalVat : styles.colTotal}>Spolu</Text>
          </View>
          {items.map((item, i) => {
            const line = formatOrderItemLine(item);
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colName}>{line.name}</Text>
                <Text style={styles.colQty}>{line.quantity}</Text>
                <Text style={isVatPayer ? styles.colPriceVat : styles.colPrice}>{item.priceAtOrder.toFixed(2)} €</Text>
                {isVatPayer && <Text style={styles.colVat}>{item.vatRate} %</Text>}
                <Text style={isVatPayer ? styles.colTotalVat : styles.colTotal}>
                  {(item.priceAtOrder * item.quantity).toFixed(2)} €
                </Text>
              </View>
            );
          })}
        </View>

        {isVatPayer && (
          <View style={styles.vatRecap}>
            <Text style={styles.vatRecapTitle}>Rekapitulácia DPH</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.recapCol1}>Sadzba</Text>
              <Text style={styles.recapCol2}>Základ dane</Text>
              <Text style={styles.recapCol3}>DPH</Text>
              <Text style={styles.recapCol4}>Spolu</Text>
            </View>
            {vatGroups.map((group) => (
              <View key={group.rate} style={styles.tableRow}>
                <Text style={styles.recapCol1}>{group.rate} %</Text>
                <Text style={styles.recapCol2}>{group.base.toFixed(2)} €</Text>
                <Text style={styles.recapCol3}>{group.vat.toFixed(2)} €</Text>
                <Text style={styles.recapCol4}>{group.gross.toFixed(2)} €</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Suma na vrátenie</Text>
          <Text style={styles.totalValue}>{orderTotal.toFixed(2)} €</Text>
        </View>
      </Page>
    </Document>
  );
}
