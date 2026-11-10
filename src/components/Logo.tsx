import fs from 'fs';
import path from 'path';
import Image from 'next/image';

function findLogoFile(): string | null {
  const candidates = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg', 'logo.webp'];
  for (const file of candidates) {
    if (fs.existsSync(path.join(/* turbopackIgnore: true */ process.cwd(), 'public', file))) {
      return `/${file}`;
    }
  }
  return null;
}

export default function Logo({ size = 64, shopName }: { size?: number; shopName: string }) {
  const logoSrc = findLogoFile();

  if (logoSrc) {
    return (
      <Image
        src={logoSrc}
        alt={shopName}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        priority
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={shopName}
    >
      <circle cx="50" cy="50" r="48" fill="#F8F2E7" stroke="#D9A441" strokeWidth="1.5" />
      <g stroke="#7C8B4F" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M50 20c8 6 8 16 0 22-8-6-8-16 0-22z" />
        <path d="M20 50c6-8 16-8 22 0-6 8-16 8-22 0z" />
        <path d="M80 50c-6-8-16-8-22 0 6 8 16 8 22 0z" />
        <path d="M50 80c-8-6-8-16 0-22 8 6 8 16 0 22z" />
      </g>
      <circle cx="50" cy="50" r="9" fill="#D9A441" />
      <text
        x="50"
        y="53"
        textAnchor="middle"
        fontSize="10"
        fontFamily="serif"
        fill="#4B5530"
      >
        VS
      </text>
    </svg>
  );
}
