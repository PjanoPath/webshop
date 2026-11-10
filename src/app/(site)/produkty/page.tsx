import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { listProducts } from '@/lib/products';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listTags } from '@/lib/tags';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ kategoria?: string; podkategoria?: string; tag?: string }>;
}) {
  const { kategoria, podkategoria, tag } = await searchParams;
  const [categories, tags, settings] = await Promise.all([
    listCategoriesWithSubcategories(),
    listTags(),
    getSettings(),
  ]);

  const activeCategory = kategoria ? categories.find((c) => c.slug === kategoria) : undefined;
  const activeSubcategory =
    activeCategory && podkategoria ? activeCategory.subcategories.find((s) => s.slug === podkategoria) : undefined;
  const activeTag = tag ? tags.find((t) => t.slug === tag) : undefined;

  // Category alone (no subcategory, no tag) is a drill-down step: show its subcategory
  // list, not products yet. A tag filter always shows products regardless of category state.
  const showSubcategoriesOnly = !!activeCategory && !activeSubcategory && !activeTag;

  const products = showSubcategoriesOnly
    ? []
    : await listProducts({
        categoryId: activeCategory?.id,
        subcategoryId: activeSubcategory?.id,
        tagId: activeTag?.id,
      });

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <div className="rounded-xl2 bg-olive-50 bg-grain px-5 py-10 text-center">
        <h1 className="text-3xl font-semibold">Produkty</h1>
        {settings.tagline && <p className="mx-auto mt-2 max-w-xl text-olive-600">{settings.tagline}</p>}
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-[220px_1fr]">
        <aside className="space-y-4">
          <div className="space-y-1">
            <Link
              href="/produkty"
              className={`block rounded-full px-4 py-1.5 text-sm transition ${
                !activeCategory ? 'bg-olive-700 text-cream-50' : 'text-olive-700 hover:bg-cream-200'
              }`}
            >
              Všetko
            </Link>
            {categories.map((cat) => (
              <div key={cat.id}>
                <Link
                  href={`/produkty?kategoria=${cat.slug}`}
                  className={`block rounded-full px-4 py-1.5 text-sm transition ${
                    activeCategory?.id === cat.id
                      ? 'bg-olive-700 text-cream-50'
                      : 'text-olive-700 hover:bg-cream-200'
                  }`}
                >
                  {cat.name}
                </Link>
                {activeCategory?.id === cat.id && cat.subcategories.length > 0 && (
                  <div className="ml-3 mt-1 space-y-1 border-l border-olive-100 pl-3">
                    {cat.subcategories.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/produkty?kategoria=${cat.slug}&podkategoria=${sub.slug}`}
                        className={`block rounded-full px-3 py-1 text-sm transition ${
                          activeSubcategory?.id === sub.id
                            ? 'bg-olive-700 text-cream-50'
                            : 'text-olive-600 hover:bg-cream-200'
                        }`}
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {tags.length > 0 && (
            <div>
              <p className="label">Tagy</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const params = new URLSearchParams();
                  if (kategoria) params.set('kategoria', kategoria);
                  if (podkategoria) params.set('podkategoria', podkategoria);
                  const isActive = activeTag?.id === t.id;
                  if (!isActive) params.set('tag', t.slug);
                  const href = `/produkty${params.toString() ? `?${params.toString()}` : ''}`;

                  return (
                    <Link
                      key={t.id}
                      href={href}
                      className={`tag-pill transition ${isActive ? '!bg-olive-700 !text-cream-50' : 'hover:bg-cream-300'}`}
                    >
                      {t.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <div>
          {showSubcategoriesOnly ? (
            activeCategory!.subcategories.length === 0 ? (
              <p className="text-olive-500">Táto kategória zatiaľ nemá žiadne podkategórie.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {activeCategory!.subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/produkty?kategoria=${activeCategory!.slug}&podkategoria=${sub.slug}`}
                    className="card flex items-center justify-center p-6 text-center font-medium text-olive-700 transition hover:-translate-y-1 hover:shadow-soft"
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            )
          ) : products.length === 0 ? (
            <p className="text-olive-500">V tejto kategórii zatiaľ nie sú žiadne produkty.</p>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
