'use server';

import { redirect } from 'next/navigation';
import { getCustomerByEmail, verifyPassword } from '@/lib/customers';
import { getCustomerSession } from '@/lib/customerAuth';

export type LoginState = { error?: string };

export async function customerLoginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const redirectTo = String(formData.get('redirectTo') || '/ucet');

  const customer = await getCustomerByEmail(email);
  if (!customer || !(await verifyPassword(customer, password))) {
    return { error: 'Nesprávny e-mail alebo heslo.' };
  }

  const session = await getCustomerSession();
  session.customerId = customer.id;
  await session.save();
  redirect(redirectTo);
}
