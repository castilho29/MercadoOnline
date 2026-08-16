'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

/**
 * Fica escutando a tabela "pedidos" em segundo plano, em qualquer
 * tela do operador (PDV, balcão, condicionais, retaguarda). Toca
 * som + mostra um aviso quando um pedido NOVO chega -- usa o
 * evento INSERT especificamente, então nunca dispara à toa por
 * causa de uma mudança de status de um pedido que já existia.
 */
export default function PedidosNotifier() {
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    const canal = supabase
      .channel('notificador-pedidos-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => {
        tocarSom();
        setAviso('Novo pedido recebido!');
        setTimeout(() => setAviso(null), 7000);
      })
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, []);

  function tocarSom() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach((atraso) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + atraso);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + atraso + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + atraso + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + atraso);
        osc.stop(ctx.currentTime + atraso + 0.16);
      });
    } catch {
      // navegador pode bloquear áudio sem interação prévia -- não trava a tela por isso
    }
  }

  if (!aviso) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
      background: '#16a34a', color: '#fff', padding: '12px 20px', borderRadius: 10, fontWeight: 700,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 14, fontSize: 14,
    }}>
      🔔 {aviso}
      <Link href="/pdv" style={{ color: '#fff', textDecoration: 'underline', fontSize: 13, fontWeight: 700 }}>Ver pedido →</Link>
    </div>
  );
}
