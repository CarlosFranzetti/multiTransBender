import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppHeader } from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'MultiTransBend',
  description:
    'A multiband transient designer with per-band analog saturation. Six bands, ten engines, three views. Process in the browser at full resolution and download a lossless file. Nothing is uploaded.',
  applicationName: 'MultiTransBend',
};

export const viewport: Viewport = {
  themeColor: '#08090b',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        <main>{children}</main>
        <footer className="shell" style={{ paddingTop: 0, paddingBottom: "1.5rem" }}>
          <div
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '1.25rem',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: 'var(--text-faint)',
            }}
          >
            <span>CASE AUDIO · MultiTransBend v0.1b — audio never leaves your browser.</span>
            <span className="mono">64-bit engine · 6 bands · 10 engines · lossless export</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
