'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProductImage } from '@/lib/products';

export default function ProductGallery({
  images,
  productName,
  pickupOnly = false,
}: {
  images: ProductImage[];
  productName: string;
  pickupOnly?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl2 bg-cream-200 text-olive-300">
        Bez fotky
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl2 bg-cream-200">
        <Image
          src={`/uploads/${active.filename}`}
          alt={productName}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
          priority
        />
        {pickupOnly && (
          <span className="absolute right-3 top-3 rounded-full bg-gold-600/90 px-3 py-1 text-xs font-medium text-white">
            Iba na predajni
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                idx === activeIndex ? 'border-olive-600' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Image src={`/uploads/${img.filename}`} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
