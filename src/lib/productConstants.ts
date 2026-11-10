// Deliberately its own file, zero imports - same reasoning as orderStatuses.ts. products.ts
// pulls in getDb (and transitively `pg`), so importing a value from it into a 'use client'
// component (ProductForm.tsx needs BULK_STEP to convert bulk stock to/from real grams) would
// drag the Node-only Postgres driver into the browser bundle and break the build.
export type SaleMode = 'piece' | 'bulk' | 'variant';

// A bulk product's price/stock are stored per kg/L, not per gram/ml - a price of 8.00 for
// 1000 g would round to nothing meaningful at 2 decimal places per gram, but is exact per
// 25 g step (0.20). One "unit" of quantity/stock for a bulk product is one of these steps.
export const BULK_STEP = 25;
