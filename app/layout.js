import './globals.css';
import RegistrarServiceWorker from './RegistrarServiceWorker';

export const metadata = {
  title: 'Mercado Online',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mercado',
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
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
      </head>
      <body>
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
