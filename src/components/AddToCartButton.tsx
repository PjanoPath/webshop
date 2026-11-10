'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';

type Props = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  photoFilename: string | null;
  stock: number;
  pickupOnly?: boolean;
  showQuantityStepper?: boolean;
};

export default function AddToCartButton({
  productId,
  slug,
  name,
  price,
  photoFilename,
  stock,
  pickupOnly = false,
  showQuantityStepper = false,
}: Props) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (stock <= 0) {
    return (
      <div className="rounded-xl2 bg-cream-200 px-5 py-4 text-center text-sm text-olive-500">
        Tento produkt je momentálne vypredaný.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {showQuantityStepper && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 w-9 rounded-lg bg-cream-200 text-olive-700 transition hover:bg-cream-300"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="w-6 text-center">{quantity}</span>
          <button
            type="button"
            className="h-9 w-9 rounded-lg bg-cream-200 text-olive-700 transition hover:bg-cream-300"
            onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
          >
            +
          </button>
        </div>
      )}
      <button
        type="button"
        className="btn-primary flex-1"
        onClick={() => {
          addItem(
            {
              productId,
              variantId: null,
              variantLabel: null,
              unitLabel: null,
              slug,
              name,
              price,
              photoFilename,
              stock,
              pickupOnly,
            },
            quantity
          );
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
      >
        {added ? 'Pridané ✓' : 'Pridať do košíka'}
      </button>
    </div>
  );
}
