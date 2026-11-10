import { Document, Page, View, Text, renderToBuffer } from '@react-pdf/renderer';
import type { Invoice } from './invoices';
import { formatOrderItemLine, type OrderItemRecord } from './orders';
import { pdfStyles as styles, splitLines, summarizeVat, buildBuyerLines } from './pdf-styles';

export async function renderInvoicePdf(
  invoice: Invoice,
  items: OrderItemRecord[],
  orderTotal: number,
  orderId: number,
  variableSymbol: string | null,
  orderDate: Date
): Promise<Buffer> {
  const sellerLines = [
    invoice.sellerName,
    ...splitLines(invoice.sellerAddress),
    invoice.sellerIco ? `IČO: ${invoice.sellerIco}` : null,
    invoice.sellerDic ? `DIČ: ${invoice.sellerDic}` : null,
    invoice.sellerIcDph ? `IČ DPH: ${invoice.sellerIcDph}` : null,
    invoice.sellerIban ? `IBAN: ${invoice.sellerIban}` : null,
  ].filter((line): line is string => Boolean(line));

  const customerLines = buildBuyerLines(invoice);

  const issuedDate = invoice.issuedAt.toLocaleDateString('sk-SK');
  const orderedDate = orderDate.toLocaleDateString('sk-SK');

  // A VAT breakdown only makes sense - and is only legally required - once the seller is
  // actually a registered VAT payer. sellerIcDph is frozen on the invoice at generation time,
  // so this reflects the shop's status when this specific invoice was issued, not today.
  const isVatPayer = Boolean(invoice.sellerIcDph);
  const vatGroups = isVatPayer ? summarizeVat(items) : [];

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Faktúra {invoice.invoiceNumber}</Text>
          <Text style={styles.meta}>Dátum vystavenia: {issuedDate}</Text>
          <Text style={styles.meta}>Dátum objednávky: {orderedDate}</Text>
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
        {variableSymbol && <Text style={styles.line}>Variabilný symbol: {variableSymbol}</Text>}

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
          <Text style={styles.totalLabel}>Celkom</Text>
          <Text style={styles.totalValue}>{orderTotal.toFixed(2)} €</Text>
        </View>
      </Page>
    </Document>
  );
}
