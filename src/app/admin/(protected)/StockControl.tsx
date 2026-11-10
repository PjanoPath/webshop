'use client';

import { useOptimistic, useTransition } from 'react';
import { adjustStockAction } from './actions';

// Updates the badge the instant a button is tapped (useOptimistic), independent of how long
// the server round-trip actually takes - this is the whole point for a shop owner tapping this
// from her phone right after an in-person sale. The server clamps at 0 the same way this does,
// so once the action resolves and the page revalidates, the real value matches what was already
// shown - no visible correction/flicker in the normal case.
export default function StockControl({ productId, initialStock }: { productId: number; initialStock: number }) {
  const [stock, applyDelta] = useOptimistic(initialStock, (current: number, delta: number) =>
    Math.max(0, current + delta)
  );
  const [, startTransition] = useTransition();

  function adjust(delta: number) {
    startTransition(async () => {
      applyDelta(delta);
      await adjustStockAction(productId, delta);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={stock === 0}
        aria-label="Znížiť sklad o 1 kus"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-olive-200 text-sm font-medium leading-none text-olive-600 transition hover:bg-olive-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span
        className={`min-w-[6.5rem] rounded-full px-3 py-1 text-center text-xs font-medium ${
          stock > 0 ? 'bg-olive-100 text-olive-700' : 'bg-clay-500/10 text-clay-600'
        }`}
      >
        {stock > 0 ? `Skladom: ${stock}` : 'Vypredané'}
      </span>
      <button
        type="button"
        onClick={() => adjust(1)}
        aria-label="Zvýšiť sklad o 1 kus"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-olive-200 text-sm font-medium leading-none text-olive-600 transition hover:bg-olive-50"
      >
        +
      </button>
    </div>
  );
}
