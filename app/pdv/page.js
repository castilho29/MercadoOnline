'use client';

import Link from 'next/link';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const statusLabel = { recebido: 'Novo pedido', separando: 'Separando', a_caminho: 'A caminho', entregue: 'Entregue', cancelado: 'Cancelado' };
const statusIcone = { recebido: '🔔', separando: '📦', a_caminho: '🛵', entregue: '✅', cancelado: '❌' };
const proximoStatus = { recebido: 'separando', separando: 'a_caminho', a_caminho: 'entregue' };
const acaoLabel = { recebido: 'Confirmar separação', separando: 'Chamar entregador', a_caminho: 'Marcar como entregue' };
const acaoCor = { recebido: 'var(--amarelo)', separando: 'var(--azul)', a_caminho: 'var(--roxo)' };

export default function PdvPage() {
  const [pedidos, setPedidos] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState('');
  const [modalEntregador, setModalEntregador] = useState(false);
  const [entregadoresDisponiveis, setEntregadoresDisponiveis] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('recebido');
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

    if (error) { setErro(error.message); return; }

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
      // Dois "bips" curtos, sem precisar de nenhum arquivo de áudio externo
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
    } catch (e) {
      // Navegador pode bloquear áudio sem interação prévia do usuário --
      // silencioso de propósito, não vale travar o app por causa disso.
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregarPedidos(); // primeira carga -- sem som
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

    const { error } = await supabase
      .from('pedidos')
      .update({ status: 'a_caminho', entregador_id: entregadorId })
      .eq('id', pedido.id);

    if (error) { setErro(error.message); return; }
    mostrarToast('Entregador atribuído — pedido a caminho');
    setAbaAtiva('a_caminho');
  }

  async function avancarStatus(pedido) {
    const novoStatus = proximoStatus[pedido.status];
    if (!novoStatus) return;

    // Chamar entregador precisa de uma escolha antes de avançar
    if (pedido.status === 'separando') {
      abrirSelecaoEntregador();
      return;
    }

    const { error } = await supabase.from('pedidos').update({ status: novoStatus }).eq('id', pedido.id);
    if (error) { setErro(error.message); return; }
    mostrarToast(`Pedido atualizado: ${statusLabel[novoStatus]}`);
    setAbaAtiva(novoStatus);
  }

  if (carregando) return <p style={{ padding: 24, fontSize: 16 }}>Carregando pedidos...</p>;

  const selecionado = pedidos.find((p) => p.id === selecionadoId);
  const pedidosAtivos = pedidos.filter((p) => p.status !== 'entregue' && p.status !== 'cancelado');

  const abas = [
    { id: 'recebido', label: 'Recebidos' },
    { id: 'separando', label: 'Separando' },
    { id: 'a_caminho', label: 'A caminho' },
  ];
  const contagemPorStatus = (status) => pedidosAtivos.filter((p) => p.status === status).length;
  const pedidosDaAba = pedidosAtivos.filter((p) => p.status === abaAtiva);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      {toast && <div className="toast">✓ {toast}</div>}

      {modalEntregador && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: 360 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Escolher entregador</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {entregadoresDisponiveis.map((e) => (
                <button
                  key={e.id}
                  onClick={() => confirmarEntregador(e.id)}
                  style={{ textAlign: 'left', background: '#fff', color: 'var(--texto)', border: '1.5px solid var(--borda)' }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.perfis?.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{e.veiculos?.tipo} · {e.veiculos?.placa}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setModalEntregador(false)} style={{ width: '100%', background: 'var(--texto-suave)' }}>Cancelar</button>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        PDV do mercado <Link href="/admin" style={{ fontSize: 13, fontWeight: 500, color: 'var(--azul)', marginLeft: 12 }}>Retaguarda →</Link>
      </h1>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14, marginBottom: 12 }}>{erro}</p>}

      {pedidosAtivos.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--texto-suave)' }}>
          Nenhum pedido pendente no momento. Assim que um cliente comprar, aparece aqui automaticamente.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {abas.map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            style={{
              padding: '10px 18px', fontSize: 14,
              background: abaAtiva === aba.id ? acaoCor[aba.id] || 'var(--azul)' : '#fff',
              color: abaAtiva === aba.id ? '#fff' : 'var(--texto)',
              border: '1px solid var(--borda)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {statusIcone[aba.id]} {aba.label}
            <span style={{
              background: abaAtiva === aba.id ? 'rgba(255,255,255,0.25)' : 'var(--fundo)',
              borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700,
            }}>
              {contagemPorStatus(aba.id)}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedidosDaAba.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--texto-suave)', padding: '0 4px' }}>Nada nessa aba agora.</p>
          )}
          {pedidosDaAba.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelecionadoId(p.id)}
              className="card"
              style={{
                cursor: 'pointer',
                padding: 16,
                borderWidth: p.id === selecionadoId ? 2 : 1,
                borderColor: p.id === selecionadoId ? 'var(--azul)' : 'var(--borda)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>#{p.id.slice(0, 8)}</span>
                <span style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
                  {new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                <span className={`badge badge-${p.status}`}>{statusLabel[p.status] || p.status}</span>
              </div>
            </div>
          ))}
        </div>

        {selecionado && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>Pedido #{selecionado.id.slice(0, 8)}</span>
              <span className={`badge badge-${selecionado.status}`}>{statusLabel[selecionado.status] || selecionado.status}</span>
            </div>

            {selecionado.enderecos && (
              <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 8 }}>
                📍 {selecionado.enderecos.rua}, {selecionado.enderecos.numero} — {selecionado.enderecos.bairro} · {selecionado.enderecos.cidade}
              </p>
            )}

            <div className="card" style={{ padding: 10, marginBottom: 16, background: '#fafaf9', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>
                {selecionado.forma_pagamento === 'dinheiro' ? '💵 Dinheiro' : selecionado.forma_pagamento === 'cartao' ? '💳 Cartão' : '🔑 Pix'}
              </span>
              {selecionado.forma_pagamento === 'dinheiro' && selecionado.troco_para && (
                <span style={{ fontWeight: 700 }}>
                  Troco pra R$ {Number(selecionado.troco_para).toFixed(2)} (levar R$ {(Number(selecionado.troco_para) - Number(selecionado.total)).toFixed(2)})
                </span>
              )}
            </div>

            <table style={{ width: '100%', borderTop: '1px solid var(--borda)', borderBottom: '1px solid var(--borda)', marginBottom: 16 }}>
              <tbody>
                {selecionado.itens_pedido.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '10px 0', fontSize: 15 }}>{item.quantidade}x {item.produtos?.nome || 'Produto'}</td>
                    <td style={{ padding: '10px 0', fontSize: 15, textAlign: 'right', color: 'var(--texto-suave)' }}>
                      R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 15, color: 'var(--texto-suave)' }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>R$ {Number(selecionado.total).toFixed(2)}</span>
            </div>

            {proximoStatus[selecionado.status] ? (
              <button
                onClick={() => avancarStatus(selecionado)}
                style={{ width: '100%', padding: 18, fontSize: 17, background: acaoCor[selecionado.status] }}
              >
                {acaoLabel[selecionado.status]}
              </button>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--texto-suave)', fontSize: 14 }}>Pedido finalizado</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
