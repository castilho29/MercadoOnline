'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const statusLabel = { pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado' };
const statusCor = { pendente: 'var(--amarelo)', pago: 'var(--verde)', atrasado: 'var(--vermelho)', cancelado: 'var(--texto-suave)' };

export default function ContasPagarPage() {
  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('pendente');
  const router = useRouter();

  async function carregar() {
    const { data, error } = await supabase
      .from('contas_pagar')
      .select('id, numero_parcela, valor, vencimento, status, fornecedores(razao_social)')
      .order('vencimento');

    if (error) setErro(error.message);
    else setContas(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregar();
    });
  }, []);

  async function marcarComoPago(conta) {
    const { error } = await supabase
      .from('contas_pagar')
      .update({ status: 'pago', pago_em: new Date().toISOString(), pago_valor: conta.valor })
      .eq('id', conta.id);

    if (error) { setErro(error.message); return; }
    carregar();
  }

  if (carregando) return <p style={{ padding: 24 }}>Carregando...</p>;

  const contasFiltradas = filtro === 'todas' ? contas : contas.filter((c) => c.status === filtro);
  const totalFiltrado = contasFiltradas.reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contas a pagar</h1>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</Link>
      </div>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14 }}>{erro}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['pendente', 'atrasado', 'pago', 'todas'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: '8px 16px', fontSize: 13,
              background: filtro === f ? 'var(--azul)' : '#fff',
              color: filtro === f ? '#fff' : 'var(--texto)',
              border: '1px solid var(--borda)',
            }}
          >
            {f === 'todas' ? 'Todas' : statusLabel[f]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, color: 'var(--texto-suave)' }}>Total {filtro === 'todas' ? '' : statusLabel[filtro].toLowerCase()}</span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>R$ {totalFiltrado.toFixed(2)}</span>
      </div>

      <div className="card">
        {contasFiltradas.length === 0 && (
          <p style={{ padding: 20, color: 'var(--texto-suave)', fontSize: 14 }}>Nenhuma conta nesse filtro.</p>
        )}
        {contasFiltradas.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottom: '1px solid var(--borda)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.fornecedores?.razao_social || 'Fornecedor'}</div>
              <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                Parcela {c.numero_parcela} · vence {new Date(c.vencimento).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="badge" style={{ background: 'transparent', color: statusCor[c.status], border: `1px solid ${statusCor[c.status]}` }}>
                {statusLabel[c.status]}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, minWidth: 90, textAlign: 'right' }}>R$ {Number(c.valor).toFixed(2)}</span>
              {c.status !== 'pago' && (
                <button onClick={() => marcarComoPago(c)} style={{ padding: '8px 14px', fontSize: 13, background: 'var(--verde)' }}>
                  Marcar pago
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
