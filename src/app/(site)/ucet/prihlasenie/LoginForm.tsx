'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { customerLoginAction, LoginState } from './actions';

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Prihlasovanie…' : 'Prihlásiť sa'}
    </button>
  );
}

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState(customerLoginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input className="input" id="email" name="email" type="email" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Heslo
        </label>
        <input className="input" id="password" name="password" type="password" required />
      </div>
      {state.error && <p className="text-sm text-clay-600">{state.error}</p>}
      <SubmitButton />
      <p className="text-center text-sm text-olive-500">
        Nemáš účet?{' '}
        <Link
          href={`/ucet/registracia?redirect=${encodeURIComponent(redirectTo)}`}
          className="text-olive-700 underline"
        >
          Zaregistruj sa
        </Link>
      </p>
    </form>
  );
}
