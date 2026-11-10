import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  createSubcategoryAction,
  updateSubcategoryAction,
  deleteSubcategoryAction,
} from './category-actions';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const categories = await listCategoriesWithSubcategories();
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Kategórie</h1>
      {error && <p className="mt-4 text-sm text-clay-600">{error}</p>}

      <form action={createCategoryAction} className="mt-8 flex gap-2">
        <input className="input" name="name" placeholder="Názov novej kategórie" required />
        <button className="btn-primary" type="submit">
          Pridať kategóriu
        </button>
      </form>

      <div className="mt-8 space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <form action={updateCategoryAction.bind(null, cat.id)} className="flex flex-1 gap-2">
                <input className="input" name="name" defaultValue={cat.name} />
                <button className="btn-secondary" type="submit">
                  Uložiť
                </button>
              </form>
              <form action={deleteCategoryAction.bind(null, cat.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`Naozaj vymazať kategóriu "${cat.name}"?`}
                  className="text-sm text-clay-600 hover:text-clay-700"
                >
                  Vymazať
                </ConfirmSubmitButton>
              </form>
            </div>

            <div className="mt-4 space-y-2 border-t border-olive-100 pt-4">
              {cat.subcategories.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between gap-4">
                  <form action={updateSubcategoryAction.bind(null, sub.id)} className="flex flex-1 gap-2">
                    <input className="input" name="name" defaultValue={sub.name} />
                    <button className="btn-secondary text-sm" type="submit">
                      Uložiť
                    </button>
                  </form>
                  <form action={deleteSubcategoryAction.bind(null, sub.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={`Naozaj vymazať podkategóriu "${sub.name}"?`}
                      className="text-sm text-clay-600 hover:text-clay-700"
                    >
                      Vymazať
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ))}
              <form action={createSubcategoryAction.bind(null, cat.id)} className="flex gap-2 pt-2">
                <input className="input" name="name" placeholder="Nová podkategória" required />
                <button className="btn-secondary" type="submit">
                  Pridať
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
