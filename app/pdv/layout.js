export const metadata = {
  title: 'Caixa - Mercado',
  manifest: '/manifest-pdv.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Caixa' },
  icons: { apple: '/icones-pdv/apple-touch-icon.png', icon: '/icones-pdv/icon-192.png' },
};

export default function PdvLayout({ children }) {
  return children;
}
