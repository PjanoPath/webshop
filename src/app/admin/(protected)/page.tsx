import Image from 'next/image';
import Link from 'next/link';
import { countProducts, listProducts } from '@/lib/products';
import { toggleFeaturedAction, deleteProductAction } from './actions';
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import StockControl from './StockControl';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

function pageHref(page: number, search: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (search) params.set('hladat', search);
  const qs = params.toString();
  return qs ? `/admin?${qs}` : '/admin';
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; hladat?: string }>;
}) {
  const { page: pageParam, hladat } = await searchParams;
  const search = (hladat ?? '').trim();

  const total = await countProducts({ search: search || undefined });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);
  const offset = (page - 1) * PAGE_SIZE;

  const products = await listProducts({ search: search || undefined, limit: PAGE_SIZE, offset });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produkty</h1>
        <Link href="/admin/produkty/novy" className="btn-primary">
          + Pridať produkt
        </Link>
      </div>

      <form method="GET" className="mt-6 flex gap-2">
        <input
          className="input max-w-xs"
          type="text"
          name="hladat"
          defaultValue={search}
          placeholder="Hľadať podľa názvu…"
        />
        <button type="submit" className="btn-secondary">
          Hľadať
        </button>
        {search && (
          <Link href="/admin" className="btn-secondary">
            Zrušiť
          </Link>
        )}
      </form>

      {total === 0 ? (
        <p className="mt-10 text-olive-500">
          {search
            ? 'Žiadne produkty nezodpovedajú hľadaniu.'
            : 'Zatiaľ žiadne produkty. Pridaj prvý cez tlačidlo vyššie.'}
        </p>
      ) : (
        <>
          <div className="mt-8 overflow-hidden rounded-xl2 bg-white shadow-card">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-olive-100 bg-cream-100 text-xs uppercase tracking-wide text-olive-500">
                <tr>
                  <th className="px-4 py-3">Foto</th>
                  <th className="px-4 py-3">Názov</th>
                  <th className="px-4 py-3">Kategória</th>
                  <th className="px-4 py-3">Cena</th>
                  <th className="px-4 py-3">Skladom</th>
                  <th className="px-4 py-3">Odporúčané</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const boundToggleFeatured = toggleFeaturedAction.bind(null, product.id);
                  const boundDelete = deleteProductAction.bind(null, product.id);

                  return (
                    <tr key={product.id} className="border-b border-olive-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-cream-200">
                          {product.images[0] && (
                            <Image
                              src={`/uploads/${product.images[0].filename}`}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-olive-800">{product.name}</td>
                      <td className="px-4 py-3 text-olive-500">
                        {product.category ? `${product.category.name} / ${product.subcategory?.name ?? '—'}` : '—'}
                      </td>
                      <td className="px-4 py-3">{product.price.toFixed(2)} €</td>
                      <td className="px-4 py-3">
                        <StockControl productId={product.id} initialStock={product.stock} />
                      </td>
                      <td className="px-4 py-3">
                        <form action={boundToggleFeatured}>
                          <button
                            type="submit"
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              product.featured ? 'bg-gold-300/40 text-gold-700' : 'bg-cream-200 text-olive-400'
                            }`}
                          >
                            {product.featured ? 'Áno' : 'Nie'}
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/produkty/${product.id}/upravit`}
                            className="text-olive-600 transition hover:text-olive-900"
                          >
                            Upraviť
                          </Link>
                          <form action={boundDelete}>
                            <ConfirmSubmitButton
                              confirmMessage={`Naozaj vymazať produkt "${product.name}"?`}
                              className="text-clay-600 transition hover:text-clay-700"
                            >
                              Vymazať
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-olive-600">
              <span>
                Strana {page} z {pageCount} ({total} produktov)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={pageHref(page - 1, search)} className="btn-secondary py-1 text-sm">
                    ← Predošlá
                  </Link>
                )}
                {page < pageCount && (
                  <Link href={pageHref(page + 1, search)} className="btn-secondary py-1 text-sm">
                    Ďalšia →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
