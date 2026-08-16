'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const statusLabel = { pendente: 'Pendente', processando: 'Processando', autorizada: 'Autorizada', rejeitada: 'Rejeitada', cancelada: 'Cancelada', contingencia: 'Contingência' };
const statusCor = { pendente: '#d97706', processando: '#2563eb', autorizada: '#16a34a', rejeitada: '#dc2626', cancelada: '#78716c', contingencia: '#ea580c' };

export default function NotasFiscaisPage() {
  const [notas, setNotas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const { data } = await supabase
      .from('notas_fiscais')
      .select('id, tipo, status, chave_acesso, numero, motivo_rejeicao, pedido_id, venda_balcao_id, criado_em')
      .order('criado_em', { ascending: false })
      .limit(50);
    setNotas(data || []);
    setCarregando(false);
  }

  if (carregando) return <p style={{ fontSize: 15 }}>Carregando...</p>;

  const notasFiltradas = filtro === 'todas' ? notas : notas.filter((n) => n.status === filtro);
  const filtros = ['todas', 'autorizada', 'pendente', 'processando', 'rejeitada', 'contingencia'];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Notas fiscais</h1>
      <p style={{ fontSize: 13, color: '#78716c', marginBottom: 16 }}>Últimas 50 NFC-e emitidas (balcão e pedidos online).</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: '7px 14px', fontSize: 12,
              background: filtro === f ? '#2563eb' : '#fff',
              color: filtro === f ? '#fff' : '#1c1917',
              border: '1px solid #e7e5e4',
            }}
          >
            {f === 'todas' ? 'Todas' : statusLabel[f]}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {notasFiltradas.length === 0 ? (
          <p style={{ padding: 24, textAlign: 'center', color: '#78716c', fontSize: 14 }}>Nenhuma nota nesse filtro.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Origem', 'Status', 'Chave de acesso', 'Data', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#78716c', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #e7e5e4' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.map((n) => (
                <tr key={n.id}>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #f0f0ef' }}>
                    {n.venda_balcao_id ? `🛒 Balcão #${n.venda_balcao_id.slice(0, 8)}` : `🔔 Pedido #${n.pedido_id?.slice(0, 8)}`}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0ef' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: statusCor[n.status], background: `${statusCor[n.status]}1a`, padding: '3px 10px', borderRadius: 999 }}>
                      {statusLabel[n.status] || n.status}
                    </span>
                    {n.status === 'rejeitada' && n.motivo_rejeicao && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{n.motivo_rejeicao}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#78716c', borderBottom: '1px solid #f0f0ef', fontFamily: 'monospace' }}>
                    {n.chave_acesso ? `...${n.chave_acesso.slice(-10)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#78716c', borderBottom: '1px solid #f0f0ef' }}>
                    {new Date(n.criado_em).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0ef' }} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
