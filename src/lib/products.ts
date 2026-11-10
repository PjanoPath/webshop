import { getDb, isUniqueViolation } from './db';
import slugify from 'slugify';
import type { Tag } from './tags';
import type { SaleMode } from './productConstants';

export type { SaleMode } from './productConstants';
export { BULK_STEP } from './productConstants';

export type ProductImage = {
  id: number;
  filename: string;
  position: number;
};

export type ProductVariant = {
  id: number;
  label: string;
  price: number;
  stock: number;
  position: number;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  vatRate: number;
  subcategory_id: number | null;
  stock: number;
  featured: boolean;
  saleMode: SaleMode;
  bulkUnit: 'g' | 'ml' | null;
  pickupOnly: boolean;
  created_at: Date;
  updated_at: Date;
  images: ProductImage[];
  tags: Tag[];
  variants: ProductVariant[];
  category: { id: number; slug: string; name: string } | null;
  subcategory: { id: number; slug: string; name: string } | null;
};

const PRODUCT_SELECT = `
  SELECT p.*, s.id AS sub_id, s.slug AS sub_slug, s.name AS sub_name,
         c.id AS cat_id, c.slug AS cat_slug, c.name AS cat_name
  FROM products p
  LEFT JOIN subcategories s ON s.id = p.subcategory_id
  LEFT JOIN categories c ON c.id = s.category_id
`;

function mapProductRow(row: Record<string, unknown>): Omit<Product, 'images' | 'tags' | 'variants'> {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    vatRate: row.vat_rate as number,
    subcategory_id: row.subcategory_id as number | null,
    stock: row.stock as number,
    featured: row.featured as boolean,
    saleMode: row.sale_mode as SaleMode,
    bulkUnit: row.bulk_unit as 'g' | 'ml' | null,
    pickupOnly: row.pickup_only as boolean,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
    category: row.cat_id ? { id: row.cat_id as number, slug: row.cat_slug as string, name: row.cat_name as string } : null,
    subcategory: row.sub_id
      ? { id: row.sub_id as number, slug: row.sub_slug as string, name: row.sub_name as string }
      : null,
  };
}

async function attachImages(
  products: Omit<Product, 'images' | 'tags' | 'variants'>[]
): Promise<Omit<Product, 'tags' | 'variants'>[]> {
  if (products.length === 0) return [];
  const db = await getDb();
  const ids = products.map((p) => p.id);
  const { rows } = await db.query(
    'SELECT id, product_id, filename, position FROM product_images WHERE product_id = ANY($1) ORDER BY position ASC, id ASC',
    [ids]
  );

  const byProduct = new Map<number, ProductImage[]>();
  for (const row of rows) {
    const arr = byProduct.get(row.product_id) ?? [];
    arr.push({ id: row.id, filename: row.filename, position: row.position });
    byProduct.set(row.product_id, arr);
  }

  return products.map((p) => ({ ...p, images: byProduct.get(p.id) ?? [] }));
}

async function attachTags(products: Omit<Product, 'tags' | 'variants'>[]): Promise<Omit<Product, 'variants'>[]> {
  if (products.length === 0) return [];
  const db = await getDb();
  const ids = products.map((p) => p.id);
  const { rows } = await db.query(
    `SELECT pt.product_id, t.id, t.slug, t.name FROM product_tags pt
     JOIN tags t ON t.id = pt.tag_id WHERE pt.product_id = ANY($1) ORDER BY t.name ASC`,
    [ids]
  );

  const byProduct = new Map<number, Tag[]>();
  for (const row of rows) {
    const arr = byProduct.get(row.product_id) ?? [];
    arr.push({ id: row.id, slug: row.slug, name: row.name });
    byProduct.set(row.product_id, arr);
  }

  return products.map((p) => ({ ...p, tags: byProduct.get(p.id) ?? [] }));
}

function mapVariantRow(row: Record<string, unknown>): ProductVariant {
  return {
    id: row.id as number,
    label: row.label as string,
    price: row.price as number,
    stock: row.stock as number,
    position: row.position as number,
  };
}

async function attachVariants(products: Omit<Product, 'variants'>[]): Promise<Product[]> {
  if (products.length === 0) return [];
  const db = await getDb();
  const ids = products.map((p) => p.id);
  const { rows } = await db.query(
    'SELECT * FROM product_variants WHERE product_id = ANY($1) ORDER BY position ASC, id ASC',
    [ids]
  );

  const byProduct = new Map<number, ProductVariant[]>();
  for (const row of rows) {
    const arr = byProduct.get(row.product_id as number) ?? [];
    arr.push(mapVariantRow(row));
    byProduct.set(row.product_id as number, arr);
  }

  return products.map((p) => ({ ...p, variants: byProduct.get(p.id) ?? [] }));
}

async function attachRelations(rows: Record<string, unknown>[]): Promise<Product[]> {
  const withImages = await attachImages(rows.map(mapProductRow));
  const withTags = await attachTags(withImages);
  return attachVariants(withTags);
}

function buildProductConditions(options: {
  categoryId?: number;
  subcategoryId?: number;
  tagId?: number;
  search?: string;
}): { conditions: string[]; params: (number | string)[] } {
  const conditions: string[] = [];
  const params: (number | string)[] = [];

  if (options.subcategoryId) {
    params.push(options.subcategoryId);
    conditions.push(`p.subcategory_id = $${params.length}`);
  } else if (options.categoryId) {
    params.push(options.categoryId);
    conditions.push(`s.category_id = $${params.length}`);
  }

  if (options.tagId) {
    params.push(options.tagId);
    conditions.push(`EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = p.id AND pt.tag_id = $${params.length})`);
  }

  const search = options.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
  }

  return { conditions, params };
}

export async function listProducts(
  options: {
    categoryId?: number;
    subcategoryId?: number;
    tagId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Product[]> {
  const db = await getDb();
  const { conditions, params } = buildProductConditions(options);

  let query = PRODUCT_SELECT;
  if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ' ORDER BY p.created_at DESC';

  if (options.limit !== undefined) {
    params.push(options.limit);
    query += ` LIMIT $${params.length}`;
  }
  if (options.offset !== undefined) {
    params.push(options.offset);
    query += ` OFFSET $${params.length}`;
  }

  const { rows } = await db.query(query, params);
  return attachRelations(rows);
}

export async function countProducts(options: { search?: string } = {}): Promise<number> {
  const db = await getDb();
  const { conditions, params } = buildProductConditions(options);

  let query = 'SELECT COUNT(*)::int as count FROM products p';
  if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;

  const { rows } = await db.query(query, params);
  return rows[0].count as number;
}

export async function listFeaturedProducts(limit = 3): Promise<Product[]> {
  const db = await getDb();
  const { rows } = await db.query(`${PRODUCT_SELECT} WHERE p.featured = true ORDER BY p.created_at DESC LIMIT $1`, [
    limit,
  ]);
  return attachRelations(rows);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = await getDb();
  const { rows } = await db.query(`${PRODUCT_SELECT} WHERE p.slug = $1`, [slug]);
  if (rows.length === 0) return null;
  return (await attachRelations(rows))[0];
}

export async function getProductById(id: number): Promise<Product | null> {
  const db = await getDb();
  const { rows } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
  if (rows.length === 0) return null;
  return (await attachRelations(rows))[0];
}

export type VariantInput = { id?: number; label: string; price: number; stock: number };

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  vatRate: number;
  subcategoryId: number | null;
  stock: number;
  featured: boolean;
  saleMode: SaleMode;
  bulkUnit: 'g' | 'ml' | null;
  pickupOnly: boolean;
  variants: VariantInput[];
};

async function setProductTags(productId: number, tagIds: number[]): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
  if (tagIds.length === 0) return;
  const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  await db.query(`INSERT INTO product_tags (product_id, tag_id) VALUES ${values}`, [productId, ...tagIds]);
}

// Upserts submitted variants and removes the ones no longer submitted - but only if they were
// never ordered (the NOT EXISTS guard). A variant with order history has to stay addressable so
// past invoices keep resolving, so it's just silently left in place rather than deleted; the
// admin can still empty its stock to stop it being sold further.
async function setProductVariants(productId: number, variants: VariantInput[]): Promise<void> {
  const db = await getDb();
  const keepIds = variants.filter((v) => v.id).map((v) => v.id as number);

  await db.query(
    `DELETE FROM product_variants
     WHERE product_id = $1 AND NOT (id = ANY($2))
       AND NOT EXISTS (SELECT 1 FROM order_items WHERE variant_id = product_variants.id)`,
    [productId, keepIds]
  );

  for (let i = 0; i < variants.length; i += 1) {
    const v = variants[i];
    if (v.id) {
      await db.query('UPDATE product_variants SET label = $1, price = $2, stock = $3, position = $4 WHERE id = $5', [
        v.label,
        v.price,
        v.stock,
        i,
        v.id,
      ]);
    } else {
      await db.query(
        'INSERT INTO product_variants (product_id, label, price, stock, position) VALUES ($1, $2, $3, $4, $5)',
        [productId, v.label, v.price, v.stock, i]
      );
    }
  }
}

export async function createProduct(
  input: ProductInput,
  imageFilenames: string[],
  tagIds: number[] = []
): Promise<Product> {
  const db = await getDb();
  const baseSlug = slugify(input.name, { lower: true, strict: true, locale: 'sk' }) || 'produkt';
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      const { rows } = await db.query(
        `INSERT INTO products (slug, name, description, price, vat_rate, subcategory_id, stock, featured, sale_mode, bulk_unit, pickup_only)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          slug,
          input.name,
          input.description,
          input.price,
          input.vatRate,
          input.subcategoryId,
          input.stock,
          input.featured,
          input.saleMode,
          input.bulkUnit,
          input.pickupOnly,
        ]
      );
      const productId = rows[0].id as number;
      await addImages(productId, imageFilenames);
      await setProductTags(productId, tagIds);
      await setProductVariants(productId, input.variants);
      return (await getProductById(productId))!;
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

export async function updateProduct(
  id: number,
  input: ProductInput,
  newImageFilenames: string[],
  tagIds: number[]
): Promise<Product> {
  const db = await getDb();
  const existing = await getProductById(id);
  if (!existing) throw new Error('Produkt neexistuje');

  const baseSlug = existing.name === input.name ? existing.slug : slugify(input.name, { lower: true, strict: true, locale: 'sk' }) || 'produkt';
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    try {
      await db.query(
        `UPDATE products
         SET slug = $1, name = $2, description = $3, price = $4, vat_rate = $5,
             subcategory_id = $6, stock = $7, featured = $8, sale_mode = $9, bulk_unit = $10, pickup_only = $11, updated_at = now()
         WHERE id = $12`,
        [
          slug,
          input.name,
          input.description,
          input.price,
          input.vatRate,
          input.subcategoryId,
          input.stock,
          input.featured,
          input.saleMode,
          input.bulkUnit,
          input.pickupOnly,
          id,
        ]
      );
      break;
    } catch (err) {
      if (isUniqueViolation(err)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
        continue;
      }
      throw err;
    }
  }

  if (newImageFilenames.length > 0) {
    await addImages(id, newImageFilenames);
  }
  await setProductTags(id, tagIds);
  await setProductVariants(id, input.variants);

  return (await getProductById(id))!;
}

async function addImages(productId: number, filenames: string[]) {
  if (filenames.length === 0) return;
  const db = await getDb();
  const { rows } = await db.query(
    'SELECT COALESCE(MAX(position), -1) as "maxPos" FROM product_images WHERE product_id = $1',
    [productId]
  );
  const maxPos = rows[0].maxPos as number;

  for (let idx = 0; idx < filenames.length; idx += 1) {
    await db.query('INSERT INTO product_images (product_id, filename, position) VALUES ($1, $2, $3)', [
      productId,
      filenames[idx],
      maxPos + 1 + idx,
    ]);
  }
}

export async function deleteProductImage(imageId: number): Promise<string | null> {
  const db = await getDb();
  const { rows } = await db.query('SELECT filename FROM product_images WHERE id = $1', [imageId]);
  if (rows.length === 0) return null;
  await db.query('DELETE FROM product_images WHERE id = $1', [imageId]);
  return rows[0].filename;
}

export async function deleteProduct(id: number): Promise<string[]> {
  const db = await getDb();
  const { rows } = await db.query('SELECT filename FROM product_images WHERE product_id = $1', [id]);
  await db.query('DELETE FROM products WHERE id = $1', [id]);
  return rows.map((r) => r.filename);
}

export async function toggleFeatured(id: number): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE products SET featured = NOT featured, updated_at = now() WHERE id = $1', [id]);
}

// Single atomic UPDATE (GREATEST clamps at 0) instead of a read-then-write - safe under
// concurrent clicks or a concurrent order checkout without needing an explicit row lock.
export async function adjustStock(id: number, delta: number): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query(
    'UPDATE products SET stock = GREATEST(stock + $1, 0), updated_at = now() WHERE id = $2 RETURNING stock',
    [delta, id]
  );
  return rows[0].stock as number;
}
