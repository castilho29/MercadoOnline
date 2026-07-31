'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function EntregadorPage() {
  const [entregador, setEntregador] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState('');
  const router = useRouter();

  async function carregarTudo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: meuRegistro, error: erroEntregador } = await supabase
      .from('entregadores')
      .select('id, status')
      .eq('usuario_id', user.id)
      .single();

    if (erroEntregador) {
      setErro('Você ainda não está cadastrado como entregador. Peça pro mercado te cadastrar em Retaguarda → Entregadores.');
      setCarregando(false);
      return;
    }

    setEntregador(meuRegistro);

    const { data: pedidos, error: erroPedidos } = await supabase
      .from('pedidos')
      .select(`
        id, status, total, criado_em, forma_pagamento, troco_para,
        itens_pedido(id, quantidade, produtos(nome)),
        enderecos(rua, numero, bairro, cidade, cep)
      `)
      .eq('entregador_id', meuRegistro.id)
      .eq('status', 'a_caminho')
      .order('criado_em');

    if (erroPedidos) setErro(erroPedidos.message);
    else setEntregas(pedidos || []);

    setCarregando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/entregador/login'); return; }
      carregarTudo();
    });

    const canal = supabase
      .channel('entregas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => carregarTudo())
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, []);

  function mostrarToast(texto) {
    setToast(texto);
    setTimeout(() => setToast(''), 2500);
  }

  async function marcarEntregue(pedidoId) {
    const { error } = await supabase.from('pedidos').update({ status: 'entregue' }).eq('id', pedidoId);
    if (error) { setErro(error.message); return; }
    mostrarToast('Entrega confirmada!');
  }

  async function alternarDisponibilidade() {
    const novoStatus = entregador.status === 'disponivel' ? 'offline' : 'disponivel';
    const { error } = await supabase.from('entregadores').update({ status: novoStatus }).eq('id', entregador.id);
    if (error) { setErro(error.message); return; }
    setEntregador({ ...entregador, status: novoStatus });
  }

  function abrirNoMapa(endereco) {
    const q = encodeURIComponent(`${endereco.rua}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  if (carregando) return <p style={{ padding: 24, fontSize: 16 }}>Carregando...</p>;

  if (erro && !entregador) {
    return <div className="card" style={{ maxWidth: 420, margin: '80px auto', padding: 24, textAlign: 'center', color: 'var(--vermelho)' }}>{erro}</div>;
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      {toast && <div className="toast">✓ {toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Minhas entregas</h1>
        <button
          onClick={alternarDisponibilidade}
          style={{
            padding: '8px 16px', fontSize: 13,
            background: entregador.status === 'disponivel' ? 'var(--verde)' : 'var(--texto-suave)',
          }}
        >
          {entregador.status === 'disponivel' ? '🟢 Disponível' : '⚪ Offline'}
        </button>
      </div>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14, marginBottom: 12 }}>{erro}</p>}

      {entregas.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--texto-suave)' }}>
          Nenhuma entrega atribuída no momento.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {entregas.map((p) => (
          <div key={p.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Pedido #{p.id.slice(0, 8)}</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>R$ {Number(p.total).toFixed(2)}</span>
            </div>

            <div
              className="card"
              style={{
                padding: 10, marginBottom: 10,
                background: p.forma_pagamento === 'dinheiro' ? 'var(--amarelo-claro)' : '#fafaf9',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {p.forma_pagamento === 'dinheiro' ? '💵 Receber em dinheiro' : p.forma_pagamento === 'cartao' ? '💳 Já pago no cartão' : '🔑 Já pago no Pix'}
              </div>
              {p.forma_pagamento === 'dinheiro' && p.troco_para && (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Cliente paga com <strong>R$ {Number(p.troco_para).toFixed(2)}</strong> — leve troco de{' '}
                  <strong style={{ color: 'var(--vermelho)' }}>R$ {(Number(p.troco_para) - Number(p.total)).toFixed(2)}</strong>
                </div>
              )}
              {p.forma_pagamento === 'dinheiro' && !p.troco_para && (
                <div style={{ fontSize: 13, marginTop: 4 }}>Cliente não precisa de troco</div>
              )}
            </div>

            {p.enderecos && (
              <div
                onClick={() => abrirNoMapa(p.enderecos)}
                style={{ fontSize: 14, color: 'var(--azul)', marginBottom: 10, cursor: 'pointer', textDecoration: 'underline' }}
              >
                📍 {p.enderecos.rua}, {p.enderecos.numero} — {p.enderecos.bairro}, {p.enderecos.cidade}
                <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Toque pra abrir no mapa</div>
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 12 }}>
              {p.itens_pedido.length} item(ns): {p.itens_pedido.map((i) => `${i.quantidade}x ${i.produtos?.nome}`).join(', ')}
            </div>

            <button onClick={() => marcarEntregue(p.id)} style={{ width: '100%', padding: 14, background: 'var(--verde)' }}>
              Confirmar entrega
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
