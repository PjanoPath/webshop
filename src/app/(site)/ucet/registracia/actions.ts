'use server';

import { redirect } from 'next/navigation';
import { createCustomer } from '@/lib/customers';
import { getCustomerSession } from '@/lib/customerAuth';

export type RegisterState = { error?: string };

export async function customerRegisterAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const name = String(formData.get('name') || '').trim();
  const address = String(formData.get('address') || '').trim();
  const city = String(formData.get('city') || '').trim();
  const postal_code = String(formData.get('postal_code') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const redirectTo = String(formData.get('redirectTo') || '/ucet');

  if (!email || !password || !name) {
    return { error: 'Vyplň meno, e-mail a heslo.' };
  }
  if (password.length < 8) {
    return { error: 'Heslo musí mať aspoň 8 znakov.' };
  }

  const result = await createCustomer({ email, password, name, address, city, postal_code, phone });
  if ('error' in result) {
    return { error: result.error };
  }

  const session = await getCustomerSession();
  session.customerId = result.id;
  await session.save();
  redirect(redirectTo);
}
