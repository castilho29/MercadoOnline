'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const ETAPAS = [
  { id: 1, label: 'Carrinho', icone: '🛒' },
  { id: 2, label: 'Entrega', icone: '📍' },
  { id: 3, label: 'Pagamento', icone: '💳' },
  { id: 4, label: 'Revisão', icone: '✅' },
];

export default function LojaPage() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carrinho, setCarrinho] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(null);

  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [etapa, setEtapa] = useState(1);

  const [enderecoSalvo, setEnderecoSalvo] = useState(null);
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [endereco, setEndereco] = useState({ rua: '', numero: '', bairro: '', cidade: '', estado: 'PA', cep: '', latitude: null, longitude: null });
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);

  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [valorPagoEmDinheiro, setValorPagoEmDinheiro] = useState('');
  const [naoPrecisaTroco, setNaoPrecisaTroco] = useState(false);

  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/loja/login'); return; }
      carregarProdutos();
      carregarEnderecoSalvo();
    });
  }, []);

  async function carregarProdutos() {
    const [{ data: prods, error }, { data: cats }] = await Promise.all([
      supabase.from('produtos').select('id, nome, preco, foto_url, estoque, categoria_id').eq('ativo', true).order('nome'),
      supabase.from('categorias').select('*').order('nome'),
    ]);
    if (error) setErro(error.message);
    else setProdutos(prods || []);
    setCategorias(cats || []);
    setCarregando(false);
  }

  async function carregarEnderecoSalvo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('enderecos').select('*').eq('usuario_id', user.id).order('criado_em', { ascending: false }).limit(1);
    if (data && data.length > 0) { setEnderecoSalvo(data[0]); setEndereco(data[0]); }
    else setEditandoEndereco(true);
  }

  function usarLocalizacaoAtual() {
    if (!navigator.geolocation) return;
    setBuscandoLocalizacao(true);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setEndereco((atual) => ({ ...atual, latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }));
        setBuscandoLocalizacao(false);
      },
      () => setBuscandoLocalizacao(false),
      { timeout: 8000 }
    );
  }

  function alterarQuantidade(produtoId, delta) {
    setCarrinho((atual) => {
      const nova = Math.max(0, (atual[produtoId] || 0) + delta);
      const copia = { ...atual, [produtoId]: nova };
      if (nova === 0) delete copia[produtoId];
      return copia;
    });
  }

  const itensCarrinho = Object.entries(carrinho).map(([produtoId, quantidade]) => ({
    produto: produtos.find((p) => p.id === produtoId), quantidade,
  })).filter((i) => i.produto);
  const total = itensCarrinho.reduce((soma, i) => soma + (i.produto?.preco || 0) * i.quantidade, 0);
  const troco = formaPagamento === 'dinheiro' && valorPagoEmDinheiro ? Math.max(0, parseFloat(valorPagoEmDinheiro) - total) : 0;
  const valorInsuficiente = formaPagamento === 'dinheiro' && !naoPrecisaTroco && valorPagoEmDinheiro !== '' && parseFloat(valorPagoEmDinheiro) < total;

  function abrirCheckout() { setEtapa(1); setCheckoutAberto(true); }

  function podeAvancar() {
    if (etapa === 1) return itensCarrinho.length > 0;
    if (etapa === 2) return endereco.rua && endereco.numero && endereco.cidade && endereco.cep;
    if (etapa === 3) return !valorInsuficiente && (formaPagamento !== 'dinheiro' || naoPrecisaTroco || valorPagoEmDinheiro !== '');
    return true;
  }

  async function finalizarPedido() {
    setErro(''); setEnviando(true);
    const { data: { user } } = await supabase.auth.getUser();

    let enderecoId = enderecoSalvo?.id;
    if (editandoEndereco || !enderecoId) {
      const { data: enderecoCriado, error: erroEndereco } = await supabase
        .from('enderecos').insert({ usuario_id: user.id, ...endereco, id: undefined, criado_em: undefined }).select().single();
      if (erroEndereco) { setErro(erroEndereco.message); setEnviando(false); return; }
      enderecoId = enderecoCriado.id;
      setEnderecoSalvo(enderecoCriado);
    }

    const { data: pedidoCriado, error: erroPedido } = await supabase.from('pedidos').insert({
      cliente_id: user.id,
      endereco_id: enderecoId,
      forma_pagamento: formaPagamento,
      troco_para: formaPagamento === 'dinheiro' && !naoPrecisaTroco ? parseFloat(valorPagoEmDinheiro) : null,
    }).select().single();
    if (erroPedido) { setErro(erroPedido.message); setEnviando(false); return; }

    const itensParaInserir = itensCarrinho.map((i) => ({
      pedido_id: pedidoCriado.id, produto_id: i.produto.id, quantidade: i.quantidade, preco_unitario: i.produto.preco,
    }));
    const { error: erroItens } = await supabase.from('itens_pedido').insert(itensParaInserir);
    setEnviando(false);
    if (erroItens) { setErro(erroItens.message); return; }

    setPedidoConfirmado(pedidoCriado.id);
    setCarrinho({});
    setCheckoutAberto(false);
    setValorPagoEmDinheiro('');
    setNaoPrecisaTroco(false);
  }

  if (carregando) return <p style={{ padding: 24, fontSize: 16 }}>Carregando catálogo...</p>;

  if (pedidoConfirmado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 420, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Pedido enviado!</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: 14, marginBottom: 20 }}>
            Pedido #{pedidoConfirmado.slice(0, 8)} — o mercado já foi avisado.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setPedidoConfirmado(null)}>Fazer outro pedido</button>
            <Link href="/loja/pedidos"><button style={{ background: 'var(--texto-suave)' }}>Meus pedidos</button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20, paddingBottom: itensCarrinho.length > 0 ? 90 : 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Catálogo</h1>
        <Link href="/loja/pedidos" style={{ fontSize: 13, color: 'var(--azul)' }}>Meus pedidos →</Link>
      </div>
      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14 }}>{erro}</p>}

      {categorias.map((cat) => {
        const produtosDaCategoria = produtos.filter((p) => p.categoria_id === cat.id);
        if (produtosDaCategoria.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: 'var(--texto-suave)' }}>{cat.nome}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {produtosDaCategoria.map((p) => (
                <div key={p.id} className="card" style={{ padding: 12 }}>
                  <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                    {p.foto_url && <img src={p.foto_url} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
                  <div style={{ fontSize: 14, color: 'var(--azul)', fontWeight: 700, marginBottom: 8 }}>R$ {Number(p.preco).toFixed(2)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => alterarQuantidade(p.id, -1)} style={{ padding: '5px 12px', fontSize: 16 }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{carrinho[p.id] || 0}</span>
                    <button onClick={() => alterarQuantidade(p.id, 1)} style={{ padding: '5px 12px', fontSize: 16 }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Barra fixa embaixo -- só aparece com item no carrinho */}
      {itensCarrinho.length > 0 && !checkoutAberto && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff',
          borderTop: '1px solid var(--borda)', padding: 14, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -8px 24px rgba(0,0,0,0.08)', zIndex: 30,
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{itensCarrinho.length} item(ns)</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>R$ {total.toFixed(2)}</div>
          </div>
          <button onClick={abrirCheckout} style={{ padding: '14px 22px', fontSize: 15 }}>Fechar pedido →</button>
        </div>
      )}

      {/* ---------- Checkout em etapas ---------- */}
      {checkoutAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ width: 440, maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              {ETAPAS.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', flex: i < ETAPAS.length - 1 ? 1 : 'none' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: etapa >= e.id ? 'var(--azul)' : '#e7e5e4',
                    color: etapa >= e.id ? '#fff' : 'var(--texto-suave)',
                  }}>
                    {etapa > e.id ? '✓' : e.id}
                  </div>
                  {i < ETAPAS.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: etapa > e.id ? 'var(--azul)' : '#e7e5e4', margin: '0 4px' }} />
                  )}
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--texto-suave)', marginBottom: 20 }}>
              {ETAPAS[etapa - 1].icone} {ETAPAS[etapa - 1].label}
            </p>

            {/* Etapa 1: Carrinho */}
            {etapa === 1 && (
              <div>
                {itensCarrinho.map((i) => (
                  <div key={i.produto.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{i.produto.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>R$ {i.produto.preco.toFixed(2)} cada</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => alterarQuantidade(i.produto.id, -1)} style={{ padding: '4px 10px' }}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{i.quantidade}</span>
                      <button onClick={() => alterarQuantidade(i.produto.id, 1)} style={{ padding: '4px 10px' }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--borda)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                  <span>Total</span><span>R$ {total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Etapa 2: Entrega */}
            {etapa === 2 && (
              <div>
                {!editandoEndereco && enderecoSalvo ? (
                  <div className="card" style={{ padding: 12, background: '#fafaf9' }}>
                    <div style={{ fontSize: 14 }}>
                      {enderecoSalvo.rua}, {enderecoSalvo.numero} {enderecoSalvo.bairro && `— ${enderecoSalvo.bairro}`}
                      <br />{enderecoSalvo.cidade}/{enderecoSalvo.estado} · {enderecoSalvo.cep}
                    </div>
                    <button type="button" onClick={() => setEditandoEndereco(true)} style={{ marginTop: 10, padding: '6px 12px', fontSize: 12, background: 'var(--texto-suave)' }}>
                      Trocar endereço
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input placeholder="Rua" value={endereco.rua} onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })} />
                    <input placeholder="Número" value={endereco.numero} onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })} />
                    <input placeholder="Bairro" value={endereco.bairro || ''} onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })} />
                    <input placeholder="Cidade" value={endereco.cidade} onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })} />
                    <input placeholder="CEP" value={endereco.cep} onChange={(e) => setEndereco({ ...endereco, cep: e.target.value })} />
                    <button type="button" onClick={usarLocalizacaoAtual} style={{ fontSize: 12, padding: '8px 10px', background: 'var(--texto-suave)' }}>
                      {buscandoLocalizacao ? 'Buscando...' : endereco.latitude ? '📍 Localização capturada ✓' : '📍 Usar minha localização atual'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Etapa 3: Pagamento */}
            {etapa === 3 && (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {[{ id: 'dinheiro', label: '💵 Dinheiro' }, { id: 'cartao', label: '💳 Cartão' }, { id: 'pix', label: '🔑 Pix' }].map((f) => (
                    <button key={f.id} type="button" onClick={() => setFormaPagamento(f.id)} style={{
                      flex: 1, fontSize: 12, padding: '10px 6px',
                      background: formaPagamento === f.id ? 'var(--azul)' : '#fff',
                      color: formaPagamento === f.id ? '#fff' : 'var(--texto)',
                      border: '1.5px solid var(--borda)',
                    }}>{f.label}</button>
                  ))}
                </div>

                {formaPagamento === 'dinheiro' && (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 8 }}>
                      <input type="checkbox" checked={naoPrecisaTroco} onChange={(e) => setNaoPrecisaTroco(e.target.checked)} style={{ width: 15, height: 15 }} />
                      Não preciso de troco
                    </label>
                    {!naoPrecisaTroco && (
                      <>
                        <input type="number" step="0.01" placeholder="Vou pagar com quanto? (R$)" value={valorPagoEmDinheiro} onChange={(e) => setValorPagoEmDinheiro(e.target.value)} style={{ width: '100%' }} />
                        {valorInsuficiente && <p style={{ fontSize: 12, color: 'var(--vermelho)', margin: '4px 0 0' }}>Esse valor é menor que o total do pedido.</p>}
                        {!valorInsuficiente && valorPagoEmDinheiro !== '' && (
                          <div className="card" style={{ padding: 10, marginTop: 8, background: 'var(--verde-claro)', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>Troco</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--verde)' }}>R$ {troco.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Etapa 4: Revisão */}
            {etapa === 4 && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 700, margin: '0 0 6px' }}>ITENS</p>
                {itensCarrinho.map((i) => (
                  <div key={i.produto.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{i.quantidade}x {i.produto.nome}</span>
                    <span>R$ {(i.quantidade * i.produto.preco).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--borda)', margin: '10px 0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Total</span><span>R$ {total.toFixed(2)}</span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 700, margin: '14px 0 6px' }}>ENTREGA</p>
                <p style={{ fontSize: 13, margin: 0 }}>{endereco.rua}, {endereco.numero} — {endereco.cidade}/{endereco.estado}</p>

                <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 700, margin: '14px 0 6px' }}>PAGAMENTO</p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {formaPagamento === 'dinheiro' ? '💵 Dinheiro' : formaPagamento === 'cartao' ? '💳 Cartão' : '🔑 Pix'}
                  {formaPagamento === 'dinheiro' && !naoPrecisaTroco && valorPagoEmDinheiro && ` — troco de R$ ${troco.toFixed(2)}`}
                </p>
              </div>
            )}

            {/* Navegação */}
            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => etapa === 1 ? setCheckoutAberto(false) : setEtapa(etapa - 1)}
                style={{ flex: 1, background: 'var(--texto-suave)' }}
              >
                {etapa === 1 ? 'Cancelar' : '← Voltar'}
              </button>
              {etapa < 4 ? (
                <button type="button" disabled={!podeAvancar()} onClick={() => setEtapa(etapa + 1)} style={{ flex: 2 }}>
                  Continuar →
                </button>
              ) : (
                <button type="button" disabled={enviando} onClick={finalizarPedido} style={{ flex: 2, background: 'var(--verde)' }}>
                  {enviando ? 'Enviando...' : '✓ Confirmar pedido'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
