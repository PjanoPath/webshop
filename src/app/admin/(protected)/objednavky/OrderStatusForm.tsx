'use client';

import { useState } from 'react';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, isBackwardTransition } from '@/lib/orderStatuses';

export default function OrderStatusForm({
  currentStatus,
  fulfillmentMethod,
  canFinalize,
  action,
}: {
  currentStatus: string;
  fulfillmentMethod: 'shipping' | 'pickup';
  canFinalize: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState(currentStatus);
  const unchanged = selected === currentStatus;
  // Pickup orders run on their own short track - pickup -> ready_for_pickup -> shipped
  // ("vybavená") - with no "pending"/"paid" at all, since payment happens in person at the
  // counter, not via bank transfer. Shipping orders run the original track and never see
  // "pickup"/"ready_for_pickup". "shipped" keeps its usual paid+invoiced gate for shipping
  // orders, but is freely selectable for pickup ones - see updateOrderStatusAction. Backward
  // steps within a track (e.g. paid -> pending, or ready_for_pickup -> pickup) are hidden
  // entirely - see isBackwardTransition.
  const options = ORDER_STATUSES.filter((s) => {
    if (s === currentStatus) return true;
    if (fulfillmentMethod === 'pickup') {
      if (s === 'pending' || s === 'paid') return false;
    } else {
      if (s === 'pickup' || s === 'ready_for_pickup') return false;
    }
    if (isBackwardTransition(fulfillmentMethod, currentStatus, s)) return false;
    if (s === 'shipped' && fulfillmentMethod !== 'pickup') return canFinalize;
    return true;
  });

  return (
    <form action={action} className="flex items-center gap-2">
      <select
        name="status"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="input w-auto py-1 text-sm"
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="btn-secondary py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        disabled={unchanged}
      >
        Uložiť stav
      </button>
    </form>
  );
}
