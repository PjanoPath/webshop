'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from '@/lib/categories';
import { isForeignKeyViolation } from '@/lib/db';

function revalidateCategoryPaths() {
  revalidatePath('/admin/kategorie');
  revalidatePath('/produkty');
  revalidatePath('/');
}

export async function createCategoryAction(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  if (name) {
    await createCategory({ name });
    revalidateCategoryPaths();
  }
  redirect('/admin/kategorie');
}

export async function updateCategoryAction(id: number, formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  if (name) {
    await updateCategory(id, { name });
    revalidateCategoryPaths();
  }
  redirect('/admin/kategorie');
}

export async function deleteCategoryAction(id: number) {
  try {
    await deleteCategory(id);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      redirect(
        `/admin/kategorie?error=${encodeURIComponent('Kategóriu nie je možné vymazať – obsahuje podkategórie s produktmi.')}`
      );
    }
    throw err;
  }
  revalidateCategoryPaths();
  redirect('/admin/kategorie');
}

export async function createSubcategoryAction(categoryId: number, formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  if (name) {
    await createSubcategory(categoryId, { name });
    revalidateCategoryPaths();
  }
  redirect('/admin/kategorie');
}

export async function updateSubcategoryAction(id: number, formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  if (name) {
    await updateSubcategory(id, { name });
    revalidateCategoryPaths();
  }
  redirect('/admin/kategorie');
}

export async function deleteSubcategoryAction(id: number) {
  try {
    await deleteSubcategory(id);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      redirect(
        `/admin/kategorie?error=${encodeURIComponent('Podkategóriu nie je možné vymazať – obsahuje produkty.')}`
      );
    }
    throw err;
  }
  revalidateCategoryPaths();
  redirect('/admin/kategorie');
}
