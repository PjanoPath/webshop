'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';

type Variant = { id: number; label: string; price: number; stock: number };

type Props = {
  productId: number;
  slug: string;
  name: string;
  photoFilename: string | null;
  variants: Variant[];
  pickupOnly?: boolean;
};

export default function VariantAddToCartButton({
  productId,
  slug,
  name,
  photoFilename,
  variants,
  pickupOnly = false,
}: Props) {
  const { addItem } = useCart();
  const [selectedId, setSelectedId] = useState(variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const selected = variants.find((v) => v.id === selectedId);

  if (variants.length === 0 || !selected) {
    return (
      <div className="rounded-xl2 bg-cream-200 px-5 py-4 text-center text-sm text-olive-500">
        Tento produkt momentálne nemá dostupné žiadne balenie.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={v.stock <= 0}
            onClick={() => {
              setSelectedId(v.id);
              setQuantity(1);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              v.id === selectedId
                ? 'border-olive-600 bg-olive-600 text-white'
                : 'border-olive-200 text-olive-700 hover:border-olive-400'
            } ${v.stock <= 0 ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {v.label} — {v.price.toFixed(2)} €{v.stock <= 0 && ' (vypredané)'}
          </button>
        ))}
      </div>

      {selected.stock <= 0 ? (
        <div className="rounded-xl2 bg-cream-200 px-5 py-4 text-center text-sm text-olive-500">
          Táto varianta je momentálne vypredaná.
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              onClick={() => setQuantity((q) => Math.min(selected.stock, q + 1))}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => {
              addItem(
                {
                  productId,
                  variantId: selected.id,
                  variantLabel: selected.label,
                  unitLabel: null,
                  slug,
                  name,
                  price: selected.price,
                  photoFilename,
                  stock: selected.stock,
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
      )}
    </div>
  );
}
