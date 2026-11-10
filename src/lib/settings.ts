import { getDb } from './db';

export type ShopSettings = {
  shop_name: string;
  tagline: string;
  about_text: string;
  whatsapp_number: string;
  email: string;
  instagram_url: string;
  facebook_url: string;
  payment_instructions: string;
  address: string;
  phone: string;
  website_url: string;
  iban: string;
  ico: string;
  dic: string;
  ic_dph: string;
  email_pending_text: string;
  email_pickup_text: string;
  email_paid_text: string;
  email_shipped_text: string;
  email_cancelled_text: string;
  email_credit_note_text: string;
  email_ready_for_pickup_text: string;
};

const KEYS: (keyof ShopSettings)[] = [
  'shop_name',
  'tagline',
  'about_text',
  'whatsapp_number',
  'email',
  'instagram_url',
  'facebook_url',
  'payment_instructions',
  'address',
  'phone',
  'website_url',
  'iban',
  'ico',
  'dic',
  'ic_dph',
  'email_pending_text',
  'email_pickup_text',
  'email_paid_text',
  'email_shipped_text',
  'email_cancelled_text',
  'email_credit_note_text',
  'email_ready_for_pickup_text',
];

export async function getSettings(): Promise<ShopSettings> {
  const db = await getDb();
  const { rows } = await db.query('SELECT key, value FROM settings');
  const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));

  const result = {} as ShopSettings;
  for (const key of KEYS) {
    result[key] = map.get(key) ?? '';
  }
  return result;
}

export async function updateSettings(values: Partial<ShopSettings>): Promise<ShopSettings> {
  const db = await getDb();
  const entries = Object.entries(values).filter(([k]) => KEYS.includes(k as keyof ShopSettings));

  for (const [key, value] of entries) {
    await db.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
  }

  return getSettings();
}
