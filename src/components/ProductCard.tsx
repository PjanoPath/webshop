import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/products';

export default function ProductCard({ product }: { product: Product }) {
  const cover = product.images[0];
  const isSoldOut =
    product.saleMode === 'variant' ? product.variants.every((v) => v.stock <= 0) : product.stock <= 0;
  const priceLine =
    product.saleMode === 'variant'
      ? (() => {
          const prices = product.variants.map((v) => v.price);
          if (prices.length === 0) return null;
          const min = Math.min(...prices);
          return `${prices.every((p) => p === min) ? '' : 'od '}${min.toFixed(2)} €`;
        })()
      : `${product.price.toFixed(2)} €${product.saleMode === 'bulk' ? ` / ${product.bulkUnit === 'ml' ? 'L' : 'kg'}` : ''}`;

  return (
    <Link
      href={`/produkty/${product.slug}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-cream-200">
        {cover ? (
          <Image
            src={`/uploads/${cover.filename}`}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 20vw, 40vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-olive-300">
            <span className="text-sm">Bez fotky</span>
          </div>
        )}
        {isSoldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-clay-500/90 px-3 py-1 text-xs font-medium text-white">
            Vypredané
          </span>
        )}
        {product.pickupOnly && (
          <span className="absolute right-3 top-3 rounded-full bg-gold-600/90 px-3 py-1 text-xs font-medium text-white">
            Iba na predajni
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.subcategory && (
          <span className="text-xs uppercase tracking-wide text-gold-600">{product.subcategory.name}</span>
        )}
        <h3 className="font-display text-base font-semibold text-olive-800">{product.name}</h3>
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <span key={tag.id} className="tag-pill">
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <p className="mt-auto pt-2 text-sm font-medium text-olive-700">{priceLine}</p>
      </div>
    </Link>
  );
}
