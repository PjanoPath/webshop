import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import { listTags } from '@/lib/tags';
import { createTagAction, updateTagAction, deleteTagAction } from './tag-actions';

export const dynamic = 'force-dynamic';

export default async function AdminTagsPage() {
  const tags = await listTags();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Tagy</h1>

      <form action={createTagAction} className="mt-8 flex gap-2">
        <input className="input" name="name" placeholder="Názov nového tagu" required />
        <button className="btn-primary" type="submit">
          Pridať tag
        </button>
      </form>

      <div className="mt-8 flex flex-wrap gap-3">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-2 rounded-full bg-cream-200 px-3 py-1.5">
            <form action={updateTagAction.bind(null, tag.id)} className="flex items-center gap-1">
              <input
                className="w-28 border-none bg-transparent text-sm text-olive-700 focus:outline-none"
                name="name"
                defaultValue={tag.name}
              />
              <button className="text-xs text-olive-500 hover:text-olive-800" type="submit">
                ✓
              </button>
            </form>
            <form action={deleteTagAction.bind(null, tag.id)}>
              <ConfirmSubmitButton
                confirmMessage={`Naozaj vymazať tag "${tag.name}"?`}
                className="text-xs text-clay-600 hover:text-clay-700"
              >
                ✕
              </ConfirmSubmitButton>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
