import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductGallery from '@/components/ProductGallery';
import AddToCartButton from '@/components/AddToCartButton';
import BulkAddToCartButton from '@/components/BulkAddToCartButton';
import VariantAddToCartButton from '@/components/VariantAddToCartButton';
import { getProductBySlug } from '@/lib/products';
import { BULK_STEP } from '@/lib/productConstants';

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <Link href="/produkty" className="text-sm text-olive-500 transition hover:text-olive-800">
        ← Späť na produkty
      </Link>

      <div className="mt-6 grid gap-10 sm:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} pickupOnly={product.pickupOnly} />

        <div>
          {product.category && product.subcategory && (
            <p className="text-xs uppercase tracking-wide text-gold-600">
              {product.category.name} · {product.subcategory.name}
            </p>
          )}
          <h1 className="mt-1 text-3xl font-semibold">{product.name}</h1>

          {product.saleMode === 'variant' ? (
            (() => {
              const inStock = product.variants.filter((v) => v.stock > 0);
              const prices = (inStock.length > 0 ? inStock : product.variants).map((v) => v.price);
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              return (
                <p className="mt-3 text-2xl font-medium text-olive-700">
                  {min === max ? `${min.toFixed(2)} €` : `od ${min.toFixed(2)} €`}
                </p>
              );
            })()
          ) : (
            <>
              <p className="mt-3 text-2xl font-medium text-olive-700">
                {product.price.toFixed(2)} € {product.saleMode === 'bulk' && `/ ${product.bulkUnit === 'ml' ? 'L' : 'kg'}`}
              </p>
              <p className="mt-1 text-sm text-olive-500">
                {product.stock > 0
                  ? product.saleMode === 'bulk'
                    ? `Skladom: ${product.stock * BULK_STEP} ${product.bulkUnit}`
                    : `Skladom: ${product.stock} ks`
                  : 'Vypredané'}
              </p>
            </>
          )}

          {product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span key={tag.id} className="tag-pill">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          <p className="mt-5 whitespace-pre-line text-olive-600">{product.description}</p>

          <div className="mt-8">
            {product.saleMode === 'bulk' ? (
              <BulkAddToCartButton
                productId={product.id}
                slug={product.slug}
                name={product.name}
                pricePerKgOrL={product.price}
                bulkUnit={product.bulkUnit ?? 'g'}
                photoFilename={product.images[0]?.filename ?? null}
                stockSteps={product.stock}
                pickupOnly={product.pickupOnly}
              />
            ) : product.saleMode === 'variant' ? (
              <VariantAddToCartButton
                productId={product.id}
                slug={product.slug}
                name={product.name}
                photoFilename={product.images[0]?.filename ?? null}
                variants={product.variants}
                pickupOnly={product.pickupOnly}
              />
            ) : (
              <AddToCartButton
                productId={product.id}
                slug={product.slug}
                name={product.name}
                price={product.price}
                photoFilename={product.images[0]?.filename ?? null}
                stock={product.stock}
                pickupOnly={product.pickupOnly}
                showQuantityStepper
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
