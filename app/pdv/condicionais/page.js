'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import PedidosNotifier from '../../PedidosNotifier';

export default function CondicionaisPage() {
  const [vendas, setVendas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);
  const [toast, setToast] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregar();
    });
  }, []);

  async function carregar() {
    const { data } = await supabase
      .from('vendas_balcao')
      .select('id, total, forma_pagamento, criado_em, itens_venda_balcao(id, quantidade, preco_unitario, produtos(nome))')
      .eq('tipo_venda', 'condicional')
      .eq('status_condicional', 'pendente')
      .order('criado_em', { ascending: true });
    setVendas(data || []);
    setCarregando(false);
  }

  function mostrarToast(texto) {
    setToast(texto);
    setTimeout(() => setToast(''), 3000);
  }

  async function clienteFicouComTudo(venda) {
    setProcessandoId(venda.id);

    // 1) Acerta a condicional -- vira venda de verdade, lança no caixa
    const { error: erroAcerto } = await supabase.rpc('acertar_venda_condicional', { p_venda_id: venda.id });
    if (erroAcerto) { mostrarToast('Erro ao acertar: ' + erroAcerto.message); setProcessandoId(null); return; }

    // 2) Só agora emite a nota fiscal -- é o momento certo, porque
    // só agora a venda de fato aconteceu
    try {
      const resposta = await fetch(`${process.env.NEXT_PUBLIC_MICROSSERVICO_URL}/emitir-nfce.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Microservico-Token': process.env.NEXT_PUBLIC_MICROSSERVICO_TOKEN },
        body: JSON.stringify({ venda_balcao_id: venda.id }),
      });
      const dados = await resposta.json();

      if (dados.status === 'autorizada') {
        mostrarToast(`Condicional acertada! NFC-e autorizada.`);
      } else {
        mostrarToast('Condicional acertada, mas a nota não saiu — confere na Retaguarda.');
      }
    } catch {
      mostrarToast('Condicional acertada, mas não consegui falar com o emissor fiscal agora.');
    }

    setProcessandoId(null);
    carregar();
  }

  async function clienteDevolveuTudo(venda) {
    if (!confirm('Confirma que o cliente devolveu todos os itens? Isso estorna o estoque.')) return;
    setProcessandoId(venda.id);

    const { error } = await supabase.rpc('devolver_venda_condicional', { p_venda_id: venda.id });
    if (error) { mostrarToast('Erro: ' + error.message); setProcessandoId(null); return; }

    mostrarToast('Devolução registrada, estoque estornado.');
    setProcessandoId(null);
    carregar();
  }

  if (carregando) return <p style={{ padding: 24 }}>Carregando...</p>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      <PedidosNotifier />
      {toast && <div className="toast">✓ {toast}</div>}

      <header style={{ background: '#111827', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>MERCADO<span style={{ color: '#60a5fa' }}>PDV</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: '#d1d5db' }}>
          <span>📝 Condicionais pendentes</span>
          <Link href="/pdv/balcao" className="header-link" style={{ color: '#93c5fd', fontSize: 13 }}>🛒 Venda balcão</Link>
          <Link href="/pdv" className="header-link" style={{ color: '#93c5fd', fontSize: 13 }}>🔔 Pedidos online</Link>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 20 }}>
        <p style={{ fontSize: 13, color: '#78716c', marginBottom: 16 }}>
          Vendas condicionais aguardando o cliente decidir. Quando ele voltar, escolhe uma das opções —
          se ele ficar com o item, a nota fiscal é emitida na hora.
        </p>

        {vendas.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: '#78716c' }}>
            Nenhuma condicional pendente no momento.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {vendas.map((v) => (
            <div key={v.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>#{v.id.slice(0, 8)}</strong>
                <span style={{ fontSize: 12, color: '#78716c' }}>{new Date(v.criado_em).toLocaleString('pt-BR')}</span>
              </div>

              <div style={{ fontSize: 13, color: '#3b3b38', marginBottom: 10 }}>
                {v.itens_venda_balcao.map((i) => `${i.quantidade}x ${i.produtos?.nome}`).join(', ')}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#78716c' }}>
                  {v.forma_pagamento === 'dinheiro' ? '💵' : v.forma_pagamento === 'cartao' ? '💳' : '🔑'} {v.forma_pagamento}
                </span>
                <strong style={{ fontSize: 18 }}>R$ {Number(v.total).toFixed(2)}</strong>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => clienteDevolveuTudo(v)}
                  disabled={processandoId === v.id}
                  style={{ flex: 1, background: '#fff', color: '#dc2626', border: '1.5px solid #e7e5e4', padding: 12, fontSize: 13 }}
                >
                  ↩️ Cliente devolveu
                </button>
                <button
                  onClick={() => clienteFicouComTudo(v)}
                  disabled={processandoId === v.id}
                  style={{ flex: 1, background: '#16a34a', padding: 12, fontSize: 13, fontWeight: 700 }}
                >
                  {processandoId === v.id ? 'Processando...' : '✅ Cliente comprou'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
