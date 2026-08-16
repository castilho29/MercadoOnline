'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const GRUPOS = [
  {
    titulo: null,
    itens: [{ href: '/admin', label: 'Dashboard', icone: '🏠' }],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { href: '/admin/produtos', label: 'Produtos', icone: '📦' },
      { href: '/admin/fornecedores', label: 'Fornecedores', icone: '🏭' },
      { href: '/admin/entregadores', label: 'Entregadores', icone: '🛵' },
    ],
  },
  {
    titulo: 'Compras',
    itens: [
      { href: '/admin/importar-compra', label: 'Importar XML', icone: '📥' },
      { href: '/admin/contranota', label: 'Contranota', icone: '📝' },
      { href: '/admin/contas-pagar', label: 'Contas a pagar', icone: '💳' },
    ],
  },
  {
    titulo: 'Vendas',
    itens: [
      { href: '/pdv/balcao', label: 'Venda balcão', icone: '🛒' },
      { href: '/pdv', label: 'Pedidos online', icone: '🔔' },
      { href: '/pdv/condicionais', label: 'Condicionais', icone: '⏳' },
    ],
  },
  {
    titulo: 'Fiscal',
    itens: [{ href: '/admin/notas-fiscais', label: 'Notas fiscais', icone: '🧾' }],
  },
];

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  async function sair() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f4' }}>
      <aside
        className="admin-sidebar"
        style={{
          width: 220, background: '#111827', color: '#fff', flexShrink: 0,
          position: 'fixed', top: 0, bottom: 0, left: 0, overflowY: 'auto', zIndex: 40,
          transform: menuAberto ? 'translateX(0)' : undefined,
        }}
      >
        <div style={{ padding: '18px 20px', fontWeight: 800, fontSize: 17, borderBottom: '1px solid #1f2937' }}>
          MERCADO<span style={{ color: '#60a5fa' }}>ERP</span>
        </div>
        <nav style={{ padding: '12px 10px' }}>
          {GRUPOS.map((grupo, gi) => (
            <div key={gi} style={{ marginBottom: 14 }}>
              {grupo.titulo && (
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, padding: '6px 10px' }}>{grupo.titulo}</div>
              )}
              {grupo.itens.map((item) => {
                const ativo = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuAberto(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8,
                      fontSize: 14, textDecoration: 'none', marginBottom: 2,
                      background: ativo ? '#2563eb' : 'transparent',
                      color: ativo ? '#fff' : '#d1d5db',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{item.icone}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {menuAberto && (
        <div onClick={() => setMenuAberto(false)} className="admin-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 39 }} />
      )}

      <div className="admin-conteudo" style={{ flex: 1, marginLeft: 220, minWidth: 0 }}>
        <header style={{
          background: '#fff', borderBottom: '1px solid #e7e5e4', padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="admin-menu-toggle"
            style={{ display: 'none', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
            aria-label="Abrir menu"
          >☰</button>
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/pdv" style={{ fontSize: 13, color: 'var(--azul)' }}>← Voltar pro PDV</Link>
            <button onClick={sair} style={{ padding: '6px 14px', fontSize: 13, background: '#fff', color: '#dc2626', border: '1px solid #e7e5e4' }}>Sair</button>
          </div>
        </header>

        <main style={{ padding: 20 }}>{children}</main>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .admin-sidebar { transform: translateX(-100%); transition: transform 0.2s; }
          .admin-conteudo { margin-left: 0 !important; }
          .admin-menu-toggle { display: block !important; }
        }
      `}</style>
    </div>
  );
}
