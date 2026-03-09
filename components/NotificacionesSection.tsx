'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, XCircle, Clock, MessageCircle, RefreshCw,
  Bell, CheckCheck, Phone, Calendar, TrendingUp, BarChart3,
  AlertTriangle, ChevronRight, User
} from 'lucide-react';
import { calcularFiabilidad } from '@/lib/fiabilidad';

const C = {
  bg: '#0B0F1A', panel: '#111827', panelAlt: '#1A2332',
  green: '#22C55E', greenDim: 'rgba(34,197,94,0.1)',
  red: '#EF4444', redDim: 'rgba(239,68,68,0.08)',
  amber: '#F59E0B', amberDim: 'rgba(245,158,11,0.08)',
  blue: '#3B82F6', blueDim: 'rgba(59,130,246,0.08)',
  orange: '#FB923C', orangeDim: 'rgba(251,146,60,0.08)',
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

interface ClienteRiesgo {
  id: string;
  nombre: string;
  telefono: string | null;
  noShowsReales: number;
  cancelaciones: number;
  riskPoints: number;
  riskLabel: 'atencion' | 'riesgo';
  riskColor: string;
  proximaCita: string | null;
}

export default function NotificacionesSection({
  empresaId,
  onNavigate,
}: {
  empresaId: string;
  onNavigate?: (section: string) => void;
}) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [periodoStats, setPeriodoStats] = useState<PeriodoStats>('mes');
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // ── RIESGO ──
  const [clientesRiesgo, setClientesRiesgo] = useState<ClienteRiesgo[]>([]);
  const [loadingRiesgo, setLoadingRiesgo] = useState(true);
  const [showRiesgo, setShowRiesgo] = useState(true);

  // ── MÉTRICAS RENDIMIENTO ──
  const [asistenciaReal, setAsistenciaReal] = useState<number | null>(null);
  const [tiempoMedioRespuesta, setTiempoMedioRespuesta] = useState<number | null>(null);
  const [loadingMetricas, setLoadingMetricas] = useState(true);

  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth < 768); }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (empresaId) {
      load();
      loadClientesRiesgo();
      loadMetricas();
    }
  }, [empresaId]);

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

  async function loadClientesRiesgo() {
    setLoadingRiesgo(true);
    try {
      // Citas próximos 7 días
      const hoy = new Date();
      const en7dias = new Date(hoy.getTime() + 7 * 86400000);

      const { data: citasProximas } = await supabase
        .from('citas')
        .select('cliente_id, hora_inicio, clientes(id, nombre, telefono)')
        .eq('empresa_id', empresaId)
        .gte('hora_inicio', hoy.toISOString())
        .lte('hora_inicio', en7dias.toISOString())
        .not('cliente_id', 'is', null);

      if (!citasProximas || citasProximas.length === 0) {
        setClientesRiesgo([]);
        setLoadingRiesgo(false);
        return;
      }

      // Clientes únicos con cita próxima
      const clientesMap = new Map<string, { nombre: string; telefono: string | null; proximaCita: string }>();
      citasProximas.forEach((c: any) => {
        if (c.cliente_id && c.clientes && !clientesMap.has(c.cliente_id)) {
          clientesMap.set(c.cliente_id, {
            nombre: c.clientes.nombre,
            telefono: c.clientes.telefono || null,
            proximaCita: c.hora_inicio,
          });
        }
      });

      // Historial completo de cada cliente
      const clienteIds = Array.from(clientesMap.keys());
      const { data: historial } = await supabase
        .from('citas')
        .select('cliente_id, hora_inicio, estado, estado_detallado')
        .eq('empresa_id', empresaId)
        .in('cliente_id', clienteIds);

      // Calcular fiabilidad por cliente
      const resultado: ClienteRiesgo[] = [];
      clientesMap.forEach((cliente, clienteId) => {
        const citasCliente = (historial || []).filter((c: any) => c.cliente_id === clienteId);
        const fiab = calcularFiabilidad(citasCliente);

        if (fiab.riskLabel === 'atencion' || fiab.riskLabel === 'riesgo') {
          resultado.push({
            id: clienteId,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            noShowsReales: fiab.noShowsReales,
            cancelaciones: fiab.cancelaciones,
            riskPoints: fiab.riskPoints,
            riskLabel: fiab.riskLabel as 'atencion' | 'riesgo',
            riskColor: fiab.riskColor,
            proximaCita: cliente.proximaCita,
          });
        }
      });

      // Ordenar por riesgo descendente
      resultado.sort((a, b) => b.riskPoints - a.riskPoints);
      setClientesRiesgo(resultado);
    } catch (e) {
      console.error('Error cargando clientes riesgo:', e);
    }
    setLoadingRiesgo(false);
  }

  async function loadMetricas() {
    setLoadingMetricas(true);
    try {
      // Últimos 90 días
      const desde = new Date();
      desde.setDate(desde.getDate() - 90);

      const { data: citas } = await supabase
        .from('citas')
        .select('estado, confirmado_at, recordatorio_1_enviado_at')
        .eq('empresa_id', empresaId)
        .gte('hora_inicio', desde.toISOString())
        .not('estado', 'eq', 'cancelada');

      if (citas && citas.length > 0) {
        // Asistencia real: completadas / total (excluye canceladas ya filtradas)
        const completadas = citas.filter(c =>
          (c.estado || '').toLowerCase() === 'completada'
        ).length;
        setAsistenciaReal(Math.round((completadas / citas.length) * 100));

        // Tiempo medio de respuesta: diff entre recordatorio enviado y confirmación
        const conRespuesta = citas.filter(c =>
          c.confirmado_at && c.recordatorio_1_enviado_at
        );
        if (conRespuesta.length > 0) {
          const tiempos = conRespuesta.map(c => {
            const enviado = new Date(c.recordatorio_1_enviado_at).getTime();
            const confirmado = new Date(c.confirmado_at).getTime();
            return Math.max(0, (confirmado - enviado) / 60000); // minutos
          });
          const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
          setTiempoMedioRespuesta(Math.round(media));
        } else {
          setTiempoMedioRespuesta(null);
        }
      } else {
        setAsistenciaReal(null);
        setTiempoMedioRespuesta(null);
      }
    } catch (e) {
      console.error('Error cargando métricas:', e);
    }
    setLoadingMetricas(false);
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

  const deHoy = useMemo(() => notifs.filter(n => new Date(n.created_at).toDateString() === ahora.toDateString()), [notifs]);
  const resumenHoy = {
    aceptados:    deHoy.filter(n => n.estado === 'aceptado').length,
    cancelados:   deHoy.filter(n => n.estado === 'cancelado').length,
    sinRespuesta: deHoy.filter(n => n.estado === 'sin_respuesta').length,
    enviados:     deHoy.filter(n => n.estado === 'enviado').length,
  };

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

  const FILTROS: { key: Filtro; label: string; shortLabel: string; color: string }[] = [
    { key: 'todos',         label: 'Todos',         shortLabel: 'Todo',    color: C.textMid },
    { key: 'aceptado',      label: 'Confirmadas',   shortLabel: '✓',       color: C.green   },
    { key: 'cancelado',     label: 'Canceladas',    shortLabel: '✗',       color: C.red     },
    { key: 'sin_respuesta', label: 'Sin respuesta', shortLabel: '⏳',      color: C.amber   },
    { key: 'enviado',       label: 'Enviados',      shortLabel: '📤',      color: C.blue    },
  ];

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
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: isMobile ? '12px 14px' : '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, margin: 0 }}>Notificaciones</h2>
            {noLeidas > 0 && (
              <span style={{ background: C.green, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
                {noLeidas}
              </span>
            )}
          </div>
          {!isMobile && <p style={{ fontSize: 12, color: C.textDim, margin: '2px 0 0' }}>Registro de mensajes WhatsApp</p>}
        </div>
        {noLeidas > 0 && (
          <button onClick={marcarTodasLeidas} disabled={marcandoTodas}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: isMobile ? '6px 10px' : '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, cursor: 'pointer', fontSize: isMobile ? 11 : 12, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {marcandoTodas ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCheck size={13} />}
            {isMobile ? 'Leer todas' : 'Marcar todas leídas'}
          </button>
        )}
      </div>

      <div style={{ padding: isMobile ? '12px 10px' : '20px 24px' }}>

        {/* ── PANEL RIESGO NO-SHOW ── */}
        {!loadingRiesgo && clientesRiesgo.length > 0 && (
          <div style={{
            background: C.panel,
            border: `1px solid ${C.red}22`,
            borderRadius: isMobile ? 12 : 16,
            marginBottom: isMobile ? 12 : 20,
            overflow: 'hidden',
          }}>
            {/* Cabecera panel riesgo */}
            <button
              onClick={() => setShowRiesgo(s => !s)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: isMobile ? '10px 14px' : '13px 18px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: showRiesgo ? `1px solid ${C.border}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: C.redDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={14} style={{ color: C.red }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.text, margin: 0 }}>
                    Riesgo de no-show esta semana
                  </p>
                  <p style={{ fontSize: 10, color: C.textDim, margin: 0 }}>
                    {clientesRiesgo.length} cliente{clientesRiesgo.length !== 1 ? 's' : ''} con historial de incidencias
                  </p>
                </div>
              </div>
              <ChevronRight size={14} style={{ color: C.textDim, transform: showRiesgo ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Lista clientes riesgo */}
            {showRiesgo && (
              <div>
                {clientesRiesgo.map((c, i) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14,
                    padding: isMobile ? '10px 14px' : '12px 18px',
                    borderBottom: i < clientesRiesgo.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    {/* Avatar con color de riesgo */}
                    <div style={{
                      width: isMobile ? 34 : 38, height: isMobile ? 34 : 38,
                      borderRadius: '50%',
                      background: c.riskColor + '22',
                      border: `2px solid ${c.riskColor}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 13, fontWeight: 800, color: c.riskColor,
                    }}>
                      {c.nombre[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {c.nombre}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: c.riskColor + '18', color: c.riskColor, flexShrink: 0,
                        }}>
                          {c.riskLabel === 'riesgo' ? '🔴 Riesgo' : '⚠️ Atención'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexWrap: 'wrap' }}>
                        {c.noShowsReales > 0 && (
                          <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>
                            {c.noShowsReales} no-show{c.noShowsReales !== 1 ? 's' : ''}
                          </span>
                        )}
                        {c.cancelaciones > 0 && (
                          <span style={{ fontSize: 10, color: C.amber, fontWeight: 600 }}>
                            {c.cancelaciones} cancelación{c.cancelaciones !== 1 ? 'es' : ''}
                          </span>
                        )}
                        {c.proximaCita && (
                          <span style={{ fontSize: 10, color: C.textDim, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Calendar size={9} />
                            {new Date(c.proximaCita).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {' '}
                            {new Date(c.proximaCita).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acción */}
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('clientes')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: isMobile ? '5px 8px' : '6px 10px',
                          borderRadius: 7, border: `1px solid ${C.border}`,
                          background: 'transparent', color: C.textMid,
                          cursor: 'pointer', fontSize: 10, fontWeight: 600, flexShrink: 0,
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        <User size={10} />
                        {isMobile ? 'Ver' : 'Ver ficha'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RESUMEN HOY ── */}
        <div style={{ display: 'flex', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 10 : 16, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible' }}>
          {[
            { label: 'Confirmadas',   value: resumenHoy.aceptados,    color: C.green, bg: C.greenDim },
            { label: 'Canceladas',    value: resumenHoy.cancelados,   color: C.red,   bg: C.redDim   },
            { label: 'Sin respuesta', value: resumenHoy.sinRespuesta, color: C.amber, bg: C.amberDim },
            { label: 'Enviados',      value: resumenHoy.enviados,     color: C.blue,  bg: C.blueDim  },
          ].map(card => (
            <div key={card.label} style={{
              background: card.bg, border: `1px solid ${card.color}22`, borderRadius: isMobile ? 10 : 12,
              padding: isMobile ? '8px 12px' : '12px 16px',
              flex: isMobile ? '0 0 auto' : '1 1 0',
              minWidth: isMobile ? 80 : 'auto',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: isMobile ? 9 : 11, color: card.color, fontWeight: 600, marginTop: 3, opacity: 0.8, whiteSpace: 'nowrap' }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* ── MÉTRICAS DE RENDIMIENTO ── */}
        <div style={{ display: 'flex', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 10 : 16, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible' }}>
          {/* Asistencia real */}
          <div style={{
            background: C.panel, border: `1px solid ${C.green}22`, borderRadius: isMobile ? 10 : 12,
            padding: isMobile ? '10px 14px' : '14px 18px',
            flex: '1 1 0', minWidth: isMobile ? 140 : 'auto',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp size={12} style={{ color: C.green }} />
              </div>
              <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>
                Asistencia real
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {loadingMetricas ? (
                <span style={{ fontSize: 22, fontWeight: 800, color: C.textDim }}>—</span>
              ) : asistenciaReal !== null ? (
                <>
                  <span style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: asistenciaReal >= 80 ? C.green : asistenciaReal >= 60 ? C.amber : C.red, lineHeight: 1 }}>
                    {asistenciaReal}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.textMid }}>%</span>
                </>
              ) : (
                <span style={{ fontSize: 22, fontWeight: 800, color: C.textDim }}>—</span>
              )}
            </div>
            <div style={{ height: 4, background: 'rgba(148,163,184,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${asistenciaReal ?? 0}%`,
                background: asistenciaReal !== null && asistenciaReal >= 80 ? C.green : asistenciaReal !== null && asistenciaReal >= 60 ? C.amber : C.red,
                borderRadius: 2, transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{ fontSize: 10, color: C.textDim }}>Últimos 90 días</span>
          </div>

          {/* Tiempo medio de respuesta */}
          <div style={{
            background: C.panel, border: `1px solid ${C.blue}22`, borderRadius: isMobile ? 10 : 12,
            padding: isMobile ? '10px 14px' : '14px 18px',
            flex: '1 1 0', minWidth: isMobile ? 140 : 'auto',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={12} style={{ color: C.blue }} />
              </div>
              <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>
                Tiempo respuesta
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {loadingMetricas ? (
                <span style={{ fontSize: 22, fontWeight: 800, color: C.textDim }}>—</span>
              ) : tiempoMedioRespuesta !== null ? (
                <>
                  <span style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: C.blue, lineHeight: 1 }}>
                    {tiempoMedioRespuesta < 60
                      ? tiempoMedioRespuesta
                      : Math.round(tiempoMedioRespuesta / 60)}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.textMid }}>
                    {tiempoMedioRespuesta < 60 ? 'min' : 'h'}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 22, fontWeight: 800, color: C.textDim }}>—</span>
              )}
            </div>
            <div style={{ height: 4, background: 'rgba(148,163,184,0.1)', borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: C.textDim }}>
              {tiempoMedioRespuesta !== null ? 'Promedio tras recordatorio' : 'Disponible con WhatsApp activo'}
            </span>
          </div>
        </div>

        {/* ── Stats toggle ── */}
        {isMobile && (
          <button onClick={() => setShowStats(s => !s)}
            style={{ width: '100%', padding: '8px 0', marginBottom: 10, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <BarChart3 size={14} />
            {showStats ? 'Ocultar estadísticas' : 'Ver estadísticas'}
          </button>
        )}

        {(!isMobile || showStats) && (
          <div style={{ background: C.panel, borderRadius: isMobile ? 12 : 16, padding: isMobile ? 14 : 20, marginBottom: isMobile ? 12 : 20 }}>
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
              <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'flex-end' }}>
                {statsMes.map((s, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch' }}>
                      {s.aceptados > 0 && <div style={{ height: Math.max(s.aceptados / maxMes * 80, 4), background: C.green, borderRadius: 3, opacity: 0.85 }} />}
                      {s.cancelados > 0 && <div style={{ height: Math.max(s.cancelados / maxMes * 80, 4), background: C.red, borderRadius: 3, opacity: 0.85 }} />}
                      {s.sinRespuesta > 0 && <div style={{ height: Math.max(s.sinRespuesta / maxMes * 80, 4), background: C.amber, borderRadius: 3, opacity: 0.85 }} />}
                      {s.total === 0 && <div style={{ height: 4, background: C.border, borderRadius: 3 }} />}
                    </div>
                    <span style={{ fontSize: 9, color: C.textDim, textAlign: 'center', fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: C.textMid, textAlign: 'center', fontWeight: 700 }}>{s.total}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: isMobile ? 8 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
                {statsAño.map((s, i) => (
                  <div key={i} style={{ flex: 1, background: C.panelAlt, borderRadius: 12, padding: isMobile ? 12 : 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.textMid }}>{s.label}</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{s.total}</span>
                    </div>
                    {[
                      { label: 'Confirmadas',   value: s.aceptados,    color: C.green },
                      { label: 'Canceladas',    value: s.cancelados,   color: C.red   },
                      { label: 'Sin respuesta', value: s.sinRespuesta, color: C.amber },
                    ].map(row => (
                      <div key={row.label} style={{ marginBottom: 6 }}>
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
        )}

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: isMobile ? 4 : 6, marginBottom: isMobile ? 10 : 14, overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: 2 }}>
          {FILTROS.map(f => {
            const count = f.key !== 'todos' ? notifs.filter(n => n.estado === f.key).length : 0;
            return (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                style={{
                  padding: isMobile ? '5px 10px' : '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: isMobile ? 11 : 12, fontWeight: 600, flexShrink: 0,
                  background: filtro === f.key ? f.color + '20' : C.panelAlt,
                  color: filtro === f.key ? f.color : C.textMid,
                  outline: filtro === f.key ? `1px solid ${f.color}44` : 'none',
                  transition: 'all 0.12s', whiteSpace: 'nowrap',
                }}>
                {isMobile ? (f.key === 'todos' ? 'Todo' : f.label) : f.label}
                {count > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* LISTA */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.textDim }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: isMobile ? 40 : 60, background: C.panel, borderRadius: isMobile ? 12 : 16 }}>
            <Bell size={32} style={{ color: C.textDim, marginBottom: 10, opacity: 0.3 }} />
            <p style={{ color: C.textMid, fontSize: 14 }}>Sin notificaciones</p>
            <p style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Las notificaciones aparecerán aquí cuando se envíen mensajes</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(grupos).map(([fecha, items]) => (
              <div key={fecha}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.8, padding: '8px 0 5px', textTransform: 'uppercase' }}>{fecha} · {items.length}</p>
                <div style={{ background: C.panel, borderRadius: isMobile ? 10 : 14, overflow: 'hidden' }}>
                  {items.map((n, i) => {
                    const cfg = ESTADO_CFG[n.estado] || ESTADO_CFG.enviado;
                    const Icon = cfg.icon;
                    return (
                      <div key={n.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: isMobile ? 10 : 14,
                        padding: isMobile ? '10px 12px' : '13px 18px',
                        borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: n.leida ? 'transparent' : 'rgba(34,197,94,0.02)',
                      }}>
                        <div style={{ width: isMobile ? 32 : 38, height: isMobile ? 32 : 38, borderRadius: isMobile ? 8 : 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <Icon size={isMobile ? 15 : 18} style={{ color: cfg.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: n.leida ? 400 : 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, minWidth: 0 }}>
                              {n.clientes?.nombre || 'Cliente desconocido'}
                            </span>
                            {!n.leida && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} />}
                            <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{fmtHora(n.created_at)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                            {n.intento === 2 && <span style={{ fontSize: 9, color: C.amber, fontWeight: 700, background: C.amberDim, padding: '1px 5px', borderRadius: 4 }}>2º</span>}
                            {n.citas?.hora_inicio && <span style={{ fontSize: 10, color: C.textDim, display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={9} /> {n.citas.hora_inicio.substring(11, 16)}</span>}
                            {!isMobile && n.clientes?.telefono && <span style={{ fontSize: 10, color: C.textDim, display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={9} /> {n.clientes.telefono}</span>}
                          </div>
                          {n.mensaje && !isMobile && <p style={{ fontSize: 11, color: C.textDim, marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>"{n.mensaje}"</p>}
                        </div>
                        {!n.leida && (
                          <button onClick={() => marcarLeida(n.id)}
                            style={{ fontSize: 10, color: C.green, background: C.greenDim, border: 'none', borderRadius: 6, padding: isMobile ? '4px 8px' : '3px 8px', cursor: 'pointer', fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
                            Leída
                          </button>
                        )}
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
