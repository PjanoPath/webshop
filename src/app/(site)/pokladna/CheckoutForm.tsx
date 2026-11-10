'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { submitOrderAction } from './actions';
import { BULK_STEP } from '@/lib/productConstants';

type LoggedInCustomer = {
  name: string;
  email: string;
  address: string;
  buyerType: 'individual' | 'company';
  companyName: string;
  companyIco: string;
  companyDic: string;
  companyIcDph: string;
};
type GuestInput = { name: string; email: string; address: string; city: string; postalCode: string; phone: string };

export default function CheckoutForm({ customer }: { customer: LoggedInCustomer | null }) {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();

  const [mode, setMode] = useState<'choose' | 'guest'>('choose');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'shipping' | 'pickup'>('shipping');
  // A pickup-only product in the cart overrides whatever the customer picked - derived, not
  // stored in state, so it always reflects the cart's actual contents (e.g. removing the item
  // on /kosik immediately frees the toggle back up again).
  const hasPickupOnlyItem = items.some((i) => i.pickupOnly);
  const effectiveFulfillmentMethod = hasPickupOnlyItem ? 'pickup' : fulfillmentMethod;
  // Pre-filled from the saved profile for a logged-in customer (still just a starting point -
  // every field below stays editable, and what actually gets submitted is whatever these state
  // values hold at submit time, not the profile itself).
  const [buyerType, setBuyerType] = useState<'individual' | 'company'>(customer?.buyerType ?? 'individual');
  const [companyName, setCompanyName] = useState(customer?.companyName ?? '');
  const [companyIco, setCompanyIco] = useState(customer?.companyIco ?? '');
  const [companyDic, setCompanyDic] = useState(customer?.companyDic ?? '');
  const [companyIcDph, setCompanyIcDph] = useState(customer?.companyIcDph ?? '');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [guestCity, setGuestCity] = useState('');
  const [guestPostalCode, setGuestPostalCode] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <div className="text-center">
        <p className="text-olive-500">Košík je prázdny.</p>
        <Link href="/produkty" className="btn-primary mt-6 inline-block">
          Pozrieť produkty
        </Link>
      </div>
    );
  }

  async function submit(guest?: GuestInput) {
    if (buyerType === 'company' && (!companyName.trim() || !companyIco.trim())) {
      setError('Pri nákupe na firmu vyplň názov firmy a IČO.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitOrderAction({
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId ?? undefined })),
      fulfillmentMethod: effectiveFulfillmentMethod,
      buyerType,
      company:
        buyerType === 'company'
          ? { name: companyName, ico: companyIco, dic: companyDic, icDph: companyIcDph }
          : undefined,
      guest,
    });
    setSubmitting(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }
    clear();
    router.push(`/objednavka-prijata?id=${result.orderId}`);
  }

  return (
    <div>
      <div className="card p-5">
        <h2 className="font-semibold">Zhrnutie objednávky</h2>
        <ul className="mt-3 space-y-1 text-sm text-olive-700">
          {items.map((item) => (
            <li key={item.lineId}>
              {item.unitLabel ? `${item.quantity * BULK_STEP} ${item.unitLabel}` : `${item.quantity}×`} {item.name}
              {item.variantLabel && ` (${item.variantLabel})`} — {(item.price * item.quantity).toFixed(2)} €
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-olive-100 pt-3 font-medium">
          <span>Celkom</span>
          <span>{subtotal.toFixed(2)} €</span>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-semibold">Spôsob prevzatia</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className={`flex items-center gap-2 text-sm ${hasPickupOnlyItem ? 'text-olive-300' : 'text-olive-700'}`}>
            <input
              type="radio"
              name="fulfillment_method"
              disabled={hasPickupOnlyItem}
              checked={effectiveFulfillmentMethod === 'shipping'}
              onChange={() => setFulfillmentMethod('shipping')}
            />
            Doručenie na adresu
          </label>
          <label className="flex items-center gap-2 text-sm text-olive-700">
            <input
              type="radio"
              name="fulfillment_method"
              checked={effectiveFulfillmentMethod === 'pickup'}
              onChange={() => setFulfillmentMethod('pickup')}
            />
            Vyzdvihnutie na predajni
          </label>
        </div>
        {hasPickupOnlyItem && (
          <p className="mt-2 text-xs text-olive-500">
            Košík obsahuje produkt dostupný iba na predajni, preto je možné iba osobné vyzdvihnutie.
          </p>
        )}
        {!hasPickupOnlyItem && effectiveFulfillmentMethod === 'pickup' && (
          <p className="mt-2 text-xs text-olive-500">
            Objednávku si prevezmete osobne na predajni a uhradíte pri vyzdvihnutí.
          </p>
        )}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-semibold">Nakupujem ako</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm text-olive-700">
            <input
              type="radio"
              name="buyer_type"
              checked={buyerType === 'individual'}
              onChange={() => setBuyerType('individual')}
            />
            Súkromná osoba
          </label>
          <label className="flex items-center gap-2 text-sm text-olive-700">
            <input
              type="radio"
              name="buyer_type"
              checked={buyerType === 'company'}
              onChange={() => setBuyerType('company')}
            />
            Firma
          </label>
        </div>
        {buyerType === 'company' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="company_name">
                Názov firmy
              </label>
              <input
                className="input"
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label" htmlFor="company_ico">
                  IČO
                </label>
                <input
                  className="input"
                  id="company_ico"
                  value={companyIco}
                  onChange={(e) => setCompanyIco(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="company_dic">
                  DIČ
                </label>
                <input
                  className="input"
                  id="company_dic"
                  value={companyDic}
                  onChange={(e) => setCompanyDic(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="company_ic_dph">
                  IČ DPH
                </label>
                <input
                  className="input"
                  id="company_ic_dph"
                  value={companyIcDph}
                  onChange={(e) => setCompanyIcDph(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-olive-500">Údaje sa uvedú ako odberateľ na faktúre.</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        {customer ? (
          <div>
            <p className="text-sm text-olive-600">
              Prihlásený ako <strong>{customer.name}</strong> ({customer.email})
            </p>
            <button type="button" className="btn-primary mt-4 w-full" disabled={submitting} onClick={() => submit()}>
              {submitting ? 'Odosiela sa…' : 'Odoslať objednávku'}
            </button>
          </div>
        ) : mode === 'choose' ? (
          <div className="space-y-3">
            <Link href="/ucet/prihlasenie?redirect=/pokladna" className="btn-secondary block text-center">
              Prihlásiť sa
            </Link>
            <Link href="/ucet/registracia?redirect=/pokladna" className="btn-secondary block text-center">
              Registrovať sa
            </Link>
            <button type="button" className="btn-primary w-full" onClick={() => setMode('guest')}>
              Pokračovať ako hosť
            </button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit({
                name: guestName,
                email: guestEmail,
                address: guestAddress,
                city: guestCity,
                postalCode: guestPostalCode,
                phone: guestPhone,
              });
            }}
          >
            <div>
              <label className="label" htmlFor="guest_name">
                Meno
              </label>
              <input
                className="input"
                id="guest_name"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="guest_email">
                E-mail
              </label>
              <input
                className="input"
                id="guest_email"
                type="email"
                required
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
            {effectiveFulfillmentMethod === 'shipping' && (
              <>
                <div>
                  <label className="label" htmlFor="guest_address">
                    Adresa (doručovacia)
                  </label>
                  <input
                    className="input"
                    id="guest_address"
                    value={guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="guest_city">
                      Mesto
                    </label>
                    <input
                      className="input"
                      id="guest_city"
                      value={guestCity}
                      onChange={(e) => setGuestCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="guest_postal_code">
                      PSČ
                    </label>
                    <input
                      className="input"
                      id="guest_postal_code"
                      value={guestPostalCode}
                      onChange={(e) => setGuestPostalCode(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="guest_phone">
                Telefón
              </label>
              <input
                className="input"
                id="guest_phone"
                type="tel"
                placeholder="+421900123456"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Odosiela sa…' : 'Odoslať objednávku'}
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-clay-600">{error}</p>}
      </div>
    </div>
  );
}
