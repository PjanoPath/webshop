import { getSettings } from '@/lib/settings';

export default async function Footer() {
  const settings = await getSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-olive-100 bg-cream-100">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-olive-800">{settings.shop_name}</p>
            <p className="mt-1 max-w-sm text-sm text-olive-600">{settings.tagline}</p>
          </div>

          <div className="flex flex-col gap-1 text-sm text-olive-600">
            {settings.email && (
              <a href={`mailto:${settings.email}`} className="transition hover:text-olive-900">
                {settings.email}
              </a>
            )}
            {settings.whatsapp_number && (
              <a
                href={`https://wa.me/${settings.whatsapp_number.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-olive-900"
              >
                WhatsApp: {settings.whatsapp_number}
              </a>
            )}
            <div className="mt-1 flex gap-4">
              {settings.instagram_url && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-olive-900"
                >
                  Instagram
                </a>
              )}
              {settings.facebook_url && (
                <a
                  href={settings.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-olive-900"
                >
                  Facebook
                </a>
              )}
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-olive-400">
          © {year} {settings.shop_name}. Všetky práva vyhradené.
          {' · '}
          Ikony jesenných lístkov:{' '}
          <a
            href="https://twemoji.twitter.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition hover:text-olive-600"
          >
            Twemoji
          </a>{' '}
          (CC-BY 4.0)
        </p>
      </div>
    </footer>
  );
}
