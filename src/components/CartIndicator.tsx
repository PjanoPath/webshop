'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function CartIndicator() {
  const { itemCount } = useCart();

  return (
    <Link href="/kosik" className="relative flex items-center transition hover:text-olive-900">
      Košík
      {itemCount > 0 && (
        <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-olive-700 px-1 text-xs font-medium text-cream-50">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
