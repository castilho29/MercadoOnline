export const metadata = {
  title: 'Retaguarda - Mercado',
  manifest: '/manifest-admin.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Retaguarda' },
  icons: { apple: '/icones-admin/apple-touch-icon.png', icon: '/icones-admin/icon-192.png' },
};

export default function AdminLayout({ children }) {
  return children;
}
