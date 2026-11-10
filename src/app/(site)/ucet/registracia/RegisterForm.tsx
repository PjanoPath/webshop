'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { customerRegisterAction, RegisterState } from './actions';

const initialState: RegisterState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Vytváranie účtu…' : 'Zaregistrovať sa'}
    </button>
  );
}

export default function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState(customerRegisterAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div>
        <label className="label" htmlFor="name">
          Meno
        </label>
        <input className="input" id="name" name="name" type="text" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input className="input" id="email" name="email" type="email" required />
      </div>
      <div>
        <label className="label" htmlFor="address">
          Adresa (doručovacia)
        </label>
        <input className="input" id="address" name="address" type="text" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="city">
            Mesto
          </label>
          <input className="input" id="city" name="city" type="text" />
        </div>
        <div>
          <label className="label" htmlFor="postal_code">
            PSČ
          </label>
          <input className="input" id="postal_code" name="postal_code" type="text" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="phone">
          Telefón
        </label>
        <input className="input" id="phone" name="phone" type="tel" placeholder="+421900123456" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Heslo
        </label>
        <input className="input" id="password" name="password" type="password" minLength={8} required />
      </div>
      {state.error && <p className="text-sm text-clay-600">{state.error}</p>}
      <SubmitButton />
      <p className="text-center text-sm text-olive-500">
        Už máš účet?{' '}
        <Link href={`/ucet/prihlasenie?redirect=${encodeURIComponent(redirectTo)}`} className="text-olive-700 underline">
          Prihlás sa
        </Link>
      </p>
    </form>
  );
}
