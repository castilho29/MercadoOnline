export const metadata = {
  title: 'Pedidos - Mercado',
  manifest: '/manifest-loja.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pedidos' },
  icons: { apple: '/icones-loja/apple-touch-icon.png', icon: '/icones-loja/icon-192.png' },
};

export default function LojaLayout({ children }) {
  return children;
}
