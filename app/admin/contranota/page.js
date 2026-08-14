'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

export default function ContranotaPage() {
  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]); // {produto_id, nome, quantidade, valor_unitario}
  const [busca, setBusca] = useState('');
  const [fornecedor, setFornecedor] = useState({ nome: '', cpf: '', telefone: '' });
  const [formaPagamento, setFormaPagamento] = useState('a_vista');
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregarProdutos();
    });
  }, []);

  async function carregarProdutos() {
    const { data } = await supabase.from('produtos').select('id, nome, codigo_barras').order('nome');
    setProdutos(data || []);
  }

  function mostrarToast(texto) {
    setToast(texto);
    setTimeout(() => setToast(''), 3000);
  }

  function adicionarItem(produto) {
    setItens((atual) => {
      if (atual.find((i) => i.produto_id === produto.id)) return atual;
      return [...atual, { produto_id: produto.id, nome: produto.nome, quantidade: 1, valor_unitario: 0 }];
    });
    setBusca('');
  }

  function atualizarItem(produtoId, campo, valor) {
    setItens((atual) => atual.map((i) => i.produto_id === produtoId ? { ...i, [campo]: valor } : i));
  }

  function removerItem(produtoId) {
    setItens((atual) => atual.filter((i) => i.produto_id !== produtoId));
  }

  const total = itens.reduce((s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.valor_unitario) || 0), 0);
  const produtosFiltrados = busca ? produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())) : [];

  async function registrarContranota() {
    if (!fornecedor.nome || !fornecedor.cpf || itens.length === 0) {
      mostrarToast('Preenche o nome, CPF e pelo menos um item.');
      return;
    }
    setSalvando(true);

    // 1) Fornecedor -- procura por CPF, cria se não existir
    let fornecedorId;
    const { data: existente } = await supabase.from('fornecedores').select('id').eq('cpf', fornecedor.cpf).maybeSingle();
    if (existente) {
      fornecedorId = existente.id;
    } else {
      const { data: criado, error: erroFornecedor } = await supabase.from('fornecedores').insert({
        tipo_pessoa: 'fisica',
        cpf: fornecedor.cpf,
        razao_social: fornecedor.nome,
        telefone: fornecedor.telefone || null,
      }).select().single();
      if (erroFornecedor) { mostrarToast('Erro: ' + erroFornecedor.message); setSalvando(false); return; }
      fornecedorId = criado.id;
    }

    // 2) Nota de entrada (contranota -- sem XML, sem chave ainda)
    const { data: nota, error: erroNota } = await supabase.from('notas_entrada').insert({
      fornecedor_id: fornecedorId,
      numero: 0,
      serie: 0,
      origem: 'contranota',
      valor_total: total,
      forma_pagamento: formaPagamento,
      data_emissao: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (erroNota) { mostrarToast('Erro: ' + erroNota.message); setSalvando(false); return; }

    // 3) Itens + baixa documentada de estoque (com nota, via contranota)
    for (const item of itens) {
      await supabase.from('itens_entrada').insert({
        nota_entrada_id: nota.id,
        produto_id: item.produto_id,
        descricao_xml: item.nome,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        vinculado: true,
      });
      await supabase.rpc('incrementar_estoque_com_nota', { p_produto_id: item.produto_id, p_quantidade: item.quantidade });
    }

    // 4) Se for a prazo, gera 1 parcela (contranota geralmente não
    // tem duplicata detalhada como o XML do fornecedor tem)
    if (formaPagamento === 'a_prazo') {
      await supabase.from('contas_pagar').insert({
        fornecedor_id: fornecedorId,
        nota_entrada_id: nota.id,
        numero_parcela: 1,
        valor: total,
        vencimento: new Date().toISOString().slice(0, 10),
        status: 'pendente',
      });
    }

    setSalvando(false);
    mostrarToast('Contranota registrada! Estoque já entrou como documentado.');
    setItens([]);
    setFornecedor({ nome: '', cpf: '', telefone: '' });
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
      {toast && <div className="toast">✓ {toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contranota</h1>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 20 }}>
        Pra quando você compra de alguém que não pode emitir nota (produtor rural, vendedor informal).
        Você documenta a compra — o estoque entra como <strong>com nota</strong>, de verdade, sem gambiarra.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto-suave)', margin: '0 0 8px' }}>QUEM VENDEU</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Nome completo" value={fornecedor.nome} onChange={(e) => setFornecedor({ ...fornecedor, nome: e.target.value })} />
          <input placeholder="CPF" value={fornecedor.cpf} onChange={(e) => setFornecedor({ ...fornecedor, cpf: e.target.value })} />
          <input placeholder="Telefone (opcional)" value={fornecedor.telefone} onChange={(e) => setFornecedor({ ...fornecedor, telefone: e.target.value })} />
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto-suave)', margin: '0 0 8px' }}>O QUE FOI COMPRADO</p>
        <input
          placeholder="Busca o produto pra adicionar..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        {produtosFiltrados.length > 0 && (
          <div style={{ border: '1px solid var(--borda)', borderRadius: 8, marginBottom: 12, maxHeight: 160, overflowY: 'auto' }}>
            {produtosFiltrados.slice(0, 8).map((p) => (
              <div key={p.id} onClick={() => adicionarItem(p)} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #f0f0ef', fontSize: 13 }}>
                {p.nome}
              </div>
            ))}
          </div>
        )}

        {itens.map((item) => (
          <div key={item.produto_id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 24px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>{item.nome}</span>
            <input type="number" step="0.001" value={item.quantidade} onChange={(e) => atualizarItem(item.produto_id, 'quantidade', e.target.value)} placeholder="Qtd" />
            <input type="number" step="0.01" value={item.valor_unitario} onChange={(e) => atualizarItem(item.produto_id, 'valor_unitario', e.target.value)} placeholder="Vlr un." />
            <button onClick={() => removerItem(item.produto_id)} style={{ background: 'none', border: 'none', color: 'var(--vermelho)', padding: 0 }}>✕</button>
          </div>
        ))}

        {itens.length === 0 && <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Nenhum item ainda.</p>}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--texto-suave)' }}>Total</span>
          <strong style={{ fontSize: 20 }}>R$ {total.toFixed(2)}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFormaPagamento('a_vista')}
            style={{ flex: 1, background: formaPagamento === 'a_vista' ? 'var(--azul)' : '#fff', color: formaPagamento === 'a_vista' ? '#fff' : 'var(--texto)', border: '1.5px solid var(--borda)' }}
          >À vista</button>
          <button
            onClick={() => setFormaPagamento('a_prazo')}
            style={{ flex: 1, background: formaPagamento === 'a_prazo' ? 'var(--azul)' : '#fff', color: formaPagamento === 'a_prazo' ? '#fff' : 'var(--texto)', border: '1.5px solid var(--borda)' }}
          >A prazo</button>
        </div>
      </div>

      <button onClick={registrarContranota} disabled={salvando} style={{ width: '100%', padding: 16, fontSize: 15 }}>
        {salvando ? 'Registrando...' : 'Registrar contranota'}
      </button>
    </div>
  );
}
