'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const statusLabel = { recebido: 'Novo pedido', separando: 'Separando', a_caminho: 'A caminho', entregue: 'Entregue', cancelado: 'Cancelado' };
const statusIcone = { recebido: '🔔', separando: '📦', a_caminho: '🛵', entregue: '✅', cancelado: '❌' };
const proximoStatus = { recebido: 'separando', separando: 'a_caminho', a_caminho: 'entregue' };
const acaoLabel = { recebido: 'F1 · Aceitar e separar', separando: 'F1 · Enviar pra entrega', a_caminho: 'F1 · Marcar entregue' };
const acaoCor = { recebido: '#d97706', separando: '#2563eb', a_caminho: '#7c3aed' };

export default function PdvPage() {
  const [pedidos, setPedidos] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState('');
  const [modalEntregador, setModalEntregador] = useState(false);
  const [entregadoresDisponiveis, setEntregadoresDisponiveis] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('recebido');
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
      .order('criado_em', { ascending: false });

    if (error) { setErro(error.message); setOnline(false); return; }
    setOnline(true);

    if (tocarSomSeNovo) {
      const idsNovos = data.filter((p) => !idsConhecidosRef.current.has(p.id));
      if (idsNovos.length > 0) {
        tocarSomNotificacao();
        setAbaAtiva('recebido');
        setSelecionadoId(idsNovos[0].id);
      }
    }

    idsConhecidosRef.current = new Set(data.map((p) => p.id));
    setPedidos(data || []);
    if (!selecionadoId && data && data.length > 0) setSelecionadoId(data[0].id);
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

    const relogio = setInterval(() => setAgora(new Date()), 1000);
    return () => { supabase.removeChannel(canal); clearInterval(relogio); };
  }, []);

  const [agora, setAgora] = useState(new Date());

  function mostrarToast(texto) {
    setToast(texto);
    setTimeout(() => setToast(''), 2500);
  }

  async function abrirSelecaoEntregador() {
    const { data, error } = await supabase
      .from('entregadores')
      .select('id, perfis(nome), veiculos(tipo, placa)')
      .eq('status', 'disponivel');

    if (error) { setErro(error.message); return; }
    if (!data || data.length === 0) {
      alert('Nenhum entregador disponível no momento. Cadastre ou libere um em Retaguarda → Entregadores.');
      return;
    }
    setEntregadoresDisponiveis(data);
    setModalEntregador(true);
  }

  async function confirmarEntregador(entregadorId) {
    const pedido = pedidos.find((p) => p.id === selecionadoId);
    setModalEntregador(false);
    const { error } = await supabase.from('pedidos').update({ status: 'a_caminho', entregador_id: entregadorId }).eq('id', pedido.id);
    if (error) { setErro(error.message); return; }
    mostrarToast('Entregador atribuído — pedido a caminho');
    setAbaAtiva('a_caminho');
  }

  async function avancarStatus(pedido) {
    const novoStatus = proximoStatus[pedido.status];
    if (!novoStatus) return;

    if (pedido.status === 'separando') {
      abrirSelecaoEntregador();
      return;
    }

    const { error } = await supabase.from('pedidos').update({ status: novoStatus }).eq('id', pedido.id);
    if (error) { setErro(error.message); return; }
    mostrarToast(`Pedido atualizado: ${statusLabel[novoStatus]}`);
    setAbaAtiva(novoStatus);
  }

  async function cancelarPedido(pedido) {
    if (!confirm('Cancelar este pedido?')) return;
    const { error } = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedido.id);
    if (error) { setErro(error.message); return; }
    mostrarToast('Pedido cancelado');
  }

  const selecionado = pedidos.find((p) => p.id === selecionadoId);
  const pedidosAtivos = pedidos.filter((p) => p.status !== 'entregue' && p.status !== 'cancelado');
  const abas = [
    { id: 'recebido', label: 'Recebidos' },
    { id: 'separando', label: 'Separando' },
    { id: 'a_caminho', label: 'A caminho' },
  ];
  const contagemPorStatus = (status) => pedidosAtivos.filter((p) => p.status === status).length;
  const pedidosDaAba = pedidosAtivos.filter((p) => p.status === abaAtiva);

  // Atalhos de teclado, igual o PDV físico
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'F1' && selecionado) { e.preventDefault(); avancarStatus(selecionado); }
      if (e.key === 'F8' && selecionado) { e.preventDefault(); cancelarPedido(selecionado); }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [selecionado]);

  if (carregando) return <p style={{ padding: 24, fontSize: 16 }}>Carregando pedidos...</p>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      {toast && <div className="toast">✓ {toast}</div>}

      {modalEntregador && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: 360 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Escolher entregador</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {entregadoresDisponiveis.map((e) => (
                <button key={e.id} onClick={() => confirmarEntregador(e.id)} style={{ textAlign: 'left', background: '#fff', color: '#1c1917', border: '1.5px solid #e7e5e4' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.perfis?.nome}</div>
                  <div style={{ fontSize: 12, color: '#78716c' }}>{e.veiculos?.tipo} · {e.veiculos?.placa}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setModalEntregador(false)} style={{ width: '100%', background: '#78716c' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Cabeçalho escuro, igual o PDV físico */}
      <header style={{ background: '#111827', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>MERCADO<span style={{ color: '#60a5fa' }}>PDV</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 14, color: '#d1d5db' }}>
          <span>🔔 Pedidos online</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: online ? '#16a34a' : '#dc2626' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: online ? '#16a34a' : '#dc2626' }} />
            {online ? 'Online' : 'Offline'}
          </span>
          <span>👤 <strong style={{ color: '#fff' }}>Operador</strong></span>
          <span>{agora.toLocaleDateString('pt-BR')} {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <Link href="/admin" style={{ color: '#d1d5db', fontSize: 18 }}>⚙️</Link>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
        {erro && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{erro}</p>}

        {/* Abas de status, estilo pill */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                padding: '10px 18px', fontSize: 14,
                background: abaAtiva === aba.id ? '#2563eb' : '#fff',
                color: abaAtiva === aba.id ? '#fff' : '#1c1917',
                border: '1px solid #e7e5e4',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {statusIcone[aba.id]} {aba.label}
              <span style={{ background: abaAtiva === aba.id ? 'rgba(255,255,255,0.25)' : '#f5f5f4', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>
                {contagemPorStatus(aba.id)}
              </span>
            </button>
          ))}
        </div>

        {pedidosAtivos.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: '#78716c' }}>
            Nenhum pedido pendente no momento. Assim que um cliente comprar, aparece aqui automaticamente.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Lista de pedidos da aba, estilo tabela */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pedidosDaAba.length === 0 && <p style={{ fontSize: 13, color: '#78716c' }}>Nada nessa aba agora.</p>}
            {pedidosDaAba.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelecionadoId(p.id)}
                className="card"
                style={{ cursor: 'pointer', padding: 14, borderWidth: p.id === selecionadoId ? 2 : 1, borderColor: p.id === selecionadoId ? '#2563eb' : '#e7e5e4' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14 }}>#{p.id.slice(0, 8)}</strong>
                  <span style={{ fontSize: 12, color: '#78716c' }}>{new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>R$ {Number(p.total).toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Detalhe do pedido -- tabela de itens + painel de total, igual PDV físico */}
          {selecionado ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e5e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 16 }}>Pedido #{selecionado.id.slice(0, 8)}</strong>
                  <span className={`badge badge-${selecionado.status}`}>{statusIcone[selecionado.status]} {statusLabel[selecionado.status]}</span>
                </div>

                {selecionado.enderecos && (
                  <div style={{ padding: '10px 18px', fontSize: 13, color: '#78716c', borderBottom: '1px solid #f0f0ef' }}>
                    📍 {selecionado.enderecos.rua}, {selecionado.enderecos.numero} — {selecionado.enderecos.bairro} · {selecionado.enderecos.cidade}
                  </div>
                )}

                <div style={{ padding: '10px 18px', fontSize: 13, borderBottom: '1px solid #f0f0ef', display: 'flex', justifyContent: 'space-between', background: '#fafaf9' }}>
                  <span>{selecionado.forma_pagamento === 'dinheiro' ? '💵 Dinheiro' : selecionado.forma_pagamento === 'cartao' ? '💳 Cartão' : '🔑 Pix'}</span>
                  {selecionado.forma_pagamento === 'dinheiro' && selecionado.troco_para && (
                    <strong>Troco pra R$ {Number(selecionado.troco_para).toFixed(2)} (levar R$ {(Number(selecionado.troco_para) - Number(selecionado.total)).toFixed(2)})</strong>
                  )}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Produto', 'Qtd.', 'Vlr. unit.', 'Total'].map((h) => (
                        <th key={h} style={{ textAlign: h === 'Produto' ? 'left' : 'right', fontSize: 11, color: '#78716c', textTransform: 'uppercase', padding: '10px 18px', borderBottom: '1px solid #e7e5e4' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selecionado.itens_pedido.map((item) => (
                      <tr key={item.id}>
                        <td style={{ padding: '10px 18px', fontSize: 14, borderBottom: '1px solid #f0f0ef' }}>{item.produtos?.nome || 'Produto'}</td>
                        <td style={{ padding: '10px 18px', fontSize: 14, textAlign: 'right', borderBottom: '1px solid #f0f0ef' }}>{item.quantidade}</td>
                        <td style={{ padding: '10px 18px', fontSize: 14, textAlign: 'right', color: '#78716c', borderBottom: '1px solid #f0f0ef' }}>{item.preco_unitario.toFixed(2)}</td>
                        <td style={{ padding: '10px 18px', fontSize: 14, textAlign: 'right', borderBottom: '1px solid #f0f0ef' }}>{(item.quantidade * item.preco_unitario).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }}>Total do pedido</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>R$ {Number(selecionado.total).toFixed(2)}</div>
                </div>

                {proximoStatus[selecionado.status] ? (
                  <button onClick={() => avancarStatus(selecionado)} style={{ padding: 18, fontSize: 15, fontWeight: 800, background: acaoCor[selecionado.status], display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    ✅ {acaoLabel[selecionado.status]}
                  </button>
                ) : (
                  <p style={{ textAlign: 'center', color: '#78716c', fontSize: 13 }}>Pedido finalizado</p>
                )}

                {selecionado.status !== 'entregue' && selecionado.status !== 'cancelado' && (
                  <button onClick={() => cancelarPedido(selecionado)} style={{ padding: 12, fontSize: 13, background: '#fff', color: '#dc2626', border: '1.5px solid #e7e5e4' }}>
                    🗑️ F8 · Cancelar pedido
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: '#78716c' }}>Selecione um pedido.</div>
          )}
        </div>
      </div>
    </div>
  );
}
