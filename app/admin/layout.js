import AdminShell from './AdminShell';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata = {
  title: 'Retaguarda - Mercado',
  manifest: `${BASE}/manifest-admin.json`,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Retaguarda' },
  icons: { apple: `${BASE}/icones-admin/apple-touch-icon.png`, icon: `${BASE}/icones-admin/icon-192.png` },
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
