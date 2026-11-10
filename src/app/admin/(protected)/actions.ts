'use server';

import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { adjustStock, deleteProduct, deleteProductImage, toggleFeatured } from '@/lib/products';

const UPLOAD_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'uploads');

async function removeUploadedFile(filename: string) {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // súbor už neexistuje, nič sa nedeje
  }
}

export async function toggleFeaturedAction(id: number) {
  await toggleFeatured(id);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function deleteProductAction(id: number) {
  const filenames = await deleteProduct(id);
  await Promise.all(filenames.map(removeUploadedFile));
  revalidatePath('/admin');
  revalidatePath('/produkty');
  revalidatePath('/');
}

export async function adjustStockAction(id: number, delta: number): Promise<number> {
  const stock = await adjustStock(id, delta);
  revalidatePath('/admin');
  revalidatePath('/produkty');
  revalidatePath('/');
  return stock;
}

export async function deleteImageAction(productId: number, imageId: number) {
  const filename = await deleteProductImage(imageId);
  if (filename) await removeUploadedFile(filename);
  revalidatePath(`/admin/produkty/${productId}/upravit`);
}
