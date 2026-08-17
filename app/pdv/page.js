'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const ETAPAS = [
  { status: 'recebido', numero: 1, label: 'Novo pedido', icone: '🔔' },
  { status: 'separando', numero: 2, label: 'Separando', icone: '📦' },
  { status: 'a_caminho', numero: 3, label: 'A caminho', icone: '🛵' },
  { status: 'entregue', numero: 4, label: 'Entregue', icone: '✅' },
];

const proximoStatus = { recebido: 'separando', separando: 'a_caminho', a_caminho: 'entregue' };

// Cada etapa explica em uma frase curta o que o operador precisa fazer
// agora, e o que vai acontecer quando ele apertar o botão.
const instrucao = {
  recebido: { titulo: 'Confira os itens do pedido', explicacao: 'Confere se o mercado tem tudo em estoque. Quando estiver tudo certo, aperta o botão pra começar a separar.', botao: 'Começar a separar' },
  separando: { titulo: 'Separe os produtos', explicacao: 'Junta os itens da lista abaixo. Quando terminar de embalar, aperta o botão pra escolher quem vai entregar.', botao: 'Escolher entregador' },
  a_caminho: { titulo: 'Pedido a caminho', explicacao: 'O entregador já está com o pedido. Quando ele confirmar que entregou, aperta o botão pra fechar.', botao: 'Marcar como entregue' },
};

export default function PdvPage() {
  const [pedidos, setPedidos] = useState([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState('');
  const [modalEntregador, setModalEntregador] = useState(false);
  const [entregadoresDisponiveis, setEntregadoresDisponiveis] = useState([]);
  const [online, setOnline] = useState(true);
  const router = useRouter();
  const idsConhecidosRef = useRef(new Set());

  async function carregarPedidos(tocarSomSeNovo) {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, status, total, criado_em, entregador_id, forma_pagamento, troco_para,
        itens_pedido(id, quantidade, preco_unitario, produtos(nome)),
        enderecos(rua, numero, bairro, cidade)
      `)
      .in('status', ['recebido', 'separando', 'a_caminho'])
      .order('criado_em', { ascending: true }); // mais antigo primeiro -- é o próximo a atender

    if (error) { setErro(error.message); setOnline(false); return; }
    setOnline(true);

    if (tocarSomSeNovo) {
      const idsNovos = data.filter((p) => !idsConhecidosRef.current.has(p.id));
      if (idsNovos.length > 0) tocarSomNotificacao();
    }

    idsConhecidosRef.current = new Set(data.map((p) => p.id));
    setPedidos(data || []);
    setIndiceAtual((i) => Math.min(i, Math.max(0, data.length - 1)));
    setCarregando(false);
  }

  function tocarSomNotificacao() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((atraso) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + atraso);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + atraso + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + atraso + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + atraso);
        osc.stop(ctx.currentTime + atraso + 0.16);
      });
    } catch {}
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregarPedidos();
    });
    const canal = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => carregarPedidos(true))
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []);

  function mostrarToast(texto) {
    setToast(texto);
    setTimeout(() => setToast(''), 2500);
  }

  async function abrirSelecaoEntregador() {
    const { data, error } = await supabase.from('entregadores').select('id, perfis(nome), veiculos(tipo, placa)').eq('status', 'disponivel');
    if (error) { setErro(error.message); return; }
    if (!data || data.length === 0) {
      alert('Nenhum entregador disponível agora. Cadastre ou libere um em Retaguarda → Entregadores.');
      return;
    }
    setEntregadoresDisponiveis(data);
    setModalEntregador(true);
  }

  async function confirmarEntregador(entregadorId) {
    const pedido = pedidos[indiceAtual];
    setModalEntregador(false);
    const { error } = await supabase.from('pedidos').update({ status: 'a_caminho', entregador_id: entregadorId }).eq('id', pedido.id);
    if (error) { setErro(error.message); return; }
    mostrarToast('Entregador escolhido! Pedido a caminho.');
  }

  async function avancar() {
    const pedido = pedidos[indiceAtual];
    const novoStatus = proximoStatus[pedido.status];
    if (!novoStatus) return;

    if (pedido.status === 'separando') { abrirSelecaoEntregador(); return; }

    const { error } = await supabase.from('pedidos').update({ status: novoStatus }).eq('id', pedido.id);
    if (error) { setErro(error.message); return; }
    mostrarToast(novoStatus === 'entregue' ? 'Pedido concluído! 🎉' : 'Avançou pra próxima etapa.');
  }

  async function cancelarPedido() {
    const pedido = pedidos[indiceAtual];
    if (!confirm('Tem certeza que quer cancelar este pedido?')) return;
    const { error } = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedido.id);
    if (error) { setErro(error.message); return; }
    mostrarToast('Pedido cancelado.');
  }

  if (carregando) return <p style={{ padding: 24, fontSize: 16 }}>Carregando pedidos...</p>;

  const pedido = pedidos[indiceAtual];
  const etapaAtual = ETAPAS.find((e) => e.status === pedido?.status);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      {toast && <div className="toast">✓ {toast}</div>}

      {modalEntregador && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ padding: 24, width: 360 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Quem vai entregar?</h3>
            <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 12 }}>Escolhe um entregador disponível na lista abaixo.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {entregadoresDisponiveis.map((e) => (
                <button key={e.id} onClick={() => confirmarEntregador(e.id)} style={{ textAlign: 'left', background: '#fff', color: '#1c1917', border: '1.5px solid #e7e5e4', padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{e.perfis?.nome}</div>
                  <div style={{ fontSize: 12, color: '#78716c' }}>{e.veiculos?.tipo} · {e.veiculos?.placa}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setModalEntregador(false)} style={{ width: '100%', background: '#78716c' }}>Cancelar</button>
          </div>
        </div>
      )}

      <header style={{ background: '#111827', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>MERCADO<span style={{ color: '#60a5fa' }}>PDV</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: '#d1d5db' }}>
          <Link href="/pdv/balcao" className="header-link" style={{ color: '#93c5fd', fontSize: 13 }}>🛒 Venda balcão</Link>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: online ? '#16a34a' : '#dc2626' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: online ? '#16a34a' : '#dc2626' }} />
            {online ? 'Online' : 'Offline'}
          </span>
          <Link href="/admin" className="header-link" style={{ color: '#d1d5db', fontSize: 18 }}>⚙️</Link>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
        {erro && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{erro}</p>}

        {pedidos.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Nenhum pedido pendente</p>
            <p style={{ fontSize: 14, color: '#78716c' }}>Assim que um cliente comprar, o pedido aparece aqui sozinho — com som de aviso.</p>
          </div>
        ) : (
          <>
            {/* Navegação entre pedidos, se tiver mais de um esperando */}
            {pedidos.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button
                  onClick={() => setIndiceAtual((i) => Math.max(0, i - 1))}
                  disabled={indiceAtual === 0}
                  style={{ padding: '8px 14px', fontSize: 13, background: '#fff', border: '1px solid #e7e5e4', color: '#1c1917' }}
                >← Anterior</button>
                <span style={{ fontSize: 13, color: '#78716c', fontWeight: 600 }}>Pedido {indiceAtual + 1} de {pedidos.length}</span>
                <button
                  onClick={() => setIndiceAtual((i) => Math.min(pedidos.length - 1, i + 1))}
                  disabled={indiceAtual === pedidos.length - 1}
                  style={{ padding: '8px 14px', fontSize: 13, background: '#fff', border: '1px solid #e7e5e4', color: '#1c1917' }}
                >Próximo →</button>
              </div>
            )}

            {/* Trilha de progresso com 4 passos numerados */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              {ETAPAS.map((e, i) => (
                <div key={e.status} style={{ display: 'flex', alignItems: 'center', flex: i < ETAPAS.length - 1 ? 1 : 'none' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, flexShrink: 0,
                    background: etapaAtual.numero >= e.numero ? '#2563eb' : '#e7e5e4',
                    color: etapaAtual.numero >= e.numero ? '#fff' : '#78716c',
                  }}>
                    {etapaAtual.numero > e.numero ? '✓' : e.numero}
                  </div>
                  {i < ETAPAS.length - 1 && <div style={{ flex: 1, height: 3, background: etapaAtual.numero > e.numero ? '#2563eb' : '#e7e5e4', margin: '0 4px' }} />}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              {ETAPAS.map((e) => (
                <span key={e.status} style={{ fontSize: 11, color: etapaAtual.status === e.status ? '#2563eb' : '#a8a29e', fontWeight: etapaAtual.status === e.status ? 700 : 400, width: 36, textAlign: 'center' }}>
                  {e.label}
                </span>
              ))}
            </div>

            {/* Instrução clara do que fazer agora */}
            <div className="card" style={{ padding: 20, marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{etapaAtual.icone} {instrucao[pedido.status].titulo}</p>
              <p style={{ fontSize: 14, color: '#3b3b38', margin: 0 }}>{instrucao[pedido.status].explicacao}</p>
            </div>

            {/* Detalhe do pedido */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e5e4' }}>
                <strong style={{ fontSize: 16 }}>Pedido #{pedido.id.slice(0, 8)}</strong>
              </div>

              {pedido.enderecos && (
                <div style={{ padding: '10px 18px', fontSize: 13, color: '#78716c', borderBottom: '1px solid #f0f0ef' }}>
                  📍 {pedido.enderecos.rua}, {pedido.enderecos.numero} — {pedido.enderecos.bairro} · {pedido.enderecos.cidade}
                </div>
              )}

              <div style={{ padding: '10px 18px', fontSize: 13, borderBottom: '1px solid #f0f0ef', display: 'flex', justifyContent: 'space-between', background: '#fafaf9' }}>
                <span>{pedido.forma_pagamento === 'dinheiro' ? '💵 Dinheiro' : pedido.forma_pagamento === 'cartao' ? '💳 Cartão' : '🔑 Pix'}</span>
                {pedido.forma_pagamento === 'dinheiro' && pedido.troco_para && (
                  <strong>Troco: R$ {(Number(pedido.troco_para) - Number(pedido.total)).toFixed(2)}</strong>
                )}
              </div>

              {pedido.itens_pedido.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', fontSize: 15, borderBottom: '1px solid #f0f0ef' }}>
                  <span>{item.quantidade}x {item.produtos?.nome || 'Produto'}</span>
                  <span style={{ color: '#78716c' }}>R$ {(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', fontWeight: 800, fontSize: 18 }}>
                <span>Total</span><span style={{ color: '#16a34a' }}>R$ {Number(pedido.total).toFixed(2)}</span>
              </div>
            </div>

            <button onClick={avancar} style={{ width: '100%', padding: 20, fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
              ✅ {instrucao[pedido.status].botao}
            </button>

            <button onClick={cancelarPedido} style={{ width: '100%', padding: 12, fontSize: 13, background: '#fff', color: '#dc2626', border: '1.5px solid #e7e5e4' }}>
              Cancelar este pedido
            </button>
          </>
        )}
      </div>
    </div>
  );
}
