import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderById, formatOrderItemLine } from '@/lib/orders';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const id = Number((await searchParams).id);
  if (!id) notFound();

  const order = await getOrderById(id);
  if (!order) notFound();

  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-semibold">Ďakujeme za objednávku!</h1>
      <p className="mt-2 text-olive-600">Objednávka #{order.id} bola prijatá.</p>

      <div className="card mt-8 p-5">
        <ul className="space-y-1 text-sm text-olive-700">
          {order.items.map((item, i) => {
            const line = formatOrderItemLine(item);
            return (
              <li key={`${item.productId}-${item.variantId ?? i}`}>
                {line.quantity} × {line.name} — {(item.priceAtOrder * item.quantity).toFixed(2)} €
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-between border-t border-olive-100 pt-3 font-medium">
          <span>Celkom</span>
          <span>{order.total.toFixed(2)} €</span>
        </div>
      </div>

      {order.fulfillmentMethod === 'pickup' ? (
        <div className="card mt-6 p-5">
          <h2 className="font-semibold">Vyzdvihnutie na predajni</h2>
          <p className="mt-2 text-sm text-olive-600">
            Objednávku si prevezmete osobne na predajni a uhradíte pri vyzdvihnutí. Ozveme sa ti, hneď ako bude
            pripravená.
          </p>
        </div>
      ) : (
        <>
          {(settings.iban || order.variableSymbol) && (
            <div className="card mt-6 p-5">
              <h2 className="font-semibold">Platobné údaje</h2>
              <dl className="mt-2 space-y-1 text-sm text-olive-700">
                {settings.iban && (
                  <div className="flex justify-between">
                    <dt className="text-olive-500">IBAN</dt>
                    <dd>{settings.iban}</dd>
                  </div>
                )}
                {order.variableSymbol && (
                  <div className="flex justify-between">
                    <dt className="text-olive-500">Variabilný symbol</dt>
                    <dd>{order.variableSymbol}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {settings.payment_instructions && (
            <div className="mt-6">
              <h2 className="font-semibold">Platobné inštrukcie</h2>
              <p className="mt-2 whitespace-pre-line text-olive-600">{settings.payment_instructions}</p>
            </div>
          )}
        </>
      )}

      <p className="mt-6 text-sm text-olive-500">Potvrdenie objednávky sme ti poslali aj e-mailom.</p>

      <Link href="/produkty" className="btn-secondary mt-8 inline-block">
        Pokračovať v nákupe
      </Link>
    </div>
  );
}
