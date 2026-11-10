'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { BULK_STEP } from '@/lib/productConstants';

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="text-2xl font-semibold">Košík</h1>
        <p className="mt-4 text-olive-500">Košík je prázdny.</p>
        <Link href="/produkty" className="btn-primary mt-6 inline-block">
          Pozrieť produkty
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-2xl font-semibold">Košík</h1>

      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <div key={item.lineId} className="card flex items-center gap-4 p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-cream-200">
              {item.photoFilename && (
                <Image src={`/uploads/${item.photoFilename}`} alt={item.name} fill sizes="64px" className="object-cover" />
              )}
            </div>
            <div className="flex-1">
              <Link href={`/produkty/${item.slug}`} className="font-medium text-olive-800 hover:underline">
                {item.name}
                {item.variantLabel && <span className="text-olive-500"> — {item.variantLabel}</span>}
              </Link>
              <p className="text-sm text-olive-500">
                {item.price.toFixed(2)} € / {item.unitLabel ? `${BULK_STEP} ${item.unitLabel}` : 'ks'}
              </p>
            </div>
            {item.unitLabel ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg bg-cream-200 text-olive-700 transition hover:bg-cream-300"
                  onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                >
                  −
                </button>
                <span className="w-20 text-center">
                  {item.quantity * BULK_STEP} {item.unitLabel}
                </span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg bg-cream-200 text-olive-700 transition hover:bg-cream-300"
                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                >
                  +
                </button>
              </div>
            ) : (
              <input
                type="number"
                min={1}
                max={item.stock}
                value={item.quantity}
                onChange={(e) => updateQuantity(item.lineId, parseInt(e.target.value, 10) || 1)}
                className="input w-16 text-center"
              />
            )}
            <span className="w-20 text-right font-medium text-olive-800">
              {(item.price * item.quantity).toFixed(2)} €
            </span>
            <button
              type="button"
              onClick={() => removeItem(item.lineId)}
              className="text-clay-600 transition hover:text-clay-700"
            >
              Odstrániť
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-olive-100 pt-6">
        <span className="text-lg font-semibold">Medzisúčet</span>
        <span className="text-lg font-semibold">{subtotal.toFixed(2)} €</span>
      </div>

      <div className="mt-6 text-right">
        <Link href="/pokladna" className="btn-primary">
          Pokračovať k pokladni
        </Link>
      </div>
    </div>
  );
}
