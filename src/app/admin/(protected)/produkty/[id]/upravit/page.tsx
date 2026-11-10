import { notFound } from 'next/navigation';
import ProductForm from '../../ProductForm';
import { updateProductAction } from '../../product-actions';
import { getProductById } from '@/lib/products';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listTags } from '@/lib/tags';
import { deleteImageAction } from '../../../actions';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const product = await getProductById(id);
  if (!product) notFound();

  const categories = await listCategoriesWithSubcategories();
  const tags = await listTags();
  const boundUpdate = updateProductAction.bind(null, id);
  const boundDeleteImage = deleteImageAction.bind(null, id);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Upraviť produkt</h1>
      <div className="mt-8">
        <ProductForm
          action={boundUpdate}
          product={product}
          submitLabel="Uložiť zmeny"
          categories={categories}
          tags={tags}
          onDeleteImage={boundDeleteImage}
        />
      </div>
    </div>
  );
}
