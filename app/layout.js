import './globals.css';
import RegistrarServiceWorker from './RegistrarServiceWorker';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata = {
  title: 'Mercado Online',
  manifest: `${BASE}/manifest.json`,
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mercado',
  },
  icons: {
    apple: `${BASE}/apple-touch-icon.png`,
    icon: `${BASE}/icon-192.png`,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
