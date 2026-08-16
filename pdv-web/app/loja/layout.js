const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata = {
  title: 'Pedidos - Mercado',
  manifest: `${BASE}/manifest-loja.json`,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pedidos' },
  icons: { apple: `${BASE}/icones-loja/apple-touch-icon.png`, icon: `${BASE}/icones-loja/icon-192.png` },
};

export default function LojaLayout({ children }) {
  return children;
}
