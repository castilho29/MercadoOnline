const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata = {
  title: 'Entregas - Mercado',
  manifest: `${BASE}/manifest-entregador.json`,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Entregas' },
  icons: { apple: `${BASE}/icones-entregador/apple-touch-icon.png`, icon: `${BASE}/icones-entregador/icon-192.png` },
};

export default function EntregadorLayout({ children }) {
  return children;
}
