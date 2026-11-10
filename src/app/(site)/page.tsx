import fs from 'fs';
import path from 'path';
import Image from 'next/image';
import Link from 'next/link';
import Logo from '@/components/Logo';
import ProductCard from '@/components/ProductCard';
import { getSettings } from '@/lib/settings';
import { listFeaturedProducts, listProducts } from '@/lib/products';

export const dynamic = 'force-dynamic';

function findHeroBackground(): string | null {
  const candidates = ['uvod1.png', 'uvod1.jpg', 'uvod1.jpeg', 'uvod1.webp'];
  for (const file of candidates) {
    if (fs.existsSync(path.join(/* turbopackIgnore: true */ process.cwd(), 'public', file))) {
      return `/${file}`;
    }
  }
  return null;
}

export default async function HomePage() {
  const settings = await getSettings();
  const featured = await listFeaturedProducts(3);
  const products = featured.length > 0 ? featured : (await listProducts()).slice(0, 3);
  const heroBackground = findHeroBackground();

  return (
    <div>
      {/* bg-cream-50 here is load-bearing, not decorative: without an opaque background on this
          section, the site-wide blurred backdrop (site layout) shows through the semi-transparent
          hero photo/noise-texture layers below it, blending into a hazy double image. */}
      <section className="relative overflow-hidden bg-cream-50 bg-grain">
        {heroBackground && (
          <div className="absolute inset-0">
            <Image src={heroBackground} alt="" fill priority className="object-cover opacity-20" />
          </div>
        )}
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 px-5 py-20 text-center sm:py-28">
          <Logo size={96} shopName={settings.shop_name} />
          <h1 className="font-display text-4xl font-semibold text-olive-800 sm:text-5xl">{settings.shop_name}</h1>
          <p className="max-w-xl text-lg text-olive-600">{settings.tagline}</p>
          <Link href="/produkty" className="btn-primary mt-2">
            Pozrieť produkty
          </Link>
        </div>
      </section>

      {products.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-center text-2xl font-semibold">Obľúbené produkty</h2>
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/produkty" className="btn-secondary">
              Zobraziť všetky produkty
            </Link>
          </div>
        </section>
      )}

      <section id="o-mne" className="bg-cream-100">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="text-2xl font-semibold">O mne</h2>
          <p className="mt-4 whitespace-pre-line text-olive-700">{settings.about_text}</p>
        </div>
      </section>
    </div>
  );
}
