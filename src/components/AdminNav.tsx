import Link from 'next/link';

export default function AdminNav({ logoutAction }: { logoutAction: () => Promise<void> }) {
  return (
    <header className="border-b border-olive-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-display text-lg font-semibold text-olive-800">
            Važim si · Admin
          </Link>
          <nav className="flex gap-4 text-sm text-olive-600">
            <Link href="/admin" className="transition hover:text-olive-900">
              Produkty
            </Link>
            <Link href="/admin/objednavky" className="transition hover:text-olive-900">
              Objednávky
            </Link>
            <Link href="/admin/kategorie" className="transition hover:text-olive-900">
              Kategórie
            </Link>
            <Link href="/admin/tagy" className="transition hover:text-olive-900">
              Tagy
            </Link>
            <Link href="/admin/nastavenia" className="transition hover:text-olive-900">
              Nastavenia
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" target="_blank" className="text-sm text-olive-500 transition hover:text-olive-800">
            Zobraziť web ↗
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-olive-500 transition hover:text-olive-800">
              Odhlásiť sa
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
