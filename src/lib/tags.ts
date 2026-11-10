import { getDb, isUniqueViolation } from './db';
import slugify from 'slugify';

export type Tag = {
  id: number;
  slug: string;
  name: string;
};

export async function listTags(): Promise<Tag[]> {
  const db = await getDb();
  const { rows } = await db.query('SELECT id, slug, name FROM tags ORDER BY id ASC');
  return rows;
}

export async function getTagById(id: number): Promise<Tag | null> {
  const db = await getDb();
  const { rows } = await db.query('SELECT id, slug, name FROM tags WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  const db = await getDb();
  const { rows } = await db.query('SELECT id, slug, name FROM tags WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}

function makeSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, locale: 'sk' }) || 'tag';
}

export async function createTag(input: { name: string }): Promise<Tag> {
  const db = await getDb();
  const baseSlug = makeSlug(input.name);
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      const { rows } = await db.query('INSERT INTO tags (slug, name) VALUES ($1, $2) RETURNING id, slug, name', [
        slug,
        input.name,
      ]);
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

export async function updateTag(id: number, input: { name: string }): Promise<Tag> {
  const db = await getDb();
  const baseSlug = makeSlug(input.name);
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      const { rows } = await db.query('UPDATE tags SET slug = $1, name = $2 WHERE id = $3 RETURNING id, slug, name', [
        slug,
        input.name,
        id,
      ]);
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

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM tags WHERE id = $1', [id]);
}
