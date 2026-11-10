'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ShopSettings } from '@/lib/settings';
import { updateSettingsAction, SettingsFormState } from './settings-actions';

const initialState: SettingsFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Ukladá sa…' : 'Uložiť nastavenia'}
    </button>
  );
}

export default function SettingsForm({ settings }: { settings: ShopSettings }) {
  const [state, formAction] = useActionState(updateSettingsAction, initialState);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="shop_name">
            Názov obchodu
          </label>
          <input className="input" id="shop_name" name="shop_name" defaultValue={settings.shop_name} required />
        </div>
        <div>
          <label className="label" htmlFor="tagline">
            Podnadpis
          </label>
          <input className="input" id="tagline" name="tagline" defaultValue={settings.tagline} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="about_text">
          Text „O mne“
        </label>
        <textarea className="input" id="about_text" name="about_text" rows={5} defaultValue={settings.about_text} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="whatsapp_number">
            WhatsApp číslo
          </label>
          <input
            className="input"
            id="whatsapp_number"
            name="whatsapp_number"
            defaultValue={settings.whatsapp_number}
            placeholder="+421900123456"
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            E-mail
          </label>
          <input className="input" id="email" name="email" type="email" defaultValue={settings.email} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="instagram_url">
            Instagram odkaz
          </label>
          <input className="input" id="instagram_url" name="instagram_url" defaultValue={settings.instagram_url} />
        </div>
        <div>
          <label className="label" htmlFor="facebook_url">
            Facebook odkaz
          </label>
          <input className="input" id="facebook_url" name="facebook_url" defaultValue={settings.facebook_url} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="iban">
          IBAN (v e-maile o čakajúcej platbe)
        </label>
        <input
          className="input"
          id="iban"
          name="iban"
          defaultValue={settings.iban}
          placeholder="SK00 0000 0000 0000 0000 0000"
        />
      </div>

      <div className="border-t border-olive-100 pt-6">
        <h2 className="font-semibold">Údaje na faktúru</h2>
        <p className="mt-1 text-sm text-olive-500">
          Zobrazujú sa v bloku „Dodávateľ“ na vygenerovaných faktúrach. Nechaj prázdne, ak sa
          nevzťahuje (napr. nie si platca DPH).
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="ico">
              IČO
            </label>
            <input className="input" id="ico" name="ico" defaultValue={settings.ico} />
          </div>
          <div>
            <label className="label" htmlFor="dic">
              DIČ
            </label>
            <input className="input" id="dic" name="dic" defaultValue={settings.dic} />
          </div>
          <div>
            <label className="label" htmlFor="ic_dph">
              IČ DPH
            </label>
            <input className="input" id="ic_dph" name="ic_dph" defaultValue={settings.ic_dph} placeholder="SK..." />
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="payment_instructions">
          Ďalšie platobné inštrukcie (voliteľné, zobrazujú sa na stránke objednávky)
        </label>
        <textarea
          className="input"
          id="payment_instructions"
          name="payment_instructions"
          rows={4}
          defaultValue={settings.payment_instructions}
        />
      </div>

      <div>
        <label className="label" htmlFor="address">
          Adresa (v pätičke e-mailov)
        </label>
        <textarea
          className="input"
          id="address"
          name="address"
          rows={3}
          defaultValue={settings.address}
          placeholder={'Ulica 123\nMesto\nPSČ'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="phone">
            Telefón
          </label>
          <input className="input" id="phone" name="phone" defaultValue={settings.phone} placeholder="+421900123456" />
        </div>
        <div>
          <label className="label" htmlFor="website_url">
            Webstránka
          </label>
          <input
            className="input"
            id="website_url"
            name="website_url"
            defaultValue={settings.website_url}
            placeholder="https://www.vasadomena.sk"
          />
        </div>
      </div>

      <div className="border-t border-olive-100 pt-6">
        <h2 className="font-semibold">Texty e-mailov o stave objednávky</h2>
        <p className="mt-1 text-sm text-olive-500">
          Použi <code>{'{{cislo}}'}</code> namiesto čísla objednávky - doplní sa automaticky. Suma, IBAN,
          variabilný symbol, kontakt a pätička sa pridávajú automaticky, netreba ich sem písať.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="email_pending_text">
              Čaká sa na platbu
            </label>
            <textarea
              className="input"
              id="email_pending_text"
              name="email_pending_text"
              rows={4}
              defaultValue={settings.email_pending_text}
            />
          </div>
          <div>
            <label className="label" htmlFor="email_pickup_text">
              Objednávka prijatá (vyzdvihnutie na predajni)
            </label>
            <textarea
              className="input"
              id="email_pickup_text"
              name="email_pickup_text"
              rows={4}
              defaultValue={settings.email_pickup_text}
            />
          </div>
          <div>
            <label className="label" htmlFor="email_paid_text">
              Platba prijatá
            </label>
            <textarea
              className="input"
              id="email_paid_text"
              name="email_paid_text"
              rows={4}
              defaultValue={settings.email_paid_text}
            />
          </div>
          <div>
            <label className="label" htmlFor="email_shipped_text">
              Objednávka vybavená
            </label>
            <textarea
              className="input"
              id="email_shipped_text"
              name="email_shipped_text"
              rows={4}
              defaultValue={settings.email_shipped_text}
            />
          </div>
          <div>
            <label className="label" htmlFor="email_ready_for_pickup_text">
              Pripravená k odberu (vyzdvihnutie na predajni)
            </label>
            <textarea
              className="input"
              id="email_ready_for_pickup_text"
              name="email_ready_for_pickup_text"
              rows={4}
              defaultValue={settings.email_ready_for_pickup_text}
            />
          </div>
          <div>
            <label className="label" htmlFor="email_cancelled_text">
              Zrušená objednávka
            </label>
            <textarea
              className="input"
              id="email_cancelled_text"
              name="email_cancelled_text"
              rows={4}
              defaultValue={settings.email_cancelled_text}
            />
          </div>
          <div>
            <label className="label" htmlFor="email_credit_note_text">
              Dobropis (k zrušenej a už vyfakturovanej objednávke)
            </label>
            <p className="mb-1.5 text-xs text-olive-400">
              Tu naviac môžeš použiť <code>{'{{dobropis}}'}</code> (číslo dobropisu),{' '}
              <code>{'{{faktura}}'}</code> (číslo pôvodnej faktúry) a <code>{'{{suma}}'}</code> (suma na
              vrátenie).
            </p>
            <textarea
              className="input"
              id="email_credit_note_text"
              name="email_credit_note_text"
              rows={4}
              defaultValue={settings.email_credit_note_text}
            />
          </div>
        </div>
      </div>

      {state.success && <p className="text-sm text-olive-600">Nastavenia boli uložené.</p>}

      <SubmitButton />
    </form>
  );
}
