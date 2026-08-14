'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const itens = [
  { href: '/admin/produtos', titulo: 'Produtos', descricao: 'Cadastro, foto, estoque com/sem nota', icone: '📦' },
  { href: '/admin/fornecedores', titulo: 'Fornecedores', descricao: 'Cadastro de quem vende pro mercado', icone: '🏭' },
  { href: '/admin/contranota', titulo: 'Contranota', descricao: 'Compra de fornecedor informal (produtor rural etc)', icone: '📝' },
  { href: '/admin/contas-pagar', titulo: 'Contas a pagar', descricao: 'Parcelas pendentes, pagas e atrasadas', icone: '💳' },
  { href: '/admin/importar-compra', titulo: 'Importar XML de compra', descricao: 'Sobe a nota do fornecedor, entra estoque', icone: '📥' },
  { href: '/admin/entregadores', titulo: 'Entregadores', descricao: 'Cadastro de entregadores e veículos', icone: '🛵' },
  { href: '/pdv/condicionais', titulo: 'Condicionais pendentes', descricao: 'Vendas condicionais aguardando o cliente decidir', icone: '⏳' },
];

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login');
    });
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Retaguarda</h1>
        <Link href="/pdv" style={{ fontSize: 14, color: 'var(--azul)' }}>← Voltar pro PDV</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {itens.map((i) => (
          <Link key={i.href} href={i.href} className="card" style={{ padding: 20, textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{i.icone}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{i.titulo}</div>
            <div style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{i.descricao}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
