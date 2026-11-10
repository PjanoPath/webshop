import Link from 'next/link';
import Logo from './Logo';
import CartIndicator from './CartIndicator';
import { getSettings } from '@/lib/settings';
import { getCustomerSession } from '@/lib/customerAuth';

export default async function Header() {
  const settings = await getSettings();
  const session = await getCustomerSession();

  return (
    <header className="sticky top-0 z-30 border-b border-olive-100 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={40} shopName={settings.shop_name} />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-semibold text-olive-800">{settings.shop_name}</span>
            <span className="hidden text-xs text-olive-500 sm:inline">{settings.tagline}</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-olive-700 sm:gap-6">
          <Link href="/" className="transition hover:text-olive-900">
            Domov
          </Link>
          <Link href="/produkty" className="transition hover:text-olive-900">
            Produkty
          </Link>
          <a href="/#o-mne" className="hidden transition hover:text-olive-900 sm:inline">
            O mne
          </a>
          <Link href="/ucet" className="transition hover:text-olive-900">
            {session.customerId ? 'Môj účet' : 'Prihlásiť sa'}
          </Link>
          <CartIndicator />
        </nav>
      </div>
    </header>
  );
}
