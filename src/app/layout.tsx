import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { getSettings } from '@/lib/settings';

// Every route reads live DB state (shop settings, cart/session) — none of this
// should ever be statically pre-rendered, which would otherwise also require a
// real Postgres connection at build time.
export const dynamic = 'force-dynamic';

// Self-hosted (not next/font/google) - Turbopack production builds were failing
// with 404s fetching Google's font CDN (Next's bundled font metadata had gone
// stale relative to Google's currently-served file hashes). These are the same
// variable-font files Google Fonts serves, sourced directly from their
// google/fonts GitHub repo, so no network access is needed at build time.
//
// Fraunces + Nunito Sans replace Playfair Display + Jost - both variable fonts
// carry extra axes (opsz/SOFT/WONK on Fraunces, YTLC/opsz/wdth on Nunito Sans)
// beyond the wght range set here; those just sit at their defaults, which is
// exactly what gives both their soft, rounded, "gentle" character compared to
// the sharper high-contrast serif/geometric-sans pairing before.
const display = localFont({
  src: './fonts/Fraunces-Variable.ttf',
  weight: '400 700',
  variable: '--font-display',
  display: 'swap',
});

const body = localFont({
  src: './fonts/NunitoSans-Variable.ttf',
  weight: '300 600',
  variable: '--font-body',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `${settings.shop_name} — ${settings.tagline}`,
    description: settings.about_text,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body className={`${display.variable} ${body.variable} font-body bg-cream-50 text-olive-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
