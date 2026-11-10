import RegisterForm from './RegisterForm';

export const dynamic = 'force-dynamic';

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const redirectTo = (await searchParams).redirect || '/ucet';

  return (
    <div className="mx-auto flex max-w-sm flex-col px-5 py-16">
      <div className="card p-8">
        <h1 className="text-center text-xl font-semibold">Registrácia</h1>
        <div className="mt-6">
          <RegisterForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
