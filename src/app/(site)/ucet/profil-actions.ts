'use server';

import { revalidatePath } from 'next/cache';
import { getCustomerSession } from '@/lib/customerAuth';
import { updateCustomer } from '@/lib/customers';

export type ProfileFormState = {
  success?: boolean;
  error?: string;
};

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await getCustomerSession();
  if (!session.customerId) {
    return { error: 'Relácia vypršala, prihlás sa prosím znova.' };
  }

  const name = String(formData.get('name') || '').trim();
  const address = String(formData.get('address') || '').trim();
  const city = String(formData.get('city') || '').trim();
  const postal_code = String(formData.get('postal_code') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  if (!name) {
    return { error: 'Vyplň meno.' };
  }

  const buyer_type = formData.get('buyer_type') === 'company' ? 'company' : 'individual';
  const company_name = String(formData.get('company_name') || '').trim();
  const company_ico = String(formData.get('company_ico') || '').trim();
  const company_dic = String(formData.get('company_dic') || '').trim();
  const company_ic_dph = String(formData.get('company_ic_dph') || '').trim();
  if (buyer_type === 'company' && (!company_name || !company_ico)) {
    return { error: 'Pri firemných údajoch vyplň názov firmy a IČO.' };
  }

  await updateCustomer(session.customerId, {
    name,
    address,
    city,
    postal_code,
    phone,
    buyer_type,
    company_name,
    company_ico,
    company_dic,
    company_ic_dph,
  });
  revalidatePath('/ucet');
  // Checkout pre-fills its "Nakupujem ako" fields from this same profile data - without this,
  // Next's client-side router cache can keep serving a pre-update render of /pokladna (empty
  // company fields) after a client-side navigation there, even though the page is force-dynamic.
  revalidatePath('/pokladna');
  return { success: true };
}
