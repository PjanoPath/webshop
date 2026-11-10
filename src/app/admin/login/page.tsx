import LoginForm from './LoginForm';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-center text-xl font-semibold">{settings.shop_name} — Administrácia</h1>
        <p className="mt-1 text-center text-sm text-olive-500">Prihlás sa pre správu produktov</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
