import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customerAuth';
import { getCustomerById } from '@/lib/customers';
import { getOrdersForCustomer, formatOrderItemLine } from '@/lib/orders';
import { ORDER_STATUS_LABELS } from '@/lib/orderStatuses';
import { getInvoiceByOrderId } from '@/lib/invoices';
import ProfileForm from './ProfileForm';

export const dynamic = 'force-dynamic';

async function logoutAction() {
  'use server';
  const session = await getCustomerSession();
  session.destroy();
  redirect('/');
}

export default async function MyAccountPage() {
  const session = await getCustomerSession();
  if (!session.customerId) redirect('/ucet/prihlasenie?redirect=/ucet');

  const customer = await getCustomerById(session.customerId);
  if (!customer) redirect('/ucet/prihlasenie?redirect=/ucet');

  const orders = await getOrdersForCustomer(customer.id);
  const invoiceEntries = await Promise.all(
    orders.map(async (o) => [o.id, await getInvoiceByOrderId(o.id)] as const)
  );
  const invoicesByOrder = new Map(invoiceEntries);

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Môj účet</h1>
          <p className="mt-1 text-sm text-olive-500">{customer.email}</p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-olive-500 transition hover:text-olive-800">
            Odhlásiť sa
          </button>
        </form>
      </div>

      <h2 className="mt-10 text-lg font-semibold">Upraviť profil</h2>
      <ProfileForm customer={customer} />

      <h2 className="mt-10 text-lg font-semibold">Moje objednávky</h2>
      {orders.length === 0 ? (
        <p className="mt-4 text-olive-500">Zatiaľ nemáš žiadne objednávky.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="card p-5">
              <div className="flex items-center justify-between text-sm text-olive-500">
                <span>Objednávka #{order.id}</span>
                <span>{new Date(order.orderDate).toLocaleDateString('sk-SK')}</span>
              </div>
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
                  {invoicesByOrder.get(order.id) && (
                    <a
                      href={`/ucet/faktura/${order.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-olive-600 underline transition hover:text-olive-900"
                    >
                      Stiahnuť faktúru
                    </a>
                  )}
                </div>
                <span className="font-medium text-olive-800">{order.total.toFixed(2)} €</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
