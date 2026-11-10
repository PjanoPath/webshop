import type { SessionOptions } from 'iron-session';
import { secureCookie } from './cookie-config';

export type CustomerSessionData = {
  customerId?: number;
};

const sessionPassword = process.env.SESSION_SECRET;
if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error('SESSION_SECRET musí byť nastavený a mať aspoň 32 znakov (pozri .env.example).');
}

export const customerSessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: 'vazimsi_customer_session',
  cookieOptions: {
    secure: secureCookie,
    httpOnly: true,
    sameSite: 'lax',
  },
};
