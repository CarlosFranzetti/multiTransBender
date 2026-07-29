'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ENGINE_VERSION } from '@/dsp';

const LINKS = [
  { href: '/studio', label: 'Studio' },
  { href: '/plugin', label: 'Plugin' },
  { href: '/account', label: 'Account' },
  { href: '/privacy', label: 'Privacy' },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <span>
            TRANS<span className="brand-mark">BAND</span>
          </span>
          <span className="brand-version">multiTransBender · v{ENGINE_VERSION}</span>
        </Link>
        <nav className="nav">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
