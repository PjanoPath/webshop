import { redirect } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { getSession } from '@/lib/auth';

async function logoutAction() {
  'use server';
  const session = await getSession();
  session.destroy();
  redirect('/admin/login');
}

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminNav logoutAction={logoutAction} />
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}
