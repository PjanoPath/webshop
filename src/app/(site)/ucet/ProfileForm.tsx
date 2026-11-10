'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Customer } from '@/lib/customers';
import { updateProfileAction, ProfileFormState } from './profil-actions';

const initialState: ProfileFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Ukladá sa…' : 'Uložiť zmeny'}
    </button>
  );
}

export default function ProfileForm({ customer }: { customer: Customer }) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  // Every field here is controlled state, not defaultValue - a <form action={...}> (useActionState)
  // auto-resets uncontrolled fields back to their initial value after a successful submit, which
  // wiped out anything just typed (most visibly the company fields, going from empty -> filled
  // -> reset back to empty). Controlled fields aren't touched by that reset.
  const [name, setName] = useState(customer.name);
  const [address, setAddress] = useState(customer.address);
  const [city, setCity] = useState(customer.city);
  const [postalCode, setPostalCode] = useState(customer.postal_code);
  const [phone, setPhone] = useState(customer.phone);
  const [buyerType, setBuyerType] = useState<'individual' | 'company'>(customer.buyer_type);
  const [companyName, setCompanyName] = useState(customer.company_name ?? '');
  const [companyIco, setCompanyIco] = useState(customer.company_ico ?? '');
  const [companyDic, setCompanyDic] = useState(customer.company_dic ?? '');
  const [companyIcDph, setCompanyIcDph] = useState(customer.company_ic_dph ?? '');

  return (
    <form action={formAction} className="mt-4 max-w-md space-y-4">
      <div>
        <label className="label" htmlFor="name">
          Meno
        </label>
        <input
          className="input"
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="address">
          Adresa (doručovacia)
        </label>
        <input
          className="input"
          id="address"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="city">
            Mesto
          </label>
          <input className="input" id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="postal_code">
            PSČ
          </label>
          <input
            className="input"
            id="postal_code"
            name="postal_code"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="phone">
          Telefón
        </label>
        <input
          className="input"
          id="phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+421900123456"
        />
      </div>

      <div>
        <p className="label">Nakupujem ako</p>
        <div className="flex gap-6">
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
                name="company_name"
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
                  name="company_ico"
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
                  name="company_dic"
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
                  name="company_ic_dph"
                  value={companyIcDph}
                  onChange={(e) => setCompanyIcDph(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-olive-500">Tieto údaje sa predvyplnia pri nákupe.</p>
          </div>
        )}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-olive-600">Profil bol uložený.</p>}

      <SubmitButton />
    </form>
  );
}
