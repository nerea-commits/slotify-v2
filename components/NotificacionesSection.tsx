'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, XCircle, Clock, MessageCircle, RefreshCw,
  Bell, Filter, CheckCheck, ChevronDown, Phone, Calendar
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
  aceptado:      { label: 'Confirmada',    color: C.green, bg: C.greenDim, icon: CheckCircle2 },
  cancelado:     { label: 'Cancelada',     color: C.red,   bg: C.redDim,   icon: XCircle      },
  sin_respuesta: { label: 'Sin respuesta', color: C.amber, bg: C.amberDim, icon: Clock        },
  enviado:       { label: 'Enviado',       color: C.blue,  bg: C.blueDim,  icon: MessageCircle},
};

type Filtro = 'todos' | 'aceptado' | 'cancelado' | 'sin_respuesta' | 'enviado';

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

export default function NotificacionesSection({ empresaId }: { empresaId: string }) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  useEffect(() => { if (empresaId) load(); }, [empresaId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('notificaciones')
      .select('*, clientes(nombre, telefono), citas(hora_inicio)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(100);
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

  // Resumen del día
  const hoy = new Date().toDateString();
  const deHoy = notifs.filter(n => new Date(n.created_at).toDateString() === hoy);
  const resumen = {
    aceptados:     deHoy.filter(n => n.estado === 'aceptado').length,
    cancelados:    deHoy.filter(n => n.estado === 'cancelado').length,
    sinRespuesta:  deHoy.filter(n => n.estado === 'sin_respuesta').length,
    enviados:      deHoy.filter(n => n.estado === 'enviado').length,
  };
  const noLeidas = notifs.filter(n => !n.leida).length;

  const filtradas = filtro === 'todos' ? notifs : notifs.filter(n => n.estado === filtro);

  const FILTROS: { key: Filtro; label: string; color: string }[] = [
    { key: 'todos',         label: 'Todos',          color: C.textMid },
    { key: 'aceptado',      label: 'Confirmadas',    color: C.green   },
    { key: 'cancelado',     label: 'Canceladas',     color: C.red     },
    { key: 'sin_respuesta', label: 'Sin respuesta',  color: C.amber   },
    { key: 'enviado',       label: 'Enviados',       color: C.blue    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>

      {/* HEADER */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Notificaciones</h2>
            {noLeidas > 0 && (
              <span style={{ background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {noLeidas} nuevas
              </span>
            )}
          </div>
          {noLeidas > 0 && (
            <button onClick={marcarTodasLeidas} disabled={marcandoTodas}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {marcandoTodas ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCheck size={13} />}
              Marcar todas leídas
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: C.textDim, margin: 0 }}>Registro de mensajes WhatsApp</p>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>

        {/* RESUMEN DEL DÍA */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Resumen de hoy</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Confirmadas',   value: resumen.aceptados,    color: C.green, bg: C.greenDim },
              { label: 'Canceladas',    value: resumen.cancelados,   color: C.red,   bg: C.redDim   },
              { label: 'Sin respuesta', value: resumen.sinRespuesta, color: C.amber, bg: C.amberDim },
              { label: 'Enviados',      value: resumen.enviados,     color: C.blue,  bg: C.blueDim  },
            ].map(card => (
              <div key={card.label}
                style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: 10, color: card.color, fontWeight: 600, marginTop: 4, opacity: 0.8 }}>{card.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
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
              {f.key !== 'todos' && (
                <span style={{ marginLeft: 5, opacity: 0.7 }}>
                  {notifs.filter(n => n.estado === f.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.textDim }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ fontSize: 13 }}>Cargando...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Bell size={40} style={{ color: C.textDim, marginBottom: 12, opacity: 0.3 }} />
            <p style={{ color: C.textMid, fontSize: 15 }}>Sin notificaciones</p>
            <p style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Las notificaciones aparecerán aquí cuando se envíen mensajes</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Agrupar por fecha */}
            {(() => {
              const grupos: Record<string, any[]> = {};
              filtradas.forEach(n => {
                const fecha = fmtFecha(n.created_at);
                if (!grupos[fecha]) grupos[fecha] = [];
                grupos[fecha].push(n);
              });
              return Object.entries(grupos).map(([fecha, items]) => (
                <div key={fecha}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.8, padding: '12px 0 6px', textTransform: 'uppercase' }}>{fecha}</p>
                  <div style={{ background: C.panel, borderRadius: 14, overflow: 'hidden' }}>
                    {items.map((n, i) => {
                      const cfg = ESTADO_CFG[n.estado] || ESTADO_CFG.enviado;
                      const Icon = cfg.icon;
                      const nombre = n.clientes?.nombre || 'Cliente desconocido';
                      const tel = n.clientes?.telefono;
                      const horaCita = n.citas?.hora_inicio?.substring(11, 16);
                      return (
                        <div key={n.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '14px 16px',
                            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
                            background: n.leida ? 'transparent' : 'rgba(34,197,94,0.03)',
                            transition: 'background 0.15s',
                          }}>
                          {/* Estado icon */}
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={18} style={{ color: cfg.color }} />
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: n.leida ? 400 : 700, color: C.text }}>{nombre}</span>
                              {!n.leida && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} />}
                              {n.intento === 2 && (
                                <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, background: C.amberDim, padding: '1px 6px', borderRadius: 4 }}>2º aviso</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                              <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                              {horaCita && (
                                <span style={{ fontSize: 11, color: C.textDim, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Calendar size={10} /> Cita a las {horaCita}
                                </span>
                              )}
                              {tel && (
                                <span style={{ fontSize: 11, color: C.textDim, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Phone size={10} /> {tel}
                                </span>
                              )}
                            </div>
                            {n.mensaje && (
                              <p style={{ fontSize: 11, color: C.textDim, marginTop: 4, fontStyle: 'italic' }}>"{n.mensaje}"</p>
                            )}
                          </div>

                          {/* Hora + marcar leída */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: C.textDim }}>{fmtHora(n.created_at)}</span>
                            {!n.leida && (
                              <button onClick={() => marcarLeida(n.id)}
                                style={{ fontSize: 10, color: C.green, background: C.greenDim, border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                                Marcar leída
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
