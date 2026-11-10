import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF6',
          100: '#F8F2E7',
          200: '#F1E8D6',
          300: '#E8DABF',
        },
        olive: {
          50: '#F3F5EC',
          100: '#E1E7CE',
          200: '#CBD6AC',
          300: '#B7C48E',
          400: '#9CAC6C',
          500: '#7C8B4F',
          600: '#636F3E',
          700: '#4B5530',
          800: '#3A4126',
          900: '#2B301C',
        },
        gold: {
          100: '#F6E6BE',
          300: '#EBC873',
          500: '#D9A441',
          600: '#BC8830',
          700: '#946A24',
        },
        clay: {
          500: '#C0714A',
          600: '#A65C39',
          700: '#864A2E',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -6px rgba(75, 85, 48, 0.15)',
        card: '0 2px 12px -2px rgba(75, 85, 48, 0.12)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
