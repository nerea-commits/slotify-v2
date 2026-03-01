'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, XCircle, Clock, MessageCircle, RefreshCw,
  Bell, CheckCheck, Phone, Calendar, TrendingUp, BarChart3
} from 'lucide-react';

const C = {
  bg: '#0B0F1A', panel: '#111827', panelAlt: '#1A2332',
  green: '#22C55E', greenDim: 'rgba(34,197,94,0.1)',
  red: '#EF4444', redDim: 'rgba(239,68,68,0.08)',
  amber: '#F59E0B', amberDim: 'rgba(245,158,11,0.08)',
  blue: '#3B82F6', blueDim: 'rgba(59,130,246,0.08)',
  text: '#F1F5F9', textMid: '#94A3B8', textDim: '#4B5563',
  border: 'rgba(148,163,184,0.08)',
};

const ESTADO_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  aceptado:      { label: 'Confirmada',    color: C.green, bg: C.greenDim, icon: CheckCircle2  },
  cancelado:     { label: 'Cancelada',     color: C.red,   bg: C.redDim,   icon: XCircle       },
  sin_respuesta: { label: 'Sin respuesta', color: C.amber, bg: C.amberDim, icon: Clock         },
  enviado:       { label: 'Enviado',       color: C.blue,  bg: C.blueDim,  icon: MessageCircle },
};

type Filtro = 'todos' | 'aceptado' | 'cancelado' | 'sin_respuesta' | 'enviado';
type PeriodoStats = 'mes' | 'año';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtHora(ts: string) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function fmtFecha(ts: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height: 4, background: 'rgba(148,163,184,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  );
}

export default function NotificacionesSection({ empresaId }: { empresaId: string }) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [periodoStats, setPeriodoStats] = useState<PeriodoStats>('mes');
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  useEffect(() => { if (empresaId) load(); }, [empresaId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('notificaciones')
      .select('*, clientes(nombre, telefono), citas(hora_inicio)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(500);
    setNotifs(data || []);
    setLoading(false);
  }

  async function marcarLeida(id: string) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }

  async function marcarTodasLeidas() {
    setMarcandoTodas(true);
    await supabase.from('notificaciones').update({ leida: true })
      .eq('empresa_id', empresaId).eq('leida', false);
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    setMarcandoTodas(false);
  }

  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const añoActual = ahora.getFullYear();

  // Resumen hoy
  const deHoy = useMemo(() => notifs.filter(n => new Date(n.created_at).toDateString() === ahora.toDateString()), [notifs]);
  const resumenHoy = {
    aceptados:    deHoy.filter(n => n.estado === 'aceptado').length,
    cancelados:   deHoy.filter(n => n.estado === 'cancelado').length,
    sinRespuesta: deHoy.filter(n => n.estado === 'sin_respuesta').length,
    enviados:     deHoy.filter(n => n.estado === 'enviado').length,
  };

  // Stats mensuales — últimos 6 meses
  const statsMes = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(añoActual, mesActual - 5 + i, 1);
      const mes = d.getMonth();
      const año = d.getFullYear();
      const del = notifs.filter(n => {
        const nd = new Date(n.created_at);
        return nd.getMonth() === mes && nd.getFullYear() === año;
      });
      return {
        label: MESES[mes],
        aceptados:    del.filter(n => n.estado === 'aceptado').length,
        cancelados:   del.filter(n => n.estado === 'cancelado').length,
        sinRespuesta: del.filter(n => n.estado === 'sin_respuesta').length,
        total:        del.length,
      };
    });
  }, [notifs, mesActual, añoActual]);

  // Stats anuales — últimos 2 años
  const statsAño = useMemo(() => {
    return [añoActual - 1, añoActual].map(año => {
      const del = notifs.filter(n => new Date(n.created_at).getFullYear() === año);
      return {
        label: String(año),
        aceptados:    del.filter(n => n.estado === 'aceptado').length,
        cancelados:   del.filter(n => n.estado === 'cancelado').length,
        sinRespuesta: del.filter(n => n.estado === 'sin_respuesta').length,
        total:        del.length,
      };
    });
  }, [notifs, añoActual]);

  const maxMes = Math.max(...statsMes.map(s => s.total), 1);
  const maxAño = Math.max(...statsAño.map(s => s.total), 1);

  const noLeidas = notifs.filter(n => !n.leida).length;
  const filtradas = filtro === 'todos' ? notifs : notifs.filter(n => n.estado === filtro);

  const FILTROS: { key: Filtro; label: string; color: string }[] = [
    { key: 'todos',         label: 'Todos',         color: C.textMid },
    { key: 'aceptado',      label: 'Confirmadas',   color: C.green   },
    { key: 'cancelado',     label: 'Canceladas',    color: C.red     },
    { key: 'sin_respuesta', label: 'Sin respuesta', color: C.amber   },
    { key: 'enviado',       label: 'Enviados',      color: C.blue    },
  ];

  // Agrupar lista por fecha
  const grupos = useMemo(() => {
    const g: Record<string, any[]> = {};
    filtradas.forEach(n => {
      const f = fmtFecha(n.created_at);
      if (!g[f]) g[f] = [];
      g[f].push(n);
    });
    return g;
  }, [filtradas]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Notificaciones</h2>
            {noLeidas > 0 && (
              <span style={{ background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {noLeidas} nuevas
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: C.textDim, margin: '2px 0 0' }}>Registro de mensajes WhatsApp</p>
        </div>
        {noLeidas > 0 && (
          <button onClick={marcarTodasLeidas} disabled={marcandoTodas}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {marcandoTodas ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCheck size={13} />}
            Marcar todas leídas
          </button>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* TOP GRID: resumen hoy + stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Resumen hoy */}
          <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Resumen de hoy</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Confirmadas',   value: resumenHoy.aceptados,    color: C.green, bg: C.greenDim },
                { label: 'Canceladas',    value: resumenHoy.cancelados,   color: C.red,   bg: C.redDim   },
                { label: 'Sin respuesta', value: resumenHoy.sinRespuesta, color: C.amber, bg: C.amberDim },
                { label: 'Enviados',      value: resumenHoy.enviados,     color: C.blue,  bg: C.blueDim  },
              ].map(card => (
                <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: card.color, fontWeight: 600, marginTop: 4, opacity: 0.8 }}>{card.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats mensuales/anuales */}
          <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Estadísticas</p>
              <div style={{ display: 'flex', background: C.panelAlt, borderRadius: 8, padding: 3, gap: 2 }}>
                {(['mes', 'año'] as PeriodoStats[]).map(p => (
                  <button key={p} onClick={() => setPeriodoStats(p)}
                    style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: periodoStats === p ? C.panel : 'transparent', color: periodoStats === p ? C.text : C.textDim, transition: 'all 0.12s' }}>
                    {p === 'mes' ? 'Mensual' : 'Anual'}
                  </button>
                ))}
              </div>
            </div>

            {periodoStats === 'mes' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                {statsMes.map((s, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch' }}>
                      {s.aceptados > 0 && <div style={{ height: Math.max(s.aceptados / maxMes * 80, 4), background: C.green, borderRadius: 3, opacity: 0.85 }} title={`${s.aceptados} confirmadas`} />}
                      {s.cancelados > 0 && <div style={{ height: Math.max(s.cancelados / maxMes * 80, 4), background: C.red, borderRadius: 3, opacity: 0.85 }} title={`${s.cancelados} canceladas`} />}
                      {s.sinRespuesta > 0 && <div style={{ height: Math.max(s.sinRespuesta / maxMes * 80, 4), background: C.amber, borderRadius: 3, opacity: 0.85 }} title={`${s.sinRespuesta} sin respuesta`} />}
                      {s.total === 0 && <div style={{ height: 4, background: C.border, borderRadius: 3 }} />}
                    </div>
                    <span style={{ fontSize: 9, color: C.textDim, textAlign: 'center', fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: C.textMid, textAlign: 'center', fontWeight: 700 }}>{s.total}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 20 }}>
                {statsAño.map((s, i) => (
                  <div key={i} style={{ flex: 1, background: C.panelAlt, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textMid, marginBottom: 10 }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 12 }}>{s.total}</div>
                    {[
                      { label: 'Confirmadas',   value: s.aceptados,    color: C.green },
                      { label: 'Canceladas',    value: s.cancelados,   color: C.red   },
                      { label: 'Sin respuesta', value: s.sinRespuesta, color: C.amber },
                    ].map(row => (
                      <div key={row.label} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 11, color: C.textDim }}>{row.label}</span>
                          <span style={{ fontSize: 11, color: row.color, fontWeight: 700 }}>{row.value}</span>
                        </div>
                        <MiniBar value={row.value} max={s.total} color={row.color} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filtro === f.key ? f.color + '20' : C.panelAlt,
                color: filtro === f.key ? f.color : C.textMid,
                outline: filtro === f.key ? `1px solid ${f.color}44` : 'none',
                transition: 'all 0.12s',
              }}>
              {f.label}
              {f.key !== 'todos' && <span style={{ marginLeft: 5, opacity: 0.7 }}>{notifs.filter(n => n.estado === f.key).length}</span>}
            </button>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.textDim }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: C.panel, borderRadius: 16 }}>
            <Bell size={40} style={{ color: C.textDim, marginBottom: 12, opacity: 0.3 }} />
            <p style={{ color: C.textMid, fontSize: 15 }}>Sin notificaciones</p>
            <p style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Las notificaciones aparecerán aquí cuando se envíen mensajes</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(grupos).map(([fecha, items]) => (
              <div key={fecha}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.8, padding: '10px 0 6px', textTransform: 'uppercase' }}>{fecha} · {items.length}</p>
                <div style={{ background: C.panel, borderRadius: 14, overflow: 'hidden' }}>
                  {items.map((n, i) => {
                    const cfg = ESTADO_CFG[n.estado] || ESTADO_CFG.enviado;
                    const Icon = cfg.icon;
                    return (
                      <div key={n.id} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '13px 18px',
                        borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: n.leida ? 'transparent' : 'rgba(34,197,94,0.02)',
                      }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={18} style={{ color: cfg.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: n.leida ? 400 : 700, color: C.text }}>
                              {n.clientes?.nombre || 'Cliente desconocido'}
                            </span>
                            {!n.leida && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} />}
                            {n.intento === 2 && <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, background: C.amberDim, padding: '1px 6px', borderRadius: 4 }}>2º aviso</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                            {n.citas?.hora_inicio && <span style={{ fontSize: 11, color: C.textDim, display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} /> Cita {n.citas.hora_inicio.substring(11, 16)}</span>}
                            {n.clientes?.telefono && <span style={{ fontSize: 11, color: C.textDim, display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} /> {n.clientes.telefono}</span>}
                          </div>
                          {n.mensaje && <p style={{ fontSize: 11, color: C.textDim, marginTop: 4, fontStyle: 'italic' }}>"{n.mensaje}"</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: C.textDim }}>{fmtHora(n.created_at)}</span>
                          {!n.leida && (
                            <button onClick={() => marcarLeida(n.id)}
                              style={{ fontSize: 10, color: C.green, background: C.greenDim, border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                              Leída
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
