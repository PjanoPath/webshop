import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-3xl font-semibold">Stránka nenájdená</h1>
      <p className="mt-3 text-olive-600">Táto stránka neexistuje alebo bola presunutá.</p>
      <Link href="/" className="btn-primary mt-6">
        Späť na domovskú stránku
      </Link>
    </div>
  );
}
