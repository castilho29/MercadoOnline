'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const statusLabel = { recebido: 'Recebido', separando: 'Separando', a_caminho: 'A caminho', entregue: 'Entregue', cancelado: 'Cancelado' };

export default function MeusPedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/loja/login'); return; }
      carregar();
    });
  }, []);

  async function carregar() {
    const { data } = await supabase
      .from('pedidos')
      .select('id, status, total, criado_em, itens_pedido(quantidade, preco_unitario, produtos(nome))')
      .order('criado_em', { ascending: false });
    setPedidos(data || []);
    setCarregando(false);
  }

  if (carregando) return <p style={{ padding: 24 }}>Carregando...</p>;

  const totalGasto = pedidos.filter((p) => p.status === 'entregue').reduce((s, p) => s + Number(p.total), 0);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Meus pedidos</h1>
        <Link href="/loja" style={{ fontSize: 13, color: 'var(--azul)' }}>← Catálogo</Link>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, color: 'var(--texto-suave)' }}>Total já comprado</span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>R$ {totalGasto.toFixed(2)}</span>
      </div>

      {pedidos.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--texto-suave)' }}>
          Você ainda não fez nenhum pedido.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pedidos.map((p) => (
          <div key={p.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>#{p.id.slice(0, 8)}</span>
              <span className={`badge badge-${p.status}`}>{statusLabel[p.status] || p.status}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 6 }}>
              {new Date(p.criado_em).toLocaleDateString('pt-BR')} · {p.itens_pedido.length} item(ns)
            </div>
            <div style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
              {p.itens_pedido.map((i) => `${i.quantidade}x ${i.produtos?.nome}`).join(', ')}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, marginTop: 6 }}>R$ {Number(p.total).toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
