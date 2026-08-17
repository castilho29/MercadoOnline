'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const CORES_CATEGORIA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#e34948', '#73726c'];

function inicioDoDia(diasAtras = 0) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DashboardPage() {
  const [carregando, setCarregando] = useState(true);
  const [kpis, setKpis] = useState({ faturamento: 0, ticketMedio: 0, vendasQtd: 0, itensVendidos: 0, clientesAtendidos: 0 });
  const [serieFaturamento, setSerieFaturamento] = useState([]); // [{dia, valor}]
  const [categorias, setCategorias] = useState([]); // [{nome, valor, cor}]
  const [alertas, setAlertas] = useState({ estoqueBaixo: 0, contasVencidas: 0, notasPendentes: 0, condicionaisPendentes: 0 });
  const [produtosEstoqueBaixo, setProdutosEstoqueBaixo] = useState([]);
  const [ultimasVendas, setUltimasVendas] = useState([]);

  useEffect(() => {
    carregarTudo(true);
    const intervalo = setInterval(() => carregarTudo(false), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  async function carregarTudo(primeiraVez) {
    const hoje = inicioDoDia(0).toISOString();
    const seteDiasAtras = inicioDoDia(6).toISOString();

    const [
      { data: vendasHoje },
      { data: pedidosHoje },
      { data: vendasSemana },
      { data: pedidosSemana },
      { data: produtosBaixo },
      { data: contasVencidas },
      { data: notasPendentes },
      { data: condicionaisPendentes },
      { data: vendasRecentes },
      { data: pedidosRecentes },
    ] = await Promise.all([
      supabase.from('vendas_balcao').select('id, total, criado_em').eq('tipo_venda', 'normal').gte('criado_em', hoje),
      supabase.from('pedidos').select('id, total, criado_em, cliente_id').eq('status', 'entregue').gte('criado_em', hoje),
      supabase.from('vendas_balcao').select('id, total, criado_em, itens_venda_balcao(quantidade, preco_unitario, produtos(nome, categoria_id, categorias(nome)))').eq('tipo_venda', 'normal').gte('criado_em', seteDiasAtras),
      supabase.from('pedidos').select('id, total, criado_em, itens_pedido(quantidade, preco_unitario, produtos(nome, categoria_id, categorias(nome)))').eq('status', 'entregue').gte('criado_em', seteDiasAtras),
      supabase.from('produtos').select('id, nome, estoque').eq('ativo', true).lt('estoque', 10).order('estoque', { ascending: true }).limit(5),
      supabase.from('contas_pagar').select('id').eq('status', 'atrasado'),
      supabase.from('notas_fiscais').select('id').in('status', ['pendente', 'processando', 'rejeitada', 'contingencia']),
      supabase.from('vendas_balcao').select('id').eq('tipo_venda', 'condicional').eq('status_condicional', 'pendente'),
      supabase.from('vendas_balcao').select('id, total, forma_pagamento, criado_em').order('criado_em', { ascending: false }).limit(5),
      supabase.from('pedidos').select('id, total, forma_pagamento, criado_em').order('criado_em', { ascending: false }).limit(5),
    ]);

    // ---- KPIs de hoje ----
    const faturamento = (vendasHoje || []).reduce((s, v) => s + Number(v.total), 0) + (pedidosHoje || []).reduce((s, p) => s + Number(p.total), 0);
    const vendasQtd = (vendasHoje?.length || 0) + (pedidosHoje?.length || 0);
    const clientesAtendidos = (vendasHoje?.length || 0) + new Set((pedidosHoje || []).map((p) => p.cliente_id)).size;

    // ---- Faturamento últimos 7 dias (gráfico) ----
    const buckets = {};
    for (let i = 6; i >= 0; i--) {
      const d = inicioDoDia(i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    [...(vendasSemana || []), ...(pedidosSemana || [])].forEach((v) => {
      const chave = v.criado_em.slice(0, 10);
      if (chave in buckets) buckets[chave] += Number(v.total);
    });
    const serie = Object.entries(buckets).map(([dia, valor]) => ({ dia, valor }));
    setSerieFaturamento(serie);

    // ---- Itens vendidos + vendas por categoria (semana) ----
    let itensVendidos = 0;
    const porCategoria = {};
    [...(vendasSemana || []), ...(pedidosSemana || [])].forEach((v) => {
      const itens = v.itens_venda_balcao || v.itens_pedido || [];
      itens.forEach((item) => {
        itensVendidos += Number(item.quantidade);
        const nomeCat = item.produtos?.categorias?.nome || 'Sem categoria';
        const valorItem = Number(item.quantidade) * Number(item.preco_unitario);
        porCategoria[nomeCat] = (porCategoria[nomeCat] || 0) + valorItem;
      });
    });
    const categoriasArr = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome, valor], i) => ({ nome, valor, cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length] }));
    setCategorias(categoriasArr);

    setKpis({
      faturamento,
      ticketMedio: vendasQtd > 0 ? faturamento / vendasQtd : 0,
      vendasQtd,
      itensVendidos,
      clientesAtendidos,
    });

    setAlertas({
      estoqueBaixo: produtosBaixo?.length || 0,
      contasVencidas: contasVencidas?.length || 0,
      notasPendentes: notasPendentes?.length || 0,
      condicionaisPendentes: condicionaisPendentes?.length || 0,
    });

    setProdutosEstoqueBaixo(produtosBaixo || []);

    const vendasCombinadas = [
      ...(vendasRecentes || []).map((v) => ({ ...v, tipo: 'Balcão' })),
      ...(pedidosRecentes || []).map((p) => ({ ...p, tipo: 'Online' })),
    ].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).slice(0, 6);
    setUltimasVendas(vendasCombinadas);

    setCarregando(false);
  }

  if (carregando) return <p style={{ fontSize: 15 }}>Carregando dashboard...</p>;

  const maxSerie = Math.max(...serieFaturamento.map((s) => s.valor), 1);
  const totalCategorias = categorias.reduce((s, c) => s + c.valor, 0) || 1;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: '#78716c', margin: '2px 0 0' }}>Visão geral de hoje</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Faturamento hoje', valor: `R$ ${kpis.faturamento.toFixed(2)}`, cor: '#2563eb', icone: '💰' },
          { label: 'Ticket médio', valor: `R$ ${kpis.ticketMedio.toFixed(2)}`, cor: '#16a34a', icone: '🧾' },
          { label: 'Vendas hoje', valor: kpis.vendasQtd, cor: '#7c3aed', icone: '📄' },
          { label: 'Itens vendidos (7d)', valor: kpis.itensVendidos, cor: '#ea580c', icone: '📦' },
          { label: 'Clientes atendidos', valor: kpis.clientesAtendidos, cor: '#0891b2', icone: '👥' },
        ].map((k) => (
          <div key={k.label} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{k.icone}</span>
              <span style={{ fontSize: 12, color: '#78716c', fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.cor }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        {/* Gráfico de faturamento */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>Faturamento — últimos 7 dias</p>
          <svg viewBox="0 0 500 180" style={{ width: '100%', height: 180 }} role="img" aria-label="Gráfico de faturamento dos últimos 7 dias">
            {serieFaturamento.map((s, i) => {
              const x = (i / (serieFaturamento.length - 1)) * 460 + 20;
              const y = 160 - (s.valor / maxSerie) * 140;
              return null;
            })}
            <polyline
              fill="none" stroke="#2563eb" strokeWidth="2.5"
              points={serieFaturamento.map((s, i) => {
                const x = (i / (serieFaturamento.length - 1)) * 460 + 20;
                const y = 160 - (s.valor / maxSerie) * 140;
                return `${x},${y}`;
              }).join(' ')}
            />
            {serieFaturamento.map((s, i) => {
              const x = (i / (serieFaturamento.length - 1)) * 460 + 20;
              const y = 160 - (s.valor / maxSerie) * 140;
              const data = new Date(s.dia + 'T00:00:00');
              return (
                <g key={s.dia}>
                  <circle cx={x} cy={y} r="4" fill="#2563eb" />
                  <text x={x} y={175} fontSize="10" fill="#78716c" textAnchor="middle">{data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Vendas por categoria (donut) */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>Vendas por categoria (7 dias)</p>
          {categorias.length === 0 ? (
            <p style={{ fontSize: 13, color: '#78716c' }}>Sem vendas nesse período ainda.</p>
          ) : (
            <>
              <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, display: 'block', margin: '0 auto 12px' }} role="img" aria-label="Distribuição de vendas por categoria">
                {(() => {
                  let acumulado = 0;
                  return categorias.map((c) => {
                    const fracao = c.valor / totalCategorias;
                    const inicio = acumulado;
                    acumulado += fracao;
                    const raio = 50, cx = 60, cy = 60, circun = 2 * Math.PI * raio;
                    return (
                      <circle
                        key={c.nome}
                        cx={cx} cy={cy} r={raio} fill="none" stroke={c.cor} strokeWidth="18"
                        strokeDasharray={`${fracao * circun} ${circun}`}
                        strokeDashoffset={-inicio * circun}
                        transform="rotate(-90 60 60)"
                      />
                    );
                  });
                })()}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categorias.slice(0, 5).map((c) => (
                  <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: c.cor, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#3b3b38' }}>{c.nome}</span>
                    <span style={{ color: '#78716c' }}>{Math.round((c.valor / totalCategorias) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alertas */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Alertas</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { qtd: alertas.estoqueBaixo, label: 'produtos com estoque baixo', href: '/admin/produtos', icone: '⚠️' },
            { qtd: alertas.contasVencidas, label: 'contas a pagar vencidas', href: '/admin/contas-pagar', icone: '💳' },
            { qtd: alertas.notasPendentes, label: 'notas fiscais pendentes', href: '/admin/notas-fiscais', icone: '🧾' },
            { qtd: alertas.condicionaisPendentes, label: 'condicionais aguardando decisão', href: '/pdv/condicionais', icone: '⏳' },
          ].filter((a) => a.qtd > 0).map((a) => (
            <Link key={a.label} href={a.href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, textDecoration: 'none', color: '#1c1917', background: '#fafaf9' }}>
              <span style={{ fontSize: 13 }}>{a.icone} {a.label}</span>
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{a.qtd}</span>
            </Link>
          ))}
          {alertas.estoqueBaixo === 0 && alertas.contasVencidas === 0 && alertas.notasPendentes === 0 && alertas.condicionaisPendentes === 0 && (
            <p style={{ fontSize: 13, color: '#78716c', margin: 0 }}>Nenhum alerta no momento. 🎉</p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        {/* Estoque baixo */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Produtos com estoque baixo</p>
          {produtosEstoqueBaixo.length === 0 ? (
            <p style={{ fontSize: 13, color: '#78716c' }}>Nenhum produto abaixo de 10 unidades.</p>
          ) : produtosEstoqueBaixo.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0ef', fontSize: 13 }}>
              <span>{p.nome}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{p.estoque} un.</span>
                <Link href="/admin/contranota" style={{ fontSize: 12, color: 'var(--azul)' }}>Repor</Link>
              </span>
            </div>
          ))}
        </div>

        {/* Últimas vendas */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Últimas vendas</p>
          {ultimasVendas.length === 0 ? (
            <p style={{ fontSize: 13, color: '#78716c' }}>Nenhuma venda ainda.</p>
          ) : ultimasVendas.map((v) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0ef', fontSize: 13 }}>
              <span>#{v.id.slice(0, 8)} · {v.tipo}</span>
              <span style={{ fontWeight: 700 }}>R$ {Number(v.total).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Acesso rápido */}
      <div className="card" style={{ padding: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Acesso rápido</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { href: '/pdv/balcao', label: 'Nova venda', icone: '🛒', cor: '#dcfce7', texto: '#16a34a' },
            { href: '/admin/importar-compra', label: 'Nova compra', icone: '📥', cor: '#dbeafe', texto: '#2563eb' },
            { href: '/admin/produtos', label: 'Cadastro produto', icone: '📦', cor: '#ede9fe', texto: '#7c3aed' },
            { href: '/admin/entregadores', label: 'Entregadores', icone: '🛵', cor: '#fef3c7', texto: '#d97706' },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{ background: a.cor, color: a.texto, borderRadius: 10, padding: '16px 10px', textAlign: 'center', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icone}</div>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
