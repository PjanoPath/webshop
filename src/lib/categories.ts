import { getDb, isUniqueViolation } from './db';
import slugify from 'slugify';

export type Category = {
  id: number;
  slug: string;
  name: string;
};

export type Subcategory = {
  id: number;
  category_id: number;
  slug: string;
  name: string;
};

export type CategoryWithSubcategories = Category & { subcategories: Subcategory[] };

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const { rows } = await db.query('SELECT id, slug, name FROM categories ORDER BY id ASC');
  return rows;
}

export async function listCategoriesWithSubcategories(): Promise<CategoryWithSubcategories[]> {
  const db = await getDb();
  const categories = await listCategories();
  if (categories.length === 0) return [];

  const { rows } = await db.query(
    'SELECT id, category_id, slug, name FROM subcategories WHERE category_id = ANY($1) ORDER BY id ASC',
    [categories.map((c) => c.id)]
  );

  const byCategory = new Map<number, Subcategory[]>();
  for (const row of rows) {
    const arr = byCategory.get(row.category_id) ?? [];
    arr.push(row);
    byCategory.set(row.category_id, arr);
  }

  return categories.map((c) => ({ ...c, subcategories: byCategory.get(c.id) ?? [] }));
}

export async function listSubcategoriesByCategory(categoryId: number): Promise<Subcategory[]> {
  const db = await getDb();
  const { rows } = await db.query(
    'SELECT id, category_id, slug, name FROM subcategories WHERE category_id = $1 ORDER BY id ASC',
    [categoryId]
  );
  return rows;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const db = await getDb();
  const { rows } = await db.query('SELECT id, slug, name FROM categories WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}

export async function getSubcategoryById(id: number): Promise<Subcategory | null> {
  const db = await getDb();
  const { rows } = await db.query('SELECT id, category_id, slug, name FROM subcategories WHERE id = $1', [id]);
  return rows[0] ?? null;
}

function makeSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, locale: 'sk' }) || 'kategoria';
}

export async function createCategory(input: { name: string }): Promise<Category> {
  const db = await getDb();
  const baseSlug = makeSlug(input.name);
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      const { rows } = await db.query(
        'INSERT INTO categories (slug, name) VALUES ($1, $2) RETURNING id, slug, name',
        [slug, input.name]
      );
      return rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
        continue;
      }
      throw err;
    }
  }
}

export async function updateCategory(id: number, input: { name: string }): Promise<Category> {
  const db = await getDb();
  const baseSlug = makeSlug(input.name);
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      const { rows } = await db.query(
        'UPDATE categories SET slug = $1, name = $2 WHERE id = $3 RETURNING id, slug, name',
        [slug, input.name, id]
      );
      return rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
        continue;
      }
      throw err;
    }
  }
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM categories WHERE id = $1', [id]);
}

export async function createSubcategory(categoryId: number, input: { name: string }): Promise<Subcategory> {
  const db = await getDb();
  const baseSlug = makeSlug(input.name);
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      const { rows } = await db.query(
        'INSERT INTO subcategories (category_id, slug, name) VALUES ($1, $2, $3) RETURNING id, category_id, slug, name',
        [categoryId, slug, input.name]
      );
      return rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
        continue;
      }
      throw err;
    }
  }
}

export async function updateSubcategory(id: number, input: { name: string }): Promise<Subcategory> {
  const db = await getDb();
  const existing = await getSubcategoryById(id);
  if (!existing) throw new Error('Podkategória neexistuje');

  const baseSlug = makeSlug(input.name);
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      const { rows } = await db.query(
        'UPDATE subcategories SET slug = $1, name = $2 WHERE id = $3 RETURNING id, category_id, slug, name',
        [slug, input.name, id]
      );
      return rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
        continue;
      }
      throw err;
    }
  }
}

export async function deleteSubcategory(id: number): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM subcategories WHERE id = $1', [id]);
}
