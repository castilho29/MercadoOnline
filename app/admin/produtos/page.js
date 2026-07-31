'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const vazio = {
  id: null, nome: '', descricao: '', categoria_id: '', preco: '',
  codigo_barras: '', ncm: '', unidade: 'UN', ativo: true, foto_url: '',
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(null); // objeto do produto, ou null = fechado
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ajusteSemNota, setAjusteSemNota] = useState('');
  const router = useRouter();

  async function carregar() {
    const [{ data: prods, error: erroProds }, { data: cats }] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase.from('categorias').select('*').order('nome'),
    ]);
    if (erroProds) setErro(erroProds.message);
    else setProdutos(prods || []);
    setCategorias(cats || []);
    setCarregando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregar();
    });
  }, []);

  function abrirNovo() {
    setEditando({ ...vazio });
    setAjusteSemNota('');
  }

  function abrirEdicao(produto) {
    setEditando({ ...produto });
    setAjusteSemNota('');
  }

  async function uploadFoto(arquivo) {
    setEnviandoFoto(true);
    const nomeArquivo = `${Date.now()}-${arquivo.name}`;
    const { error } = await supabase.storage.from('produtos').upload(nomeArquivo, arquivo);
    setEnviandoFoto(false);

    if (error) { setErro(error.message); return; }

    const { data } = supabase.storage.from('produtos').getPublicUrl(nomeArquivo);
    setEditando((atual) => ({ ...atual, foto_url: data.publicUrl }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');

    const dados = {
      nome: editando.nome,
      descricao: editando.descricao || null,
      categoria_id: editando.categoria_id || null,
      preco: parseFloat(editando.preco),
      codigo_barras: editando.codigo_barras || null,
      ncm: editando.ncm || null,
      unidade: editando.unidade || 'UN',
      ativo: editando.ativo,
      foto_url: editando.foto_url || null,
    };

    let erroSalvar;
    if (editando.id) {
      const { error } = await supabase.from('produtos').update(dados).eq('id', editando.id);
      erroSalvar = error;
    } else {
      const { error } = await supabase.from('produtos').insert(dados);
      erroSalvar = error;
    }

    if (erroSalvar) { setErro(erroSalvar.message); setSalvando(false); return; }

    // Ajuste manual de estoque sem nota, se o operador preencheu algo
    if (editando.id && ajusteSemNota && parseFloat(ajusteSemNota) !== 0) {
      await supabase.rpc('ajustar_estoque_sem_nota', {
        p_produto_id: editando.id,
        p_quantidade: parseFloat(ajusteSemNota),
      });
    }

    setSalvando(false);
    setEditando(null);
    carregar();
  }

  if (carregando) return <p style={{ padding: 24 }}>Carregando...</p>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Produtos</h1>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</Link>
      </div>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14 }}>{erro}</p>}

      <button onClick={abrirNovo} style={{ marginBottom: 16 }}>+ Novo produto</button>

      {produtos.some((p) => !p.ativo) && (
        <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--amarelo-claro)', fontSize: 13 }}>
          Produtos <strong>inativos</strong> (fundo cinza abaixo) geralmente vieram de uma importação de XML
          e estão aguardando você revisar o preço antes de aparecerem na loja.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {produtos.map((p) => (
          <div
            key={p.id}
            onClick={() => abrirEdicao(p)}
            className="card"
            style={{ padding: 12, cursor: 'pointer', opacity: p.ativo ? 1 : 0.6 }}
          >
            <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
              {p.foto_url && <img src={p.foto_url} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
            <div style={{ fontSize: 13, color: 'var(--azul)', fontWeight: 700 }}>R$ {Number(p.preco).toFixed(2)}</div>
            <div style={{ fontSize: 11, color: 'var(--texto-suave)', marginTop: 4 }}>
              estoque: {p.estoque} <span title="com nota">({p.estoque_com_nota} c/nota</span> + <span title="sem nota">{p.estoque_sem_nota} s/nota)</span>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <form onSubmit={salvar} className="card" style={{ padding: 24, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{editando.id ? 'Editar produto' : 'Novo produto'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 14, marginBottom: 12 }}>
              <div
                onClick={() => document.getElementById('input-foto').click()}
                style={{
                  width: 100, height: 100, borderRadius: 10, border: '1.5px dashed var(--borda)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  background: '#f5f5f4', overflow: 'hidden', fontSize: 12, color: 'var(--texto-suave)', textAlign: 'center',
                }}
              >
                {enviandoFoto ? 'Enviando...' : editando.foto_url
                  ? <img src={editando.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '📷 Adicionar foto'}
              </div>
              <input id="input-foto" type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => e.target.files[0] && uploadFoto(e.target.files[0])} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input placeholder="Nome do produto" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} required />
                <select value={editando.categoria_id || ''} onChange={(e) => setEditando({ ...editando, categoria_id: e.target.value })}>
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            <textarea
              placeholder="Descrição (opcional)"
              value={editando.descricao || ''}
              onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
              style={{ width: '100%', minHeight: 60, marginBottom: 12, fontFamily: 'inherit', fontSize: 14, padding: 10, borderRadius: 10, border: '1.5px solid var(--borda)' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Preço de venda (R$)</label>
                <input type="number" step="0.01" value={editando.preco} onChange={(e) => setEditando({ ...editando, preco: e.target.value })} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Unidade</label>
                <select value={editando.unidade} onChange={(e) => setEditando({ ...editando, unidade: e.target.value })} style={{ width: '100%' }}>
                  <option value="UN">UN</option>
                  <option value="KG">KG</option>
                  <option value="CX">CX</option>
                  <option value="PCT">PCT</option>
                  <option value="LT">LT</option>
                </select>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: '0 0 6px', fontWeight: 600 }}>Dados fiscais (vêm da nota, ou preencha na mão)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Código de barras (EAN)</label>
                <input value={editando.codigo_barras || ''} onChange={(e) => setEditando({ ...editando, codigo_barras: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>NCM</label>
                <input value={editando.ncm || ''} onChange={(e) => setEditando({ ...editando, ncm: e.target.value })} style={{ width: '100%' }} />
              </div>
            </div>

            {editando.id && (
              <>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: '0 0 6px', fontWeight: 600 }}>Estoque</p>
                <div className="card" style={{ padding: 12, marginBottom: 12, background: '#fafaf9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Com nota (documentado)</span><strong>{editando.estoque_com_nota}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span>Sem nota</span><strong>{editando.estoque_sem_nota}</strong>
                  </div>
                  <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Ajustar estoque sem nota (+ ou -)</label>
                  <input
                    type="number" placeholder="ex: 10 ou -3"
                    value={ajusteSemNota}
                    onChange={(e) => setAjusteSemNota(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="ativo" checked={editando.ativo} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} style={{ width: 16, height: 16 }} />
              <label htmlFor="ativo" style={{ fontSize: 14 }}>Ativo (visível na loja)</label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setEditando(null)} style={{ flex: 1, background: 'var(--texto-suave)' }}>Cancelar</button>
              <button type="submit" disabled={salvando} style={{ flex: 1 }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
