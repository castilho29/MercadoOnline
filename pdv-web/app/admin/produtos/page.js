'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const vazio = {
  id: null, nome: '', descricao: '', categoria_id: '', preco: '',
  codigo_barras: '', ncm: '', unidade: 'UN', ativo: true,
  cfop: '5102', csosn: '102', origem_mercadoria: 0,
  estoque_inicial_com_nota: '0', estoque_inicial_sem_nota: '0',
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(null);
  const [fotos, setFotos] = useState([null, null, null, null, null]); // 5 posições -- { id?, url } ou null
  const [enviandoFotoIndice, setEnviandoFotoIndice] = useState(null);
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
    setFotos([null, null, null, null, null]);
    setAjusteSemNota('');
  }

  async function abrirEdicao(produto) {
    setEditando({ ...produto, estoque_inicial_com_nota: '0', estoque_inicial_sem_nota: '0' });
    setAjusteSemNota('');

    const { data } = await supabase.from('produto_fotos').select('*').eq('produto_id', produto.id).order('ordem');
    const slots = [null, null, null, null, null];
    (data || []).forEach((foto) => { slots[foto.ordem - 1] = foto; });
    setFotos(slots);
  }

  async function uploadFoto(indice, arquivo) {
    setEnviandoFotoIndice(indice);

    // Supabase Storage rejeita nomes com espaço, acento e caracteres
    // especiais -- "limpa" o nome antes de enviar, mantendo só a
    // extensão original.
    const extensao = arquivo.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;

    const { error } = await supabase.storage.from('produtos').upload(nomeArquivo, arquivo);

    if (error) { setErro(error.message); setEnviandoFotoIndice(null); return; }

    const { data } = supabase.storage.from('produtos').getPublicUrl(nomeArquivo);
    const url = data.publicUrl;

    if (editando.id) {
      // Produto já existe -- salva a foto direto na tabela
      const existente = fotos[indice];
      if (existente?.id) {
        await supabase.from('produto_fotos').update({ url }).eq('id', existente.id);
      } else {
        await supabase.from('produto_fotos').insert({ produto_id: editando.id, url, ordem: indice + 1 });
      }
      const novasFotos = [...fotos];
      novasFotos[indice] = { url, ordem: indice + 1 };
      setFotos(novasFotos);
    } else {
      // Produto novo, ainda sem id -- guarda só na memória até salvar
      const novasFotos = [...fotos];
      novasFotos[indice] = { url, ordem: indice + 1, pendente: true };
      setFotos(novasFotos);
    }

    setEnviandoFotoIndice(null);
  }

  async function removerFoto(indice) {
    const foto = fotos[indice];
    if (foto?.id) {
      await supabase.from('produto_fotos').delete().eq('id', foto.id);
    }
    const novasFotos = [...fotos];
    novasFotos[indice] = null;
    setFotos(novasFotos);
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
      cfop: editando.cfop || '5102',
      csosn: editando.csosn || '102',
      origem_mercadoria: parseInt(editando.origem_mercadoria) || 0,
    };

    let produtoId = editando.id;
    let erroSalvar;

    if (produtoId) {
      const { error } = await supabase.from('produtos').update(dados).eq('id', produtoId);
      erroSalvar = error;
    } else {
      // Produto novo -- já entra com o estoque inicial separado por origem
      const { data: criado, error } = await supabase.from('produtos').insert({
        ...dados,
        estoque_com_nota: parseInt(editando.estoque_inicial_com_nota) || 0,
        estoque_sem_nota: parseInt(editando.estoque_inicial_sem_nota) || 0,
      }).select().single();
      erroSalvar = error;
      if (criado) produtoId = criado.id;
    }

    if (erroSalvar) { setErro(erroSalvar.message); setSalvando(false); return; }

    // Se era produto novo, agora que já tem id, salva as fotos que
    // ficaram esperando na memória
    if (!editando.id && produtoId) {
      for (const foto of fotos) {
        if (foto?.pendente) {
          await supabase.from('produto_fotos').insert({ produto_id: produtoId, url: foto.url, ordem: foto.ordem });
        }
      }
    }

    // Ajuste manual de estoque sem nota, só faz sentido editando produto existente
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
        <a href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</a>
      </div>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14 }}>{erro}</p>}

      <button onClick={abrirNovo} style={{ marginBottom: 16 }}>+ Novo produto</button>

      {produtos.some((p) => !p.ativo) && (
        <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--amarelo-claro)', fontSize: 13 }}>
          Produtos <strong>inativos</strong> (esmaecidos abaixo) geralmente vieram de uma importação de XML
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
              estoque: {p.estoque} ({p.estoque_com_nota} c/nota + {p.estoque_sem_nota} s/nota)
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <form onSubmit={salvar} className="card" style={{ padding: 24, width: 520, maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{editando.id ? 'Editar produto' : 'Novo produto'}</h2>

            <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: '0 0 6px', fontWeight: 600 }}>Fotos (até 5)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
              {fotos.map((foto, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <div
                    onClick={() => document.getElementById(`input-foto-${i}`).click()}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: 8,
                      border: '1.5px dashed var(--borda)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', background: '#f5f5f4', overflow: 'hidden', fontSize: 10, color: 'var(--texto-suave)', textAlign: 'center',
                    }}
                  >
                    {enviandoFotoIndice === i
                      ? '...'
                      : foto
                        ? <img src={foto.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (i === 0 ? '📷 Capa' : `+ ${i + 1}`)}
                  </div>
                  <input id={`input-foto-${i}`} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => e.target.files[0] && uploadFoto(i, e.target.files[0])} />
                  {foto && (
                    <button
                      type="button"
                      onClick={() => removerFoto(i)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, padding: 0, borderRadius: '50%', background: 'var(--vermelho)', fontSize: 11 }}
                    >×</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <input placeholder="Nome do produto" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} required />
              <select value={editando.categoria_id || ''} onChange={(e) => setEditando({ ...editando, categoria_id: e.target.value })}>
                <option value="">Sem categoria</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
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

            <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: '0 0 6px', fontWeight: 600 }}>Dados fiscais</p>
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

            <div className="card" style={{ padding: 12, marginBottom: 12, background: '#fafaf9' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: '0 0 8px' }}>
                Necessário só pra emitir NFC-e — o padrão já cobre a maioria dos casos de revenda no Simples Nacional.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>CFOP</label>
                  <select value={editando.cfop} onChange={(e) => setEditando({ ...editando, cfop: e.target.value })} style={{ width: '100%' }}>
                    <option value="5102">5102 — Venda dentro do estado</option>
                    <option value="6102">6102 — Venda pra outro estado</option>
                    <option value="5405">5405 — Sujeita a ICMS-ST</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Origem</label>
                  <select value={editando.origem_mercadoria} onChange={(e) => setEditando({ ...editando, origem_mercadoria: e.target.value })} style={{ width: '100%' }}>
                    <option value={0}>0 — Nacional</option>
                    <option value={1}>1 — Estrangeira (importação direta)</option>
                    <option value={2}>2 — Estrangeira (mercado interno)</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>CSOSN (Simples Nacional)</label>
                <select value={editando.csosn} onChange={(e) => setEditando({ ...editando, csosn: e.target.value })} style={{ width: '100%' }}>
                  <option value="102">102 — Tributada sem permissão de crédito (mais comum)</option>
                  <option value="101">101 — Tributada com permissão de crédito</option>
                  <option value="103">103 — Isenção (faixa de receita bruta)</option>
                  <option value="300">300 — Imune</option>
                  <option value="400">400 — Não tributada</option>
                  <option value="500">500 — ICMS por substituição tributária</option>
                </select>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: '0 0 6px', fontWeight: 600 }}>
              Estoque {!editando.id && '— separado por origem, desde já'}
            </p>

            {!editando.id ? (
              // Produto NOVO: escolhe já de onde vem cada parte do estoque inicial
              <div className="card" style={{ padding: 12, marginBottom: 12, background: '#fafaf9' }}>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: '0 0 8px' }}>
                  Se veio de uma compra com nota fiscal do fornecedor, entra como "com nota". Se foi comprado
                  informalmente (ex: produtor local, hortifruti sem nota), entra como "sem nota".
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Quantidade COM nota</label>
                    <input type="number" value={editando.estoque_inicial_com_nota} onChange={(e) => setEditando({ ...editando, estoque_inicial_com_nota: e.target.value })} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Quantidade SEM nota</label>
                    <input type="number" value={editando.estoque_inicial_sem_nota} onChange={(e) => setEditando({ ...editando, estoque_inicial_sem_nota: e.target.value })} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            ) : (
              // Produto EXISTENTE: mostra o que já tem, permite só ajustar o "sem nota"
              // manualmente (o "com nota" só muda via venda ou importação de XML,
              // pra manter rastreável de onde veio cada entrada documentada)
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
                <p style={{ fontSize: 11, color: 'var(--texto-suave)', margin: '6px 0 0' }}>
                  Se você sabe de quem comprou (mesmo informal, tipo produtor rural), o certo é usar a{' '}
                  <a href="/admin/contranota" style={{ color: 'var(--azul)' }}>tela de Contranota</a> em vez desse ajuste —
                  assim fica documentado de verdade. Esse campo aqui é só pra correções sem fornecedor identificável
                  (quebra, perda, inventário).
                </p>
              </div>
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
