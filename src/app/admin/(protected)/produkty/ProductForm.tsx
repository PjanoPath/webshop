'use client';

import Image from 'next/image';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Product } from '@/lib/products';
import { BULK_STEP, type SaleMode } from '@/lib/productConstants';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { Tag } from '@/lib/tags';
import type { ProductFormState } from './product-actions';
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';

const initialState: ProductFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Ukladá sa…' : label}
    </button>
  );
}

type Props = {
  action: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: Product;
  submitLabel: string;
  onDeleteImage?: (imageId: number) => Promise<void>;
  categories: CategoryWithSubcategories[];
  tags: Tag[];
};

export default function ProductForm({ action, product, submitLabel, onDeleteImage, categories, tags }: Props) {
  const [state, formAction] = useActionState(action, initialState);
  const [categoryId, setCategoryId] = useState(product?.category ? String(product.category.id) : '');
  const [subcategoryId, setSubcategoryId] = useState(product?.subcategory ? String(product.subcategory.id) : '');
  const availableSubcategories = categories.find((c) => String(c.id) === categoryId)?.subcategories ?? [];

  const [priceInput, setPriceInput] = useState(product ? String(product.price) : '');
  const [vatRate, setVatRate] = useState(product ? product.vatRate : 23);
  const priceNumber = parseFloat(priceInput.replace(',', '.'));
  const hasValidPrice = !Number.isNaN(priceNumber) && priceNumber >= 0;
  // Price is entered VAT-inclusive, so the base (pre-VAT) amount is derived, not stored - same
  // math as summarizeVat in pdf-styles.ts. Recomputes on every keystroke/rate click so the admin
  // can see the split immediately instead of only finding out once an invoice gets generated.
  const basePrice = hasValidPrice ? priceNumber / (1 + vatRate / 100) : 0;
  const vatAmount = hasValidPrice ? priceNumber - basePrice : 0;

  const [saleMode, setSaleMode] = useState<SaleMode>(product?.saleMode ?? 'piece');
  const [bulkUnit, setBulkUnit] = useState<'g' | 'ml'>(product?.bulkUnit ?? 'g');
  // Stored in the DB as 25-unit steps, shown to the admin as real grams/ml - see BULK_STEP.
  const [bulkStock, setBulkStock] = useState(product ? String(product.stock * BULK_STEP) : '');

  type VariantRow = { id?: number; label: string; price: string; stock: string };
  const [variants, setVariants] = useState<VariantRow[]>(
    product && product.variants.length > 0
      ? product.variants.map((v) => ({ id: v.id, label: v.label, price: String(v.price), stock: String(v.stock) }))
      : [{ label: '', price: '', stock: '' }]
  );
  const updateVariant = (index: number, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const addVariantRow = () => setVariants((rows) => [...rows, { label: '', price: '', stock: '' }]);
  const removeVariantRow = (index: number) => setVariants((rows) => rows.filter((_, i) => i !== index));

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div>
        <label className="label" htmlFor="name">
          Názov produktu
        </label>
        <input className="input" id="name" name="name" defaultValue={product?.name} required />
      </div>

      <div>
        <label className="label" htmlFor="description">
          Popis
        </label>
        <textarea className="input" id="description" name="description" rows={5} defaultValue={product?.description} />
      </div>

      <div>
        <label className="label">Spôsob predaja</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm text-olive-700">
            <input type="radio" name="sale_mode" value="piece" checked={saleMode === 'piece'} onChange={() => setSaleMode('piece')} />
            Kus
          </label>
          <label className="flex items-center gap-2 text-sm text-olive-700">
            <input type="radio" name="sale_mode" value="bulk" checked={saleMode === 'bulk'} onChange={() => setSaleMode('bulk')} />
            Voľne (na váhu/objem)
          </label>
          <label className="flex items-center gap-2 text-sm text-olive-700">
            <input
              type="radio"
              name="sale_mode"
              value="variant"
              checked={saleMode === 'variant'}
              onChange={() => setSaleMode('variant')}
            />
            Varianty (balenia)
          </label>
        </div>
        {saleMode === 'bulk' && (
          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-olive-700">
              <input type="radio" name="bulk_unit" value="g" checked={bulkUnit === 'g'} onChange={() => setBulkUnit('g')} />
              Gramy
            </label>
            <label className="flex items-center gap-2 text-sm text-olive-700">
              <input type="radio" name="bulk_unit" value="ml" checked={bulkUnit === 'ml'} onChange={() => setBulkUnit('ml')} />
              Mililitre
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {saleMode !== 'variant' && (
          <div>
            <label className="label" htmlFor="price">
              {saleMode === 'bulk' ? `Cena za kg / liter (€)` : 'Cena (€)'}
            </label>
            <input
              className="input"
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-olive-400">
              {saleMode === 'bulk'
                ? `Konečná cena vrátane DPH, za 1 kg / 1 liter. Zákazník si vyberie množstvo po ${BULK_STEP} ${bulkUnit}.`
                : 'Konečná cena vrátane DPH.'}
            </p>
          </div>
        )}
        <div>
          <label className="label">Sadzba DPH{saleMode === 'variant' && ' (platí pre všetky varianty)'}</label>
          <div className="flex h-[42px] items-center gap-4">
            {[23, 19, 5].map((rate) => (
              <label key={rate} className="flex items-center gap-1.5 text-sm text-olive-700">
                <input
                  type="radio"
                  name="vat_rate"
                  value={rate}
                  checked={vatRate === rate}
                  onChange={() => setVatRate(rate)}
                />
                {rate} %
              </label>
            ))}
          </div>
        </div>
      </div>

      {saleMode !== 'variant' && hasValidPrice && (
        <p className="-mt-3 text-xs text-olive-500">
          Základ dane: <span className="font-medium text-olive-700">{basePrice.toFixed(2)} €</span> · DPH (
          {vatRate} %): <span className="font-medium text-olive-700">{vatAmount.toFixed(2)} €</span>
        </p>
      )}

      {saleMode === 'variant' && (
        <div>
          <label className="label">Varianty (balenia)</label>
          <div className="space-y-3">
            {variants.map((row, i) => (
              <div key={i} className="flex items-end gap-3">
                <div className="flex-1">
                  {i === 0 && <p className="mb-1 text-xs text-olive-400">Názov (napr. &bdquo;50 ml&ldquo;)</p>}
                  <input
                    className="input"
                    value={row.label}
                    onChange={(e) => updateVariant(i, { label: e.target.value })}
                    placeholder="50 ml"
                    name="variant_label"
                  />
                  <input type="hidden" name="variant_id" value={row.id ?? ''} />
                </div>
                <div className="w-28">
                  {i === 0 && <p className="mb-1 text-xs text-olive-400">Cena (€)</p>}
                  <input
                    className="input"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(e) => updateVariant(i, { price: e.target.value })}
                    placeholder="0.00"
                    name="variant_price"
                  />
                </div>
                <div className="w-24">
                  {i === 0 && <p className="mb-1 text-xs text-olive-400">Sklad (ks)</p>}
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={row.stock}
                    onChange={(e) => updateVariant(i, { stock: e.target.value })}
                    placeholder="0"
                    name="variant_stock"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVariantRow(i)}
                  className="h-[42px] px-2 text-clay-600 transition hover:text-clay-700"
                  aria-label="Odstrániť variantu"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addVariantRow} className="btn-secondary mt-3 py-1 text-sm">
            + Pridať variantu
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="category">
            Kategória
          </label>
          <select
            className="input"
            id="category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubcategoryId('');
            }}
            required
          >
            <option value="" disabled>
              Vyber kategóriu
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="subcategory_id">
            Podkategória
          </label>
          <select
            className="input"
            id="subcategory_id"
            name="subcategory_id"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            required
            disabled={!categoryId}
          >
            <option value="" disabled>
              Vyber podkategóriu
            </option>
            {availableSubcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Tagy</legend>
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1.5 text-sm text-olive-700">
              <input
                type="checkbox"
                name="tag_ids"
                value={tag.id}
                defaultChecked={product?.tags.some((t) => t.id === tag.id)}
              />
              {tag.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        {saleMode === 'piece' && (
          <div>
            <label className="label" htmlFor="stock">
              Skladom (ks)
            </label>
            <input
              className="input"
              id="stock"
              name="stock"
              type="number"
              min={0}
              step={1}
              defaultValue={product ? product.stock : 0}
              required
            />
          </div>
        )}
        {saleMode === 'bulk' && (
          <div>
            <label className="label" htmlFor="stock">
              Skladom ({bulkUnit})
            </label>
            <input
              className="input"
              id="stock"
              name="stock"
              type="number"
              min={0}
              step={BULK_STEP}
              value={bulkStock}
              onChange={(e) => setBulkStock(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-olive-400">Zaokrúhli sa na najbližších {BULK_STEP} {bulkUnit}.</p>
          </div>
        )}
        <label className="mt-6 flex items-center gap-2 text-sm text-olive-700">
          <input type="checkbox" name="featured" defaultChecked={product ? !!product.featured : false} />
          Zobraziť medzi obľúbenými
        </label>
        <label className="flex items-center gap-2 text-sm text-olive-700">
          <input type="checkbox" name="pickup_only" defaultChecked={product ? !!product.pickupOnly : false} />
          Iba na predajni (nedá sa odoslať poštou)
        </label>
      </div>

      {product && product.images.length > 0 && (
        <div>
          <p className="label">Existujúce fotky</p>
          <div className="flex flex-wrap gap-3">
            {product.images.map((img) => (
              <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-olive-100">
                <Image src={`/uploads/${img.filename}`} alt="" fill sizes="80px" className="object-cover" />
                {onDeleteImage && (
                  <ConfirmSubmitButton
                    formAction={onDeleteImage.bind(null, img.id)}
                    confirmMessage="Vymazať túto fotku?"
                    className="absolute right-0 top-0 rounded-bl bg-clay-500/90 px-1.5 py-0.5 text-xs text-white"
                  >
                    ✕
                  </ConfirmSubmitButton>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="images">
          {product ? 'Pridať nové fotky' : 'Fotky'}
        </label>
        <input className="input" id="images" name="images" type="file" accept="image/*" multiple />
      </div>

      {state.error && <p className="text-sm text-clay-600">{state.error}</p>}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
