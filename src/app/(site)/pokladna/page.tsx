import { getCustomerSession } from '@/lib/customerAuth';
import { getCustomerById } from '@/lib/customers';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const session = await getCustomerSession();
  const customer = session.customerId ? await getCustomerById(session.customerId) : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-semibold">Pokladňa</h1>
      <div className="mt-8">
        <CheckoutForm
          customer={
            customer
              ? {
                  name: customer.name,
                  email: customer.email,
                  address: customer.address,
                  buyerType: customer.buyer_type,
                  companyName: customer.company_name ?? '',
                  companyIco: customer.company_ico ?? '',
                  companyDic: customer.company_dic ?? '',
                  companyIcDph: customer.company_ic_dph ?? '',
                }
              : null
          }
        />
      </div>
    </div>
  );
}
