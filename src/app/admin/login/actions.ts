'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { checkCredentials } from '@/lib/auth';

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');

  if (!checkCredentials(username, password)) {
    return { error: 'Nesprávne meno alebo heslo.' };
  }

  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();
  redirect('/admin');
}
