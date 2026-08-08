export const metadata = {
  title: 'Entregas - Mercado',
  manifest: '/manifest-entregador.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Entregas' },
  icons: { apple: '/icones-entregador/apple-touch-icon.png', icon: '/icones-entregador/icon-192.png' },
};

export default function EntregadorLayout({ children }) {
  return children;
}
