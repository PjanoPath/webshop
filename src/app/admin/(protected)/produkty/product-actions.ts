'use server';

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';
import { createProduct, updateProduct, ProductInput, VariantInput, SaleMode, BULK_STEP } from '@/lib/products';

const UPLOAD_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'uploads');
const MAX_DIMENSION = 1600;

async function saveImages(files: File[]): Promise<string[]> {
  const validFiles = files.filter((f) => f && f.size > 0);
  if (validFiles.length === 0) return [];

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filenames: string[] = [];

  for (const file of validFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${crypto.randomUUID()}.webp`;
    await sharp(buffer)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(UPLOAD_DIR, filename));
    filenames.push(filename);
  }

  return filenames;
}

const VAT_RATES = [5, 19, 23] as const;
const SALE_MODES = ['piece', 'bulk', 'variant'] as const;

function parseVariants(formData: FormData): VariantInput[] {
  const ids = formData.getAll('variant_id');
  const labels = formData.getAll('variant_label');
  const prices = formData.getAll('variant_price');
  const stocks = formData.getAll('variant_stock');

  const variants: VariantInput[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = String(labels[i] || '').trim();
    if (!label) continue; // a row left blank by the admin is just dropped, not saved as empty
    const rawId = String(ids[i] || '').trim();
    variants.push({
      id: rawId ? Number(rawId) : undefined,
      label,
      price: parseFloat(String(prices[i] || '0').replace(',', '.')) || 0,
      stock: Math.max(0, parseInt(String(stocks[i] || '0'), 10) || 0),
    });
  }
  return variants;
}

function parseProductInput(formData: FormData): ProductInput {
  const rawSubcategoryId = formData.get('subcategory_id');
  const rawVatRate = Number(formData.get('vat_rate'));
  const rawSaleMode = String(formData.get('sale_mode') || 'piece');
  const saleMode: SaleMode = (SALE_MODES as readonly string[]).includes(rawSaleMode) ? (rawSaleMode as SaleMode) : 'piece';
  const bulkUnit = formData.get('bulk_unit') === 'ml' ? 'ml' : 'g';

  // Bulk stock is entered by the admin as real grams/ml (e.g. "5000") - stored internally as
  // 25-unit steps (see BULK_STEP), same unit price_at_order ends up using on an order.
  const rawStock = Math.max(0, parseInt(String(formData.get('stock') || '0'), 10) || 0);
  const stock = saleMode === 'bulk' ? Math.round(rawStock / BULK_STEP) : rawStock;

  return {
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    price: parseFloat(String(formData.get('price') || '0').replace(',', '.')) || 0,
    vatRate: (VAT_RATES as readonly number[]).includes(rawVatRate) ? rawVatRate : 23,
    subcategoryId: rawSubcategoryId ? Number(rawSubcategoryId) : null,
    stock,
    featured: formData.get('featured') === 'on',
    saleMode,
    bulkUnit: saleMode === 'bulk' ? bulkUnit : null,
    pickupOnly: formData.get('pickup_only') === 'on',
    variants: saleMode === 'variant' ? parseVariants(formData) : [],
  };
}

function parseTagIds(formData: FormData): number[] {
  return formData
    .getAll('tag_ids')
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n));
}

export type ProductFormState = { error?: string };

function validateInput(input: ProductInput): string | null {
  if (!input.name) return 'Názov produktu je povinný.';
  if (!input.subcategoryId) return 'Vyber kategóriu a podkategóriu.';
  if (input.saleMode === 'variant') {
    if (input.variants.length === 0) return 'Pridaj aspoň jednu variantu (napr. veľkosť balenia).';
    if (input.variants.some((v) => Number.isNaN(v.price) || v.price < 0)) return 'Zadaj platnú cenu pre každú variantu.';
  } else if (Number.isNaN(input.price) || input.price < 0) {
    return 'Zadaj platnú cenu.';
  }
  return null;
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const input = parseProductInput(formData);
  const error = validateInput(input);
  if (error) return { error };

  const files = formData.getAll('images').filter((f): f is File => f instanceof File);
  const filenames = await saveImages(files);

  const product = await createProduct(input, filenames, parseTagIds(formData));
  revalidatePath('/admin');
  revalidatePath('/produkty');
  revalidatePath('/');
  redirect(`/admin/produkty/${product.id}/upravit`);
}

export async function updateProductAction(
  id: number,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const input = parseProductInput(formData);
  const error = validateInput(input);
  if (error) return { error };

  const files = formData.getAll('images').filter((f): f is File => f instanceof File);
  const filenames = await saveImages(files);

  await updateProduct(id, input, filenames, parseTagIds(formData));
  revalidatePath('/admin');
  revalidatePath('/produkty');
  revalidatePath('/');
  redirect('/admin');
}
