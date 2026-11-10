'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { BULK_STEP } from '@/lib/productConstants';

const MAX_GRAMS = 10000; // 10 kg / 10 L cap, regardless of stock

type Props = {
  productId: number;
  slug: string;
  name: string;
  pricePerKgOrL: number;
  bulkUnit: 'g' | 'ml';
  photoFilename: string | null;
  stockSteps: number;
  pickupOnly?: boolean;
};

export default function BulkAddToCartButton({
  productId,
  slug,
  name,
  pricePerKgOrL,
  bulkUnit,
  photoFilename,
  stockSteps,
  pickupOnly = false,
}: Props) {
  const { addItem } = useCart();
  const maxGrams = Math.min(stockSteps * BULK_STEP, MAX_GRAMS);
  const [grams, setGrams] = useState(Math.min(BULK_STEP, maxGrams));
  const [added, setAdded] = useState(false);

  if (stockSteps <= 0) {
    return (
      <div className="rounded-xl2 bg-cream-200 px-5 py-4 text-center text-sm text-olive-500">
        Tento produkt je momentálne vypredaný.
      </div>
    );
  }

  // Same rounding as generateOrder in orders.ts - the price shown here must match what actually
  // gets charged, not just be a close approximation.
  const pricePerStep = Math.round(((pricePerKgOrL * BULK_STEP) / 1000) * 100) / 100;
  const steps = grams / BULK_STEP;
  const totalPrice = pricePerStep * steps;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-9 w-9 rounded-lg bg-cream-200 text-olive-700 transition hover:bg-cream-300"
          onClick={() => setGrams((g) => Math.max(BULK_STEP, g - BULK_STEP))}
        >
          −
        </button>
        <span className="w-24 text-center font-medium text-olive-800">
          {grams} {bulkUnit}
        </span>
        <button
          type="button"
          className="h-9 w-9 rounded-lg bg-cream-200 text-olive-700 transition hover:bg-cream-300"
          onClick={() => setGrams((g) => Math.min(maxGrams, g + BULK_STEP))}
        >
          +
        </button>
        <span className="text-sm text-olive-500">
          max {maxGrams} {bulkUnit}
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Fixed width + tabular-nums so the button next to it doesn't shift as the digit
            count changes while stepping through quantities (e.g. "5.85 €" vs "10.00 €"). */}
        <p className="w-24 shrink-0 text-lg font-medium tabular-nums text-olive-800">{totalPrice.toFixed(2)} €</p>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => {
            addItem(
              {
                productId,
                variantId: null,
                variantLabel: null,
                unitLabel: bulkUnit,
                slug,
                name,
                price: pricePerStep,
                photoFilename,
                stock: stockSteps,
                pickupOnly,
              },
              steps
            );
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
          }}
        >
          {added ? 'Pridané ✓' : 'Pridať do košíka'}
        </button>
      </div>
    </div>
  );
}
