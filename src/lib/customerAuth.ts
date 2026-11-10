import { cookies } from 'next/headers';
import { getIronSession, IronSession } from 'iron-session';
import { customerSessionOptions, CustomerSessionData } from './customer-session-config';

export async function getCustomerSession(): Promise<IronSession<CustomerSessionData>> {
  return getIronSession<CustomerSessionData>(await cookies(), customerSessionOptions);
}
