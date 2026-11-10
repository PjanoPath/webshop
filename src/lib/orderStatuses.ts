// Deliberately its own file, with zero imports - order status labels are needed by client
// components (e.g. OrderStatusForm.tsx) as well as server code. `orders.ts` pulls in `getDb`
// (and transitively `pg`, which uses Node-only built-ins like `dns`/`net`/`fs`) - importing
// anything from that file into a 'use client' component drags all of that into the browser
// bundle and breaks the build. Keeping these two constants here, with no other dependencies,
// means client components can safely import just the labels.
//
// 'pickup' is an alternate starting status to 'pending' - set automatically at checkout when
// the customer chooses in-store pickup instead of shipping (see createOrder in orders.ts), not
// something an admin normally switches an order into by hand. Pickup orders then follow their
// own short track - pickup -> ready_for_pickup -> shipped ("vybavená") - entirely separate from
// paid/invoicing: payment happens in cash/card at the counter, so there's no bank-transfer
// confirmation or invoice involved for this path at all.
export const ORDER_STATUSES = ['pending', 'pickup', 'ready_for_pickup', 'paid', 'shipped', 'cancelled'] as const;
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Čaká sa na platbu',
  pickup: 'Vyzdvihnutie na predajni',
  ready_for_pickup: 'Pripravená k odberu',
  paid: 'Platba prijatá',
  shipped: 'Objednávka vybavená',
  cancelled: 'Zrušená',
};

// Each fulfillment method has its own linear progression - an order only ever moves forward
// along its own track (or sideways into "cancelled", which is a terminal exit, not a step in
// the progression, so it's exempt from the ordering check below).
export const FULFILLMENT_TRACKS: Record<'shipping' | 'pickup', readonly string[]> = {
  shipping: ['pending', 'paid', 'shipped'],
  pickup: ['pickup', 'ready_for_pickup', 'shipped'],
};

// Whether `status` exists at all on this order's track ("cancelled" is valid on both). The
// admin dropdown already hides the other track's statuses; updateOrderStatusAction re-checks
// with this so a tampered request can't e.g. mark a pickup order "paid" (which would stamp
// paid_at and send a bank-transfer "payment received" email for a cash-at-counter order).
export function isStatusOnTrack(fulfillmentMethod: 'shipping' | 'pickup', status: string): boolean {
  return status === 'cancelled' || FULFILLMENT_TRACKS[fulfillmentMethod].includes(status);
}

// Used both to hide backward options in the admin dropdown and, more importantly, to refuse
// them server-side (updateOrderStatusAction) - a stale page or a tampered request could still
// submit one otherwise. "cancelled" is always a valid forward exit from any active status;
// once cancelled, nothing moves it anywhere else (no reopening a cancelled order).
export function isBackwardTransition(
  fulfillmentMethod: 'shipping' | 'pickup',
  from: string,
  to: string
): boolean {
  if (from === to) return false;
  if (from === 'cancelled') return true;
  if (to === 'cancelled') return false;
  const track = FULFILLMENT_TRACKS[fulfillmentMethod];
  const fromRank = track.indexOf(from);
  const toRank = track.indexOf(to);
  if (fromRank === -1 || toRank === -1) return false;
  return toRank < fromRank;
}
