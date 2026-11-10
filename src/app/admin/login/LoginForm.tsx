'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, LoginState } from './actions';

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Prihlasovanie…' : 'Prihlásiť sa'}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">
          Meno
        </label>
        <input className="input" id="username" name="username" type="text" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Heslo
        </label>
        <input className="input" id="password" name="password" type="password" required />
      </div>
      {state.error && <p className="text-sm text-clay-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
