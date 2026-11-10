import ProductForm from '../ProductForm';
import { createProductAction } from '../product-actions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listTags } from '@/lib/tags';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const categories = await listCategoriesWithSubcategories();
  const tags = await listTags();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Nový produkt</h1>
      <div className="mt-8">
        <ProductForm
          action={createProductAction}
          submitLabel="Vytvoriť produkt"
          categories={categories}
          tags={tags}
        />
      </div>
    </div>
  );
}
