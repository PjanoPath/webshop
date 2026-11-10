import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session-config';
import { customerSessionOptions, CustomerSessionData } from '@/lib/customer-session-config';

async function guardAdmin(request: NextRequest, response: NextResponse) {
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  if (!session.isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  if (session.isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  return response;
}

async function guardCustomer(request: NextRequest, response: NextResponse) {
  const session = await getIronSession<CustomerSessionData>(request, response, customerSessionOptions);
  const isAuthPage =
    request.nextUrl.pathname === '/ucet/prihlasenie' || request.nextUrl.pathname === '/ucet/registracia';

  if (!session.customerId && !isAuthPage) {
    return NextResponse.redirect(new URL(`/ucet/prihlasenie?redirect=${request.nextUrl.pathname}`, request.url));
  }
  if (session.customerId && isAuthPage) {
    return NextResponse.redirect(new URL('/ucet', request.url));
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/admin')) {
    return guardAdmin(request, response);
  }
  return guardCustomer(request, response);
}

export const config = {
  matcher: ['/admin/:path*', '/ucet/:path*'],
};
