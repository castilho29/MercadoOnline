'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const vazio = {
  nome: '', telefone: '', email: '', senha: '',
  placa: '', tipo: 'moto', modelo: '',
};

export default function EntregadoresPage() {
  const [entregadores, setEntregadores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novo, setNovo] = useState({ ...vazio });
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  const statusLabel = { disponivel: 'Disponível', em_entrega: 'Em entrega', offline: 'Offline' };
  const statusCor = { disponivel: 'var(--verde)', em_entrega: 'var(--amarelo)', offline: 'var(--texto-suave)' };

  async function carregar() {
    const { data, error } = await supabase
      .from('entregadores')
      .select('id, status, veiculos(placa, tipo, modelo), perfis(nome, telefone)');
    if (error) setErro(error.message);
    else setEntregadores(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregar();
    });
  }, []);

  async function cadastrar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const resposta = await fetch(`${process.env.NEXT_PUBLIC_MICROSSERVICO_URL}/cadastrar-pessoa.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Microservico-Token': process.env.NEXT_PUBLIC_MICROSSERVICO_TOKEN,
        },
        body: JSON.stringify({
          nome: novo.nome,
          telefone: novo.telefone,
          email: novo.email,
          senha: novo.senha,
          papel: 'entregador',
          veiculo: { placa: novo.placa, tipo: novo.tipo, modelo: novo.modelo },
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro || 'Falha ao cadastrar');
      } else {
        setSucesso(`${novo.nome} cadastrado(a) como entregador — já pode logar com o e-mail e senha informados.`);
        setNovo({ ...vazio });
        setMostrarForm(false);
        carregar();
      }
    } catch (e) {
      setErro('Não consegui falar com o microsserviço fiscal. Confira se NEXT_PUBLIC_MICROSSERVICO_URL está certo e se ele está rodando.');
    }

    setSalvando(false);
  }

  if (carregando) return <p style={{ padding: 24 }}>Carregando...</p>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Entregadores</h1>
        <a href="/admin" style={{ fontSize: 14, color: 'var(--azul)' }}>← Retaguarda</a>
      </div>

      {erro && <p style={{ color: 'var(--vermelho)', fontSize: 14 }}>{erro}</p>}
      {sucesso && <p style={{ color: 'var(--verde)', fontSize: 14 }}>{sucesso}</p>}

      <button onClick={() => setMostrarForm(!mostrarForm)} style={{ marginBottom: 16 }}>
        {mostrarForm ? 'Cancelar' : '+ Cadastrar entregador'}
      </button>

      {mostrarForm && (
        <form onSubmit={cadastrar} className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--texto-suave)', margin: 0 }}>
            Isso já cria o login da pessoa — ela não precisa se cadastrar sozinha antes.
          </p>
          <input placeholder="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
          <input placeholder="Telefone" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
          <input type="email" placeholder="E-mail (login)" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
          <input type="password" placeholder="Senha inicial" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} required minLength={6} />

          <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, margin: '8px 0 0' }}>Veículo</p>
          <input placeholder="Placa" value={novo.placa} onChange={(e) => setNovo({ ...novo, placa: e.target.value.toUpperCase() })} required />
          <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
            <option value="moto">Moto</option>
            <option value="carro">Carro</option>
            <option value="bicicleta">Bicicleta</option>
          </select>
          <input placeholder="Modelo (opcional)" value={novo.modelo} onChange={(e) => setNovo({ ...novo, modelo: e.target.value })} />

          <button type="submit" disabled={salvando}>{salvando ? 'Cadastrando...' : 'Cadastrar entregador'}</button>
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
