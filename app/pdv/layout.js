const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata = {
  title: 'Caixa - Mercado',
  manifest: `${BASE}/manifest-pdv.json`,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Caixa' },
  icons: { apple: `${BASE}/icones-pdv/apple-touch-icon.png`, icon: `${BASE}/icones-pdv/icon-192.png` },
};

export default function PdvLayout({ children }) {
  return children;
}
