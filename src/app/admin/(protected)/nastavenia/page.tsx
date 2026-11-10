import SettingsForm from './SettingsForm';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Nastavenia obchodu</h1>
      <div className="mt-8">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
