'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

const TIPOS = [
  { id: 'cliente', label: 'Clientes', icone: '🧑', cor: '#2563eb' },
  { id: 'entregador', label: 'Entregadores', icone: '🛵', cor: '#d97706' },
  { id: 'operador_pdv', label: 'Colaboradores', icone: '👔', cor: '#7c3aed' },
  { id: 'fornecedor', label: 'Fornecedores', icone: '🏭', cor: '#16a34a' },
];

const vazio = { papel: 'cliente', nome: '', telefone: '', email: '', senha: '', cpf_cnpj: '', placa: '', tipoVeiculo: 'moto', modelo: '' };

export default function PessoasPage() {
  const [pessoas, setPessoas] = useState([]); // lista unificada, cada uma com .papel
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [filtro, setFiltro] = useState('cliente');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novo, setNovo] = useState({ ...vazio });
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      carregar();
    });
  }, []);

  async function carregar() {
    const [{ data: perfis }, { data: fornecedores }, { data: entregadores }] = await Promise.all([
      supabase.from('perfis').select('id, nome, telefone, papel, criado_em'),
      supabase.from('fornecedores').select('id, razao_social, telefone, cnpj, cpf, tipo_pessoa, criado_em'),
      supabase.from('entregadores').select('id, usuario_id, status, veiculos(placa, tipo, modelo)'),
    ]);

    const entregadorPorUsuario = {};
    (entregadores || []).forEach((e) => { entregadorPorUsuario[e.usuario_id] = e; });

    const listaClientesEColaboradores = (perfis || [])
      .filter((p) => ['cliente', 'operador_pdv', 'entregador'].includes(p.papel))
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        telefone: p.telefone,
        papel: p.papel,
        criado_em: p.criado_em,
        entregadorInfo: p.papel === 'entregador' ? entregadorPorUsuario[p.id] : null,
      }));

    const listaFornecedores = (fornecedores || []).map((f) => ({
      id: f.id,
      nome: f.razao_social,
      telefone: f.telefone,
      papel: 'fornecedor',
      criado_em: f.criado_em,
      documento: f.tipo_pessoa === 'fisica' ? f.cpf : f.cnpj,
    }));

    setPessoas([...listaClientesEColaboradores, ...listaFornecedores]);
    setCarregando(false);
  }

  function mostrarErro(msg) { setErro(msg); setTimeout(() => setErro(''), 5000); }
  function mostrarSucesso(msg) { setSucesso(msg); setTimeout(() => setSucesso(''), 5000); }

  function abrirNovo(papel) {
    setNovo({ ...vazio, papel });
    setMostrarForm(true);
  }

  async function cadastrar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');

    try {
      if (novo.papel === 'fornecedor') {
        // Fornecedor não precisa de login -- vai direto na tabela
        const ehCpf = novo.cpf_cnpj.replace(/\D/g, '').length <= 11;
        const { error } = await supabase.from('fornecedores').insert({
          tipo_pessoa: ehCpf ? 'fisica' : 'juridica',
          cnpj: ehCpf ? null : novo.cpf_cnpj,
          cpf: ehCpf ? novo.cpf_cnpj : null,
          razao_social: novo.nome,
          telefone: novo.telefone || null,
        });
        if (error) throw new Error(error.message);
        mostrarSucesso(`${novo.nome} cadastrado(a) como fornecedor.`);
      } else {
        // Cliente, colaborador ou entregador -- precisa de login,
        // passa pelo microsserviço (só ele tem acesso pra criar conta)
        const corpo = {
          nome: novo.nome,
          telefone: novo.telefone,
          email: novo.email,
          senha: novo.senha,
          papel: novo.papel,
        };
        if (novo.papel === 'entregador') {
          corpo.veiculo = { placa: novo.placa, tipo: novo.tipoVeiculo, modelo: novo.modelo };
        }

        const resposta = await fetch(`${process.env.NEXT_PUBLIC_MICROSSERVICO_URL}/cadastrar-pessoa.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Microservico-Token': process.env.NEXT_PUBLIC_MICROSSERVICO_TOKEN },
          body: JSON.stringify(corpo),
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || 'Falha ao cadastrar');
        mostrarSucesso(`${novo.nome} cadastrado(a)! Já pode logar com o e-mail e senha informados.`);
      }

      setNovo({ ...vazio });
      setMostrarForm(false);
      carregar();
    } catch (e) {
      mostrarErro(e.message);
    }

    setSalvando(false);
  }

  if (carregando) return <p style={{ fontSize: 15 }}>Carregando...</p>;

  const pessoasFiltradas = pessoas.filter((p) => p.papel === filtro).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  const tipoAtual = TIPOS.find((t) => t.id === filtro);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Pessoas</h1>
      <p style={{ fontSize: 13, color: '#78716c', marginBottom: 16 }}>Clientes, colaboradores, entregadores e fornecedores, tudo num lugar só.</p>

      {erro && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{erro}</p>}
      {sucesso && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 8 }}>{sucesso}</p>}

      {/* Abas por tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TIPOS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFiltro(t.id)}
            style={{
              padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
              background: filtro === t.id ? t.cor : '#fff',
              color: filtro === t.id ? '#fff' : '#1c1917',
              border: '1px solid #e7e5e4',
            }}
          >
            {t.icone} {t.label}
            <span style={{ background: filtro === t.id ? 'rgba(255,255,255,0.25)' : '#f5f5f4', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
              {pessoas.filter((p) => p.papel === t.id).length}
            </span>
          </button>
        ))}
      </div>

      <button onClick={() => abrirNovo(filtro)} style={{ marginBottom: 16 }}>
        + Nova pessoa ({tipoAtual.label.replace(/s$/, '')})
      </button>

      {/* Formulário */}
      {mostrarForm && (
        <form onSubmit={cadastrar} className="card" style={{ padding: 16, marginBottom: 16, maxWidth: 460 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#78716c', margin: '0 0 10px' }}>TIPO DE CADASTRO</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {TIPOS.map((t) => (
              <button
                type="button" key={t.id}
                onClick={() => setNovo({ ...novo, papel: t.id })}
                style={{
                  padding: '6px 12px', fontSize: 12,
                  background: novo.papel === t.id ? t.cor : '#fff',
                  color: novo.papel === t.id ? '#fff' : '#1c1917',
                  border: '1px solid #e7e5e4',
                }}
              >{t.icone} {t.label.replace(/s$/, '')}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
            <input placeholder="Telefone" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />

            {novo.papel === 'fornecedor' ? (
              <input placeholder="CPF ou CNPJ" value={novo.cpf_cnpj} onChange={(e) => setNovo({ ...novo, cpf_cnpj: e.target.value })} required />
            ) : (
              <>
                <input type="email" placeholder="E-mail (login)" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
                <input type="password" placeholder="Senha inicial" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} required minLength={6} />
              </>
            )}

            {novo.papel === 'entregador' && (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#78716c', margin: '6px 0 0' }}>VEÍCULO</p>
                <input placeholder="Placa" value={novo.placa} onChange={(e) => setNovo({ ...novo, placa: e.target.value.toUpperCase() })} required />
                <select value={novo.tipoVeiculo} onChange={(e) => setNovo({ ...novo, tipoVeiculo: e.target.value })}>
                  <option value="moto">Moto</option>
                  <option value="carro">Carro</option>
                  <option value="bicicleta">Bicicleta</option>
                </select>
                <input placeholder="Modelo (opcional)" value={novo.modelo} onChange={(e) => setNovo({ ...novo, modelo: e.target.value })} />
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => setMostrarForm(false)} style={{ flex: 1, background: '#78716c' }}>Cancelar</button>
            <button type="submit" disabled={salvando} style={{ flex: 2 }}>{salvando ? 'Cadastrando...' : 'Cadastrar'}</button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="card">
        {pessoasFiltradas.length === 0 && (
          <p style={{ padding: 24, textAlign: 'center', color: '#78716c', fontSize: 14 }}>Nenhum(a) {tipoAtual.label.toLowerCase()} cadastrado(a) ainda.</p>
        )}
        {pessoasFiltradas.map((p) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottom: '1px solid #f0f0ef' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nome}</div>
              <div style={{ fontSize: 12, color: '#78716c' }}>
                {p.telefone || 'sem telefone'}
                {p.documento && ` · ${p.documento}`}
                {p.entregadorInfo && ` · ${p.entregadorInfo.veiculos?.tipo} ${p.entregadorInfo.veiculos?.placa}`}
              </div>
            </div>
            {p.entregadorInfo && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                background: p.entregadorInfo.status === 'disponivel' ? '#dcfce7' : '#fef3c7',
                color: p.entregadorInfo.status === 'disponivel' ? '#16a34a' : '#d97706',
              }}>
                {p.entregadorInfo.status === 'disponivel' ? 'Disponível' : p.entregadorInfo.status === 'em_entrega' ? 'Em entrega' : 'Offline'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
