'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

const formasPagamento = [
  { id: 'dinheiro', tecla: 'F1', nome: 'Dinheiro', icone: '💵', cor: '#16a34a' },
  { id: 'cartao', tecla: 'F2', nome: 'Cartão', icone: '💳', cor: '#2563eb' },
  { id: 'pix', tecla: 'F3', nome: 'Pix', icone: '🔑', cor: '#7c3aed' },
  { id: 'outros', tecla: 'F4', nome: 'Outros', icone: '🎟️', cor: '#ea580c' },
];

export default function BalcaoPage() {
  const [produtos, setProdutos] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [busca, setBusca] = useState('');
  const [formaPagamento, setFormaPagamento] = useState(null);
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [cliente, setCliente] = useState('');
  const [vendaCondicional, setVendaCondicional] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [ultimoProduto, setUltimoProduto] = useState(null);
  const [modalCaixa, setModalCaixa] = useState(null); // 'sangria' | 'suprimento' | 'salvar' | 'rascunhos' | null
  const [valorCaixa, setValorCaixa] = useState('');
  const [descricaoCaixa, setDescricaoCaixa] = useState('');
  const [rascunhos, setRascunhos] = useState([]);
  const [toast, setToast] = useState('');
  const buscaRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregarProdutos();
    });
  }, []);

  async function carregarProdutos() {
    const { data } = await supabase.from('produtos').select('id, nome, preco, codigo_barras, foto_url, estoque').eq('ativo', true).order('nome');
    setProdutos(data || []);
  }

  function mostrarToast(texto) {
    setToast(texto);
    setTimeout(() => setToast(''), 2000);
  }

  function adicionarAoCarrinho(produto) {
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.id === produto.id);
      if (existente) return atual.map((i) => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...atual, { id: produto.id, nome: produto.nome, preco: produto.preco, foto_url: produto.foto_url, quantidade: 1 }];
    });
    setUltimoProduto(produto);
    setTimeout(() => setUltimoProduto(null), 4000);
  }

  function aoBuscarEnter(e) {
    if (e.key !== 'Enter') return;
    const termo = busca.trim();
    if (!termo) return;

    const porCodigo = produtos.find((p) => p.codigo_barras === termo);
    const encontrado = porCodigo || produtos.find((p) => p.nome.toLowerCase().includes(termo.toLowerCase()));

    if (encontrado) adicionarAoCarrinho(encontrado);
    else mostrarToast(`Produto não encontrado: ${termo}`);

    setBusca('');
  }

  function removerItem(id) {
    setCarrinho((atual) => atual.filter((i) => i.id !== id));
  }

  function cancelarUltimoItem() {
    setCarrinho((atual) => atual.slice(0, -1));
  }

  const subtotal = carrinho.reduce((s, i) => s + i.quantidade * i.preco, 0);
  const total = subtotal * (1 - descontoPercentual / 100);

  async function finalizarVenda() {
    if (carrinho.length === 0 || !formaPagamento) return;
    setFinalizando(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: venda, error: erroVenda } = await supabase.from('vendas_balcao').insert({
      operador_id: user.id,
      total,
      forma_pagamento: formaPagamento,
      tipo_venda: vendaCondicional ? 'condicional' : 'normal',
    }).select().single();

    if (erroVenda) { mostrarToast('Erro: ' + erroVenda.message); setFinalizando(false); return; }

    const itens = carrinho.map((i) => ({ venda_id: venda.id, produto_id: i.id, quantidade: i.quantidade, preco_unitario: i.preco }));
    const { error: erroItens } = await supabase.from('itens_venda_balcao').insert(itens);

    setFinalizando(false);

    if (erroItens) { mostrarToast('Erro: ' + erroItens.message); return; }

    mostrarToast(vendaCondicional ? 'Venda condicional registrada!' : 'Venda finalizada!');
    setCarrinho([]);
    setFormaPagamento(null);
    setDescontoPercentual(0);
    setVendaCondicional(false);
    setCliente('');
    carregarProdutos();
    buscaRef.current?.focus();
  }

  async function salvarRascunho() {
    if (carrinho.length === 0) return;
    const { error } = await supabase.from('vendas_rascunho').insert({
      identificacao: cliente || `Venda com ${carrinho.length} item(ns)`,
      itens: carrinho,
    });
    if (error) { mostrarToast('Erro: ' + error.message); return; }
    mostrarToast('Venda salva! Retome em "Vendas salvas".');
    setCarrinho([]);
    setModalCaixa(null);
  }

  async function abrirRascunhos() {
    const { data } = await supabase.from('vendas_rascunho').select('*').order('criado_em', { ascending: false });
    setRascunhos(data || []);
    setModalCaixa('rascunhos');
  }

  async function retomarRascunho(rascunho) {
    setCarrinho(rascunho.itens);
    await supabase.from('vendas_rascunho').delete().eq('id', rascunho.id);
    setModalCaixa(null);
    mostrarToast('Venda retomada.');
  }

  async function registrarMovimentoCaixa() {
    const valor = parseFloat(valorCaixa);
    if (!valor || valor <= 0) return;

    const tipo = modalCaixa === 'sangria' ? 'saida' : 'entrada';
    const { error } = await supabase.from('movimentacoes_caixa').insert({
      tipo, valor, descricao: `${modalCaixa === 'sangria' ? 'Sangria' : 'Suprimento'}: ${descricaoCaixa || 'sem descrição'}`,
    });

    if (error) { mostrarToast('Erro: ' + error.message); return; }
    mostrarToast(modalCaixa === 'sangria' ? 'Sangria registrada.' : 'Suprimento registrado.');
    setValorCaixa('');
    setDescricaoCaixa('');
    setModalCaixa(null);
  }

  // Atalhos de teclado
  useEffect(() => {
    function aoTeclar(e) {
      const teclaPagamento = { F1: 'dinheiro', F2: 'cartao', F3: 'pix', F4: 'outros' };
      if (teclaPagamento[e.key]) { e.preventDefault(); setFormaPagamento(teclaPagamento[e.key]); }
      if (e.key === 'F5') { e.preventDefault(); finalizarVenda(); }
      if (e.key === 'F8') { e.preventDefault(); cancelarUltimoItem(); }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [carrinho, formaPagamento, descontoPercentual, vendaCondicional]);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      {toast && <div className="toast">✓ {toast}</div>}

      <header style={{ background: '#111827', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>MERCADO<span style={{ color: '#60a5fa' }}>PDV</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: '#d1d5db' }}>
          <span>🛒 Venda balcão</span>
          <Link href="/pdv" style={{ color: '#93c5fd', fontSize: 13 }}>🔔 Pedidos online</Link>
          <Link href="/admin" style={{ color: '#d1d5db', fontSize: 18 }}>⚙️</Link>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ background: '#fff', border: '2px solid #2563eb', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '10px 16px', marginBottom: 12 }}>
            <span style={{ marginRight: 8, color: '#a8a29e' }}>🔍</span>
            <input
              ref={buscaRef}
              autoFocus
              placeholder="Passe o código de barras ou digite o produto"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={aoBuscarEnter}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 17, padding: 6 }}
            />
          </div>

          {ultimoProduto && (
            <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
              {ultimoProduto.foto_url
                ? <img src={ultimoProduto.foto_url} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
                : <div style={{ width: 64, height: 64, borderRadius: 8, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📦</div>}
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{ultimoProduto.nome}</div>
                <div style={{ fontSize: 14, color: '#78716c' }}>R$ {ultimoProduto.preco.toFixed(2)} · adicionado ✓</div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['', 'Produto', 'Qtd.', 'Vlr. unit.', 'Total', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: i >= 2 && i <= 4 ? 'right' : 'left', fontSize: 11, color: '#78716c', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #e7e5e4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carrinho.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#a8a29e', fontSize: 14 }}>Nenhum item ainda — bipa ou digita um produto acima.</td></tr>
                )}
                {carrinho.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '8px 14px' }}>
                      {item.foto_url && <img src={item.foto_url} style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }} />}
                    </td>
                    <td style={{ padding: '8px 14px', fontSize: 14 }}>{item.nome.toUpperCase()}</td>
                    <td style={{ padding: '8px 14px', fontSize: 14, textAlign: 'right' }}>{item.quantidade}</td>
                    <td style={{ padding: '8px 14px', fontSize: 14, textAlign: 'right', color: '#78716c' }}>{item.preco.toFixed(2)}</td>
                    <td style={{ padding: '8px 14px', fontSize: 14, textAlign: 'right', fontWeight: 700 }}>{(item.quantidade * item.preco).toFixed(2)}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <button onClick={() => removerItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 16, padding: 4 }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Barra de ações rápidas -- inclui os recursos profissionais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
            <button onClick={() => setCliente(prompt('Nome ou telefone do cliente:', cliente) || cliente)} style={{ background: '#fff', color: '#1c1917', border: '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>👤 Cliente</button>
            <button onClick={() => setDescontoPercentual(parseFloat(prompt('Desconto em %:', descontoPercentual)) || 0)} style={{ background: '#fff', color: '#1c1917', border: '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>🏷️ Desconto</button>
            <button onClick={cancelarUltimoItem} style={{ background: '#fff', color: '#1c1917', border: '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>🗑️ Cancelar item <span style={{ opacity: 0.6 }}>F8</span></button>
            <button onClick={() => setModalCaixa('salvar')} style={{ background: '#fff', color: '#1c1917', border: '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>💾 Salvar venda</button>
            <button onClick={abrirRascunhos} style={{ background: '#fff', color: '#1c1917', border: '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>📂 Vendas salvas</button>
            <button onClick={() => setVendaCondicional(!vendaCondicional)} style={{ background: vendaCondicional ? '#fef3c7' : '#fff', color: '#1c1917', border: vendaCondicional ? '1.5px solid #d97706' : '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>
              {vendaCondicional ? '✓ ' : ''}📝 Condicional
            </button>
            <button onClick={() => setModalCaixa('sangria')} style={{ background: '#fff', color: '#dc2626', border: '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>💸 Sangria</button>
            <button onClick={() => setModalCaixa('suprimento')} style={{ background: '#fff', color: '#16a34a', border: '1px solid #e7e5e4', padding: 12, fontSize: 13 }}>💰 Suprimento</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {vendaCondicional && (
            <div className="card" style={{ padding: 10, background: '#fef3c7', fontSize: 12, textAlign: 'center', fontWeight: 700, color: '#92400e' }}>
              📝 Venda condicional — não entra no caixa até ser acertada
            </div>
          )}
          {cliente && (
            <div className="card" style={{ padding: 10, fontSize: 13 }}>👤 {cliente}</div>
          )}

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }}>Total da compra</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>R$ {total.toFixed(2)}</div>
            {descontoPercentual > 0 && <div style={{ fontSize: 12, color: '#78716c', marginTop: 4 }}>Desconto de {descontoPercentual}% aplicado</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {formasPagamento.map((f) => (
              <div
                key={f.id}
                onClick={() => setFormaPagamento(f.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: formaPagamento === f.id ? `1.5px solid ${f.cor}` : '1.5px solid #e7e5e4',
                  background: formaPagamento === f.id ? '#fafaf9' : '#fff',
                }}
              >
                <span style={{ fontSize: 20 }}>{f.icone}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#78716c', border: '1px solid #e7e5e4', borderRadius: 4, padding: '1px 5px' }}>{f.tecla}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</span>
              </div>
            ))}
          </div>

          <button
            onClick={finalizarVenda}
            disabled={carrinho.length === 0 || !formaPagamento || finalizando}
            style={{ padding: 20, fontSize: 16, fontWeight: 800, background: '#16a34a' }}
          >
            ✅ F5 · {finalizando ? 'Salvando...' : vendaCondicional ? 'Registrar condicional' : 'Finalizar venda'}
          </button>
        </div>
      </div>

      {/* Modais: sangria/suprimento, salvar, retomar */}
      {(modalCaixa === 'sangria' || modalCaixa === 'suprimento') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: 340 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{modalCaixa === 'sangria' ? '💸 Sangria (retirar do caixa)' : '💰 Suprimento (adicionar ao caixa)'}</h3>
            <p style={{ fontSize: 12, color: '#78716c', marginBottom: 12 }}>
              {modalCaixa === 'sangria' ? 'Registra dinheiro retirado do caixa (ex: pra depósito no banco).' : 'Registra dinheiro colocado no caixa (ex: troco reforçado no início do turno).'}
            </p>
            <input type="number" step="0.01" placeholder="Valor (R$)" value={valorCaixa} onChange={(e) => setValorCaixa(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
            <input placeholder="Motivo (opcional)" value={descricaoCaixa} onChange={(e) => setDescricaoCaixa(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalCaixa(null)} style={{ flex: 1, background: '#78716c' }}>Cancelar</button>
              <button onClick={registrarMovimentoCaixa} style={{ flex: 1 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalCaixa === 'salvar' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: 340 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>💾 Salvar venda</h3>
            <p style={{ fontSize: 12, color: '#78716c', marginBottom: 12 }}>Guarda o carrinho atual pra retomar depois, sem perder nada.</p>
            <input placeholder="Nome pra identificar (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalCaixa(null)} style={{ flex: 1, background: '#78716c' }}>Cancelar</button>
              <button onClick={salvarRascunho} style={{ flex: 1 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {modalCaixa === 'rascunhos' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: 380, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📂 Vendas salvas</h3>
            {rascunhos.length === 0 && <p style={{ fontSize: 13, color: '#78716c' }}>Nenhuma venda salva no momento.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {rascunhos.map((r) => (
                <button key={r.id} onClick={() => retomarRascunho(r)} style={{ textAlign: 'left', background: '#fff', color: '#1c1917', border: '1.5px solid #e7e5e4', padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.identificacao}</div>
                  <div style={{ fontSize: 12, color: '#78716c' }}>{r.itens.length} item(ns) · {new Date(r.criado_em).toLocaleString('pt-BR')}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setModalCaixa(null)} style={{ width: '100%', background: '#78716c' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
