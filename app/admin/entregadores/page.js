'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function EntregadoresPage() {
  const [entregadores, setEntregadores] = useState([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novo, setNovo] = useState({ usuario_id: '', placa: '', tipo: 'moto', modelo: '' });
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  async function carregar() {
    const { data: lista, error: erroLista } = await supabase
      .from('entregadores')
      .select('id, status, veiculos(placa, tipo, modelo), perfis(nome, telefone)');

    const { data: perfisEntregador } = await supabase
      .from('perfis')
      .select('id, nome, telefone')
      .eq('papel', 'entregador');

    if (erroLista) setErro(erroLista.message);
    else setEntregadores(lista || []);

    // Só oferece pra cadastro quem ainda não tem registro de entregador
    const idsJaCadastrados = new Set((lista || []).map((e) => e.usuario_id));
    setUsuariosDisponiveis((perfisEntregador || []).filter((p) => !idsJaCadastrados.has(p.id)));

    setCarregando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregar();
    });
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');

    const { data: veiculo, error: erroVeiculo } = await supabase
      .from('veiculos')
      .insert({ placa: novo.placa, tipo: novo.tipo, modelo: novo.modelo })
      .select()
      .single();

    if (erroVeiculo) { setErro(erroVeiculo.message); setSalvando(false); return; }

    const { error: erroEntregador } = await supabase
      .from('entregadores')
      .insert({ usuario_id: novo.usuario_id, veiculo_id: veiculo.id, status: 'disponivel' });

    setSalvando(false);
    if (erroEntregador) { setErro(erroEntregador.message); return; }

    setNovo({ usuario_id: '', placa: '', tipo: 'moto', modelo: '' });
    setMostrarForm(false);
    carregar();
  }

  const statusLabel = { disponivel: 'Disponível', em_entrega: 'Em entrega', offline: 'Offline' };
  const statusCor = { disponivel: 'var(--verde)', em_entrega: 'var(--amarelo)', offline: 'var(--texto-suave)' };

  if (carregando) return <p style={{ padding: 24 }}>Carregando...</p>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Entregadores</h1>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</Link>
      </div>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14 }}>{erro}</p>}

      <button onClick={() => setMostrarForm(!mostrarForm)} style={{ marginBottom: 16 }}>
        {mostrarForm ? 'Cancelar' : '+ Cadastrar entregador'}
      </button>

      {mostrarForm && (
        <form onSubmit={salvar} className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuariosDisponiveis.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
              Nenhum usuário com papel "entregador" disponível pra cadastrar. A pessoa precisa
              primeiro criar uma conta (qualquer tela de login serve) e você promove o papel dela
              pra <code>entregador</code> na tabela <code>perfis</code> pelo SQL Editor.
            </p>
          ) : (
            <>
              <select value={novo.usuario_id} onChange={(e) => setNovo({ ...novo, usuario_id: e.target.value })} required>
                <option value="">Selecione a pessoa</option>
                {usuariosDisponiveis.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome} {u.telefone ? `· ${u.telefone}` : ''}</option>
                ))}
              </select>
              <input placeholder="Placa do veículo" value={novo.placa} onChange={(e) => setNovo({ ...novo, placa: e.target.value.toUpperCase() })} required />
              <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
                <option value="moto">Moto</option>
                <option value="carro">Carro</option>
                <option value="bicicleta">Bicicleta</option>
              </select>
              <input placeholder="Modelo (opcional)" value={novo.modelo} onChange={(e) => setNovo({ ...novo, modelo: e.target.value })} />
              <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar'}</button>
            </>
          )}
        </form>
      )}

      <div className="card">
        {entregadores.length === 0 && (
          <p style={{ padding: 20, color: 'var(--texto-suave)', fontSize: 14 }}>Nenhum entregador cadastrado ainda.</p>
        )}
        {entregadores.map((e) => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottom: '1px solid var(--borda)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{e.perfis?.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                {e.veiculos?.tipo} · {e.veiculos?.placa} {e.veiculos?.modelo && `· ${e.veiculos.modelo}`}
              </div>
            </div>
            <span className="badge" style={{ background: 'transparent', color: statusCor[e.status], border: `1px solid ${statusCor[e.status]}` }}>
              {statusLabel[e.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
