'use server';

import { getCustomerSession } from '@/lib/customerAuth';
import { getCustomerById } from '@/lib/customers';
import { getSettings } from '@/lib/settings';
import { createOrder } from '@/lib/orders';
import { sendOrderEmails } from '@/lib/email';

export type CheckoutPayload = {
  items: { productId: number; quantity: number; variantId?: number }[];
  fulfillmentMethod: 'shipping' | 'pickup';
  buyerType: 'individual' | 'company';
  company?: { name: string; ico: string; dic: string; icDph: string };
  guest?: { name: string; email: string; address: string; city: string; postalCode: string; phone: string };
};

export type CheckoutResult = { orderId: number } | { error: string };

export async function submitOrderAction(payload: CheckoutPayload): Promise<CheckoutResult> {
  const session = await getCustomerSession();
  const settings = await getSettings();

  const isCompany = payload.buyerType === 'company';
  if (isCompany && (!payload.company?.name?.trim() || !payload.company?.ico?.trim())) {
    return { error: 'Pri nákupe na firmu vyplň názov firmy a IČO.' };
  }
  const buyerFields = isCompany
    ? {
        buyerType: 'company' as const,
        companyName: payload.company!.name,
        companyIco: payload.company!.ico,
        companyDic: payload.company!.dic,
        companyIcDph: payload.company!.icDph,
      }
    : { buyerType: 'individual' as const };

  let recipientEmail: string;
  let orderInput: Parameters<typeof createOrder>[0];

  if (session.customerId) {
    const customer = await getCustomerById(session.customerId);
    if (!customer) return { error: 'Relácia vypršala, prihlás sa prosím znova.' };
    recipientEmail = customer.email;
    orderInput = {
      items: payload.items,
      customerId: customer.id,
      fulfillmentMethod: payload.fulfillmentMethod,
      ...buyerFields,
    };
  } else {
    if (!payload.guest?.name || !payload.guest?.email) {
      return { error: 'Vyplň meno a e-mail.' };
    }
    recipientEmail = payload.guest.email;
    orderInput = {
      items: payload.items,
      guestName: payload.guest.name,
      guestEmail: payload.guest.email,
      guestAddress: payload.guest.address ?? '',
      guestCity: payload.guest.city ?? '',
      guestPostalCode: payload.guest.postalCode ?? '',
      guestPhone: payload.guest.phone ?? '',
      fulfillmentMethod: payload.fulfillmentMethod,
      ...buyerFields,
    };
  }

  const result = await createOrder(orderInput);
  if ('error' in result) return result;

  // Deliberately does NOT write buyerType/company back onto the customer profile - that was
  // tried and caused a confusing bug: placing one order as individual silently flipped the
  // saved default back from company, even though nothing was changed on /ucet. The profile page
  // is now the only place that changes what's prefilled at checkout; an order here never does.

  await sendOrderEmails(result.order, recipientEmail, settings);

  return { orderId: result.order.id };
}
