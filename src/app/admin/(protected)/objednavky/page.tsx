import { getAllOrders, getOrderContact, formatOrderItemLine } from '@/lib/orders';
import { ORDER_STATUS_LABELS } from '@/lib/orderStatuses';
import { getInvoiceByOrderId } from '@/lib/invoices';
import { getCreditNoteByOrderId } from '@/lib/credit-notes';
import { generateInvoiceAction, resendInvoiceAction, updateOrderStatusAction } from './order-actions';
import { generateCreditNoteAction, sendCreditNoteAction } from './credit-note-actions';
import OrderStatusForm from './OrderStatusForm';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();
  const invoiceEntries = await Promise.all(
    orders.map(async (o) => [o.id, await getInvoiceByOrderId(o.id)] as const)
  );
  const invoicesByOrder = new Map(invoiceEntries);
  const creditNoteEntries = await Promise.all(
    orders.map(async (o) => [o.id, await getCreditNoteByOrderId(o.id)] as const)
  );
  const creditNotesByOrder = new Map(creditNoteEntries);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Objednávky</h1>

      {orders.length === 0 ? (
        <p className="mt-10 text-olive-500">Zatiaľ žiadne objednávky.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {orders.map((order) => {
            const boundUpdateStatus = updateOrderStatusAction.bind(null, order.id);
            const boundGenerateInvoice = generateInvoiceAction.bind(null, order.id);
            const boundResendInvoice = resendInvoiceAction.bind(null, order.id);
            const boundGenerateCreditNote = generateCreditNoteAction.bind(null, order.id);
            const boundSendCreditNote = sendCreditNoteAction.bind(null, order.id);
            const contact = getOrderContact(order);
            const invoice = invoicesByOrder.get(order.id);
            const creditNote = creditNotesByOrder.get(order.id);
            const customerLabel = order.customerId
              ? (contact.name ?? `Zákazník #${order.customerId}`)
              : `${contact.name} (hosť)`;
            const addressLine = [contact.address, [contact.postalCode, contact.city].filter(Boolean).join(' ')]
              .filter(Boolean)
              .join(', ');

            return (
              <div key={order.id} className="overflow-hidden rounded-xl2 bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-olive-500">
                  <span className="flex flex-wrap items-center gap-2">
                    Objednávka #{order.id} — {customerLabel} {contact.email && `· ${contact.email}`}
                    {order.buyerType === 'company' && (
                      <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-700">
                        Firma
                      </span>
                    )}
                    {order.fulfillmentMethod === 'pickup' && (
                      <span className="rounded-full bg-gold-300/30 px-2 py-0.5 text-xs font-medium text-gold-700">
                        Vyzdvihnutie na predajni
                      </span>
                    )}
                  </span>
                  <span>{new Date(order.orderDate).toLocaleString('sk-SK')}</span>
                </div>
                {order.buyerType === 'company' && (
                  <div className="mt-1 text-sm text-olive-500">
                    Firma: <span className="font-medium text-olive-700">{order.companyName}</span>
                    {order.companyIco && ` · IČO: ${order.companyIco}`}
                    {order.companyDic && ` · DIČ: ${order.companyDic}`}
                    {order.companyIcDph && ` · IČ DPH: ${order.companyIcDph}`}
                  </div>
                )}
                {addressLine && <div className="mt-1 text-sm text-olive-500">Adresa: {addressLine}</div>}
                {contact.phone && <div className="mt-1 text-sm text-olive-500">Telefón: {contact.phone}</div>}
                {order.variableSymbol && (
                  <div className="mt-1 text-sm text-olive-500">Variabilný symbol: {order.variableSymbol}</div>
                )}

                <ul className="mt-3 space-y-1 text-sm text-olive-700">
                  {order.items.map((item, i) => {
                    const line = formatOrderItemLine(item);
                    return (
                      <li key={`${item.productId}-${item.variantId ?? i}`}>
                        {line.quantity} × {line.name} — {(item.priceAtOrder * item.quantity).toFixed(2)} €
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-olive-100 pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-medium text-olive-700">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <OrderStatusForm
                      key={`${order.id}-${order.status}`}
                      currentStatus={order.status}
                      fulfillmentMethod={order.fulfillmentMethod}
                      canFinalize={Boolean(order.paidAt) && Boolean(invoice)}
                      action={boundUpdateStatus}
                    />
                    {invoice ? (
                      <>
                        <a
                          href={`/admin/objednavky/${order.id}/faktura`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-olive-600 underline transition hover:text-olive-900"
                        >
                          Stiahnuť faktúru
                        </a>
                        {order.status === 'shipped' && (
                          <>
                            <form action={boundResendInvoice}>
                              <button type="submit" className="btn-secondary py-1 text-sm">
                                Poslať faktúru znova
                              </button>
                            </form>
                            {invoice.sentAt ? (
                              <span className="text-xs text-olive-400">
                                (odoslané {new Date(invoice.sentAt).toLocaleDateString('sk-SK')})
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-red-700">Faktúra nebola odoslaná!</span>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      order.paidAt && (
                        <form action={boundGenerateInvoice}>
                          <button type="submit" className="btn-secondary py-1 text-sm">
                            Vygenerovať faktúru
                          </button>
                        </form>
                      )
                    )}
                    {order.status === 'cancelled' &&
                      invoice &&
                      (creditNote ? (
                        <>
                          <a
                            href={`/admin/objednavky/${order.id}/dobropis`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-olive-600 underline transition hover:text-olive-900"
                          >
                            Stiahnuť dobropis
                          </a>
                          <form action={boundSendCreditNote}>
                            <button type="submit" className="btn-secondary py-1 text-sm">
                              Poslať dobropis zákazníkovi
                            </button>
                          </form>
                          {creditNote.sentAt && (
                            <span className="text-xs text-olive-400">
                              (odoslané {new Date(creditNote.sentAt).toLocaleDateString('sk-SK')})
                            </span>
                          )}
                        </>
                      ) : (
                        <form action={boundGenerateCreditNote}>
                          <button type="submit" className="btn-secondary py-1 text-sm">
                            Vystaviť dobropis
                          </button>
                        </form>
                      ))}
                  </div>
                  <span className="font-medium text-olive-800">{order.total.toFixed(2)} €</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
