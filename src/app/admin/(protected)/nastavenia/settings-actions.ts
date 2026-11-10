'use server';

import { revalidatePath } from 'next/cache';
import { updateSettings } from '@/lib/settings';

export type SettingsFormState = { success?: boolean };

export async function updateSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await updateSettings({
    shop_name: String(formData.get('shop_name') || '').trim(),
    tagline: String(formData.get('tagline') || '').trim(),
    about_text: String(formData.get('about_text') || '').trim(),
    whatsapp_number: String(formData.get('whatsapp_number') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    instagram_url: String(formData.get('instagram_url') || '').trim(),
    facebook_url: String(formData.get('facebook_url') || '').trim(),
    payment_instructions: String(formData.get('payment_instructions') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    website_url: String(formData.get('website_url') || '').trim(),
    iban: String(formData.get('iban') || '').trim(),
    ico: String(formData.get('ico') || '').trim(),
    dic: String(formData.get('dic') || '').trim(),
    ic_dph: String(formData.get('ic_dph') || '').trim(),
    email_pending_text: String(formData.get('email_pending_text') || '').trim(),
    email_pickup_text: String(formData.get('email_pickup_text') || '').trim(),
    email_paid_text: String(formData.get('email_paid_text') || '').trim(),
    email_shipped_text: String(formData.get('email_shipped_text') || '').trim(),
    email_cancelled_text: String(formData.get('email_cancelled_text') || '').trim(),
    email_credit_note_text: String(formData.get('email_credit_note_text') || '').trim(),
    email_ready_for_pickup_text: String(formData.get('email_ready_for_pickup_text') || '').trim(),
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
