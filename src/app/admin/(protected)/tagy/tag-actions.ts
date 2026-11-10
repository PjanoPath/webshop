'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createTag, updateTag, deleteTag } from '@/lib/tags';

function revalidateTagPaths() {
  revalidatePath('/admin/tagy');
  revalidatePath('/produkty');
  revalidatePath('/');
}

export async function createTagAction(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  if (name) {
    await createTag({ name });
    revalidateTagPaths();
  }
  redirect('/admin/tagy');
}

export async function updateTagAction(id: number, formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  if (name) {
    await updateTag(id, { name });
    revalidateTagPaths();
  }
  redirect('/admin/tagy');
}

export async function deleteTagAction(id: number) {
  await deleteTag(id);
  revalidateTagPaths();
  redirect('/admin/tagy');
}
