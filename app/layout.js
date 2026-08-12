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
  // Usando o campo "icons" do metadata (em vez de <link> escrito na
  // mão) -- assim o Next.js resolve sozinho o prefixo certo quando
  // o site está publicado dentro de uma subpasta (GitHub Pages).
  icons: {
    apple: '/apple-touch-icon.png',
    icon: '/icon-192.png',
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
