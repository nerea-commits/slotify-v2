'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, TrendingDown, Users, Calendar, DollarSign,
  Clock, BarChart3, Star, AlertTriangle, RefreshCw,
  ChevronDown, Award, Target, Zap, ChevronLeft, ChevronRight
} from 'lucide-react';

const C = {
  bg: '#0B0F1A', panel: '#111827', panelAlt: '#1A2332', panelB: '#1E293B',
  green: '#22C55E', greenDim: 'rgba(34,197,94,0.10)',
  red: '#EF4444', redDim: 'rgba(239,68,68,0.08)',
  amber: '#F59E0B', amberDim: 'rgba(245,158,11,0.08)',
  blue: '#3B82F6', blueDim: 'rgba(59,130,246,0.08)',
  purple: '#A855F7', purpleDim: 'rgba(168,85,247,0.08)',
  text: '#F1F5F9', textMid: '#94A3B8', textDim: '#4B5563',
  border: 'rgba(148,163,184,0.08)',
};

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const HORAS = Array.from({length: 14}, (_, i) => `${(i + 7).toString().padStart(2,'0')}:00`);

type Periodo = '7d' | '30d' | '90d' | '365d';
type Tab = 'general' | 'empleados' | 'clientes' | 'servicios';

function KPI({ label, value, sub, color = C.text, icon: Icon, trend }: any) {
  return (
    <div style={{ background: C.panel, borderRadius: 14, padding: '14px 16px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 0.8, textTransform: 'uppercase', lineHeight: 1.3 }}>{label}</span>
        {Icon && <Icon size={14} style={{ color, opacity: 0.6, flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginBottom: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.3 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
          {trend >= 0
            ? <TrendingUp size={11} style={{ color: C.green }} />
            : <TrendingDown size={11} style={{ color: C.red }} />}
          <span style={{ fontSize: 10, color: trend >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        </div>
      )}
    </div>
  );
}

function BarraHorizontal({ label, value, max, color, sub }: any) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {sub && <span style={{ fontSize: 11, color: C.textDim }}>{sub}</span>}
          <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value}</span>
        </div>
      </div>
      <div style={{ height: 6, background: 'rgba(148,163,184,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function EstadisticasSection({ empresaId }: { empresaId: string }) {
  const [citas, setCitas] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [profesionales, setProfesionales] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [tab, setTab] = useState<Tab>('general');
  const [fechaCustomDesde, setFechaCustomDesde] = useState('');
  const [fechaCustomHasta, setFechaCustomHasta] = useState('');
  const [usandoCustom, setUsandoCustom] = useState(false);
  const [mostrarCustom, setMostrarCustom] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { if (empresaId) load(); }, [empresaId]);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: s }, { data: p }, { data: cl }] = await Promise.all([
      supabase.from('citas').select('*, servicios(nombre, precio, duracion_minutos), clientes(nombre)').eq('empresa_id', empresaId).order('hora_inicio'),
      supabase.from('servicios').select('*').eq('empresa_id', empresaId).eq('activo', true),
      supabase.from('profesionales').select('*').eq('empresa_id', empresaId).eq('activo', true),
      supabase.from('clientes').select('id, nombre, created_at').eq('empresa_id', empresaId),
    ]);
    setCitas(c || []);
    setServicios(s || []);
    setProfesionales(p || []);
    setClientes(cl || []);
    setLoading(false);
  }

  const { desde, hasta } = useMemo(() => {
    if (usandoCustom && fechaCustomDesde && fechaCustomHasta) {
      return { desde: new Date(fechaCustomDesde), hasta: new Date(fechaCustomHasta + 'T23:59:59') };
    }
    const hasta = new Date();
    const desde = new Date();
    const dias = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[periodo];
    desde.setDate(hasta.getDate() - dias);
    return { desde, hasta };
  }, [periodo, usandoCustom, fechaCustomDesde, fechaCustomHasta]);

  const { desdeAnterior, hastaAnterior } = useMemo(() => {
    const diff = hasta.getTime() - desde.getTime();
    return { desdeAnterior: new Date(desde.getTime() - diff), hastaAnterior: new Date(desde) };
  }, [desde, hasta]);

  function enRango(cita: any, d: Date, h: Date) {
    const t = new Date(cita.hora_inicio);
    return t >= d && t <= h;
  }

  const citasPeriodo = useMemo(() => citas.filter(c => enRango(c, desde, hasta)), [citas, desde, hasta]);
  const citasAnt = useMemo(() => citas.filter(c => enRango(c, desdeAnterior, hastaAnterior)), [citas, desdeAnterior, hastaAnterior]);

  function tendencia(actual: number, anterior: number) {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return Math.round(((actual - anterior) / anterior) * 100);
  }

  function precioEfectivo(cita: any): number | null {
    if (cita.importar && parseFloat(cita.importar) > 0) return parseFloat(cita.importar);
    if (cita.servicios?.precio && parseFloat(cita.servicios.precio) > 0) return parseFloat(cita.servicios.precio);
    return null;
  }

  const totalCitas = citasPeriodo.length;
  const citasCompletadas = citasPeriodo.filter(c => (c.estado || '').toLowerCase() === 'completada').length;
  const citasCanceladas = citasPeriodo.filter(c => (c.estado || '').toLowerCase() === 'cancelada').length;
  const noShows = citasPeriodo.filter(c => (c.estado || '').toLowerCase().includes('no') && (c.estado || '').toLowerCase().includes('show')).length;

  const ingresosArr = citasPeriodo.map(precioEfectivo).filter(p => p !== null) as number[];
  const ingresosPeriodo = ingresosArr.reduce((a, b) => a + b, 0);
  const ingresosAntArr = citasAnt.map(precioEfectivo).filter(p => p !== null) as number[];
  const ingresosAnt = ingresosAntArr.reduce((a, b) => a + b, 0);
  const citasConPrecio = ingresosArr.length;
  const ticketMedio = citasConPrecio > 0 ? ingresosPeriodo / citasConPrecio : 0;

  const tasaCancelacion = totalCitas > 0 ? Math.round((citasCanceladas / totalCitas) * 100) : 0;
  const tasaNoShow = totalCitas > 0 ? Math.round((noShows / totalCitas) * 100) : 0;

  const clientesEnPeriodo = new Set(citasPeriodo.map(c => c.cliente_id).filter(Boolean));
  const clientesNuevos = clientes.filter(c => {
    const creado = new Date(c.created_at);
    return creado >= desde && creado <= hasta;
  }).length;
  const clientesRecurrentes = Array.from(clientesEnPeriodo).filter(id => {
    const citasCliente = citas.filter(c => c.cliente_id === id);
    return citasCliente.length > 1;
  }).length;

  const serviciosCount: Record<string, { nombre: string; count: number; ingresos: number }> = {};
  citasPeriodo.forEach(c => {
    const nombre = c.servicios?.nombre || c.servicio_nombre_libre || 'Sin servicio';
    if (!serviciosCount[nombre]) serviciosCount[nombre] = { nombre, count: 0, ingresos: 0 };
    serviciosCount[nombre].count++;
    const p = precioEfectivo(c);
    if (p) serviciosCount[nombre].ingresos += p;
  });
  const topServicios = Object.values(serviciosCount).sort((a, b) => b.count - a.count).slice(0, 8);
  const maxServicio = topServicios[0]?.count || 1;

  const horaCount: Record<number, number> = {};
  citasPeriodo.forEach(c => {
    if (!c.hora_inicio) return;
    const h = new Date(c.hora_inicio).getHours();
    horaCount[h] = (horaCount[h] || 0) + 1;
  });
  const maxHora = Math.max(...Object.values(horaCount), 1);
  const horaPunta = Object.entries(horaCount).sort((a, b) => b[1] - a[1])[0];

  const evolucion = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      const mes = d.getMonth();
      const año = d.getFullYear();
      const del = citas.filter(c => {
        const cd = new Date(c.hora_inicio);
        return cd.getMonth() === mes && cd.getFullYear() === año;
      });
      const ing = del.map(precioEfectivo).filter(Boolean).reduce((a: number, b: any) => a + b, 0);
      return { label: MESES[mes], citas: del.length, ingresos: ing };
    });
  }, [citas]);
  const maxEv = Math.max(...evolucion.map(e => e.citas), 1);

  const statsEmpleados = useMemo(() => {
    return profesionales.map(p => {
      const mias = citasPeriodo.filter(c => c.id_profesional === p.id);
      const ing = mias.map(precioEfectivo).filter(Boolean).reduce((a: number, b: any) => a + b, 0);
      const canceladas = mias.filter(c => (c.estado || '').toLowerCase() === 'cancelada').length;
      const noshow = mias.filter(c => (c.estado || '').toLowerCase().includes('no') && (c.estado || '').toLowerCase().includes('show')).length;
      return { ...p, citas: mias.length, ingresos: ing, canceladas, noshow };
    }).sort((a, b) => b.citas - a.citas);
  }, [profesionales, citasPeriodo]);
  const maxEmpCitas = statsEmpleados[0]?.citas || 1;

  const rankingClientes = useMemo(() => {
    const map: Record<string, { nombre: string; citas: number; ingresos: number; ultimaVisita: string }> = {};
    citasPeriodo.forEach(c => {
      const id = c.cliente_id || c.cliente_nombre_libre || 'anon';
      const nombre = c.clientes?.nombre || c.cliente_nombre_libre || 'Anónimo';
      if (!map[id]) map[id] = { nombre, citas: 0, ingresos: 0, ultimaVisita: '' };
      map[id].citas++;
      const p = precioEfectivo(c);
      if (p) map[id].ingresos += p;
      if (!map[id].ultimaVisita || c.hora_inicio > map[id].ultimaVisita) map[id].ultimaVisita = c.hora_inicio;
    });
    return Object.values(map).sort((a, b) => b.citas - a.citas).slice(0, 10);
  }, [citasPeriodo]);

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '3m' },
    { key: '365d', label: '1a' },
  ];

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'general',   label: 'General',   icon: BarChart3 },
    { key: 'empleados', label: 'Empleados', icon: Users     },
    { key: 'clientes',  label: 'Clientes',  icon: Star      },
    { key: 'servicios', label: 'Servicios', icon: Zap       },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, background: C.bg }}>
      <RefreshCw size={24} style={{ color: C.green, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: isMobile ? '12px 14px 0' : '16px 24px 0' }}>

        {/* Fila 1: título + filtros período */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
          <div>
            <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, margin: 0 }}>Estadísticas</h2>
            {!isMobile && <p style={{ fontSize: 12, color: C.textDim, margin: '2px 0 0' }}>Panel de análisis del negocio</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Selector período */}
            <div style={{ display: 'flex', background: C.panelAlt, borderRadius: 10, padding: 3, gap: 2 }}>
              {PERIODOS.map(p => (
                <button key={p.key} onClick={() => { setPeriodo(p.key); setUsandoCustom(false); }}
                  style={{ padding: isMobile ? '5px 10px' : '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: !usandoCustom && periodo === p.key ? C.green : 'transparent', color: !usandoCustom && periodo === p.key ? '#fff' : C.textMid, transition: 'all 0.12s' }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Botón rango custom — en móvil solo icono */}
            <button onClick={() => setMostrarCustom(v => !v)}
              style={{ padding: isMobile ? '6px 8px' : '6px 12px', borderRadius: 8, border: `1px solid ${usandoCustom ? C.green + '55' : C.border}`, background: usandoCustom ? C.green + '10' : 'transparent', color: usandoCustom ? C.green : C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
              <Calendar size={14} />
              {!isMobile && 'Rango'}
              <ChevronDown size={11} style={{ transform: mostrarCustom ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
            </button>
          </div>
        </div>

        {/* Panel rango custom expandible */}
        {mostrarCustom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, flexWrap: 'wrap' }}>
            <input type="date" value={fechaCustomDesde} onChange={e => setFechaCustomDesde(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: '7px 10px', background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
            <span style={{ color: C.textDim, fontSize: 12, flexShrink: 0 }}>—</span>
            <input type="date" value={fechaCustomHasta} onChange={e => setFechaCustomHasta(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: '7px 10px', background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
            <button onClick={() => { if (fechaCustomDesde && fechaCustomHasta) { setUsandoCustom(true); setMostrarCustom(false); } }}
              disabled={!fechaCustomDesde || !fechaCustomHasta}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !fechaCustomDesde || !fechaCustomHasta ? 0.5 : 1, flexShrink: 0 }}>
              Aplicar
            </button>
          </div>
        )}

        {/* Tabs — scroll horizontal en móvil */}
        <div style={{ display: 'flex', gap: isMobile ? 0 : 4, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: isMobile ? 0 : 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', color: isActive ? C.green : C.textMid, borderBottom: isActive ? `2px solid ${C.green}` : '2px solid transparent', transition: 'all 0.12s', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ padding: isMobile ? '14px 12px' : '20px 24px', paddingBottom: 80 }}>

        {/* ── TAB GENERAL ── */}
        {tab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 20 }}>

            {/* KPIs — 2x2 en móvil, 4 en línea en desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 12 }}>
              <KPI label="Total citas" value={totalCitas} icon={Calendar} color={C.blue}
                trend={tendencia(totalCitas, citasAnt.length)} sub={`${citasCompletadas} completadas`} />
              <KPI label="Ingresos"
                value={citasConPrecio > 0 ? `${ingresosPeriodo.toFixed(0)}€` : '—'}
                icon={DollarSign} color={C.green}
                trend={ingresosAnt > 0 ? tendencia(ingresosPeriodo, ingresosAnt) : undefined}
                sub={citasConPrecio > 0 ? `~${ticketMedio.toFixed(0)}€/cita` : 'Sin precios'} />
              <KPI label="Cancelación" value={`${tasaCancelacion}%`} icon={AlertTriangle}
                color={tasaCancelacion > 20 ? C.red : tasaCancelacion > 10 ? C.amber : C.green}
                sub={`${citasCanceladas} cancel. · ${noShows} no-show`} />
              <KPI label="Clientes activos" value={clientesEnPeriodo.size} icon={Users} color={C.purple}
                sub={`${clientesNuevos} nuevos · ${clientesRecurrentes} recur.`} />
            </div>

            {/* Evolución mensual */}
            <div style={{ background: C.panel, borderRadius: 16, padding: isMobile ? '14px 12px' : 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Evolución — últimos 6 meses</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 6 : 8, height: isMobile ? 90 : 120 }}>
                {evolucion.map((e, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: isMobile ? 9 : 10, color: C.textDim, fontWeight: 600 }}>{e.citas}</span>
                    <div style={{ width: '100%', height: `${Math.max((e.citas / maxEv) * 90, e.citas > 0 ? 4 : 0)}%`, background: i === evolucion.length - 1 ? C.green : C.blue + '88', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease', minHeight: e.citas > 0 ? 4 : 0 }} />
                    <span style={{ fontSize: isMobile ? 9 : 10, color: C.textDim }}>{e.label}</span>
                  </div>
                ))}
              </div>
              {evolucion.some(e => e.ingresos > 0) && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: isMobile ? 6 : 8 }}>
                  {evolucion.map((e, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: isMobile ? 9 : 10, color: C.green, fontWeight: 700 }}>{e.ingresos > 0 ? `${e.ingresos.toFixed(0)}€` : '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hora punta — en móvil va sola a ancho completo, en desktop al lado de evolución */}
            <div style={{ background: C.panel, borderRadius: 16, padding: isMobile ? '14px 12px' : 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Hora punta</p>
              {horaPunta ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: C.amber }}>{horaPunta[0]}:00</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>{horaPunta[1]} citas en este horario</div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.textDim, marginBottom: 14 }}>Sin datos</div>
              )}
              {/* En móvil, barras más compactas en 2 columnas */}
              {isMobile ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                  {HORAS.map(h => {
                    const hora = parseInt(h);
                    const count = horaCount[hora] || 0;
                    return (
                      <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: C.textDim, width: 28, flexShrink: 0 }}>{h}</span>
                        <div style={{ flex: 1, height: 5, background: 'rgba(148,163,184,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(count / maxHora) * 100}%`, background: count === maxHora ? C.amber : C.blue + '88', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 9, color: C.textDim, width: 12, textAlign: 'right' }}>{count || ''}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {HORAS.map(h => {
                    const hora = parseInt(h);
                    const count = horaCount[hora] || 0;
                    return (
                      <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: C.textDim, width: 32, flexShrink: 0 }}>{h}</span>
                        <div style={{ flex: 1, height: 6, background: 'rgba(148,163,184,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(count / maxHora) * 100}%`, background: count === maxHora ? C.amber : C.blue + '88', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10, color: C.textDim, width: 16, textAlign: 'right' }}>{count || ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clientes nuevos vs recurrentes */}
            <div style={{ background: C.panel, borderRadius: 16, padding: isMobile ? '14px 12px' : 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Clientes nuevos vs recurrentes</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 8 : 16 }}>
                {[
                  { label: 'Únicos en período', value: clientesEnPeriodo.size, color: C.blue   },
                  { label: 'Nuevos',            value: clientesNuevos,         color: C.green  },
                  { label: 'Recurrentes',       value: clientesRecurrentes,    color: C.purple },
                ].map(s => (
                  <div key={s.label} style={{ background: C.panelAlt, borderRadius: 12, padding: isMobile ? '10px 8px' : '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: isMobile ? 9 : 11, color: C.textDim, marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
                    {clientesEnPeriodo.size > 0 && (
                      <div style={{ fontSize: 10, color: s.color, fontWeight: 700, marginTop: 3 }}>
                        {Math.round((s.value / clientesEnPeriodo.size) * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB EMPLEADOS ── */}
        {tab === 'empleados' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {statsEmpleados.length === 0 ? (
              <p style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 40 }}>No hay empleados activos</p>
            ) : (
              // En móvil: apilados. En desktop: grid auto-fill
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {statsEmpleados.map((emp, i) => (
                  <div key={emp.id} style={{ background: C.panel, borderRadius: 16, padding: isMobile ? '14px 12px' : 20, border: i === 0 ? `1px solid ${C.green}33` : `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: emp.color || C.panelAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {emp.nombre?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.nombre}</span>
                          {i === 0 && <Award size={13} style={{ color: C.amber, flexShrink: 0 }} />}
                        </div>
                        <span style={{ fontSize: 11, color: C.textDim }}>{emp.rol || 'Empleado'}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{emp.citas}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>citas</div>
                      </div>
                    </div>
                    <BarraHorizontal label="Citas" value={emp.citas} max={maxEmpCitas} color={C.blue} />
                    <BarraHorizontal label="Ingresos" value={emp.ingresos > 0 ? `${emp.ingresos.toFixed(0)}€` : '—'} max={statsEmpleados[0]?.ingresos || 1} color={C.green} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <div style={{ flex: 1, background: C.redDim, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.red }}>{emp.canceladas}</div>
                        <div style={{ fontSize: 9, color: C.textDim }}>cancel.</div>
                      </div>
                      <div style={{ flex: 1, background: C.amberDim, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.amber }}>{emp.noshow}</div>
                        <div style={{ fontSize: 9, color: C.textDim }}>no-show</div>
                      </div>
                      <div style={{ flex: 1, background: C.greenDim, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>
                          {emp.citas > 0 ? `${Math.round(((emp.citas - emp.canceladas - emp.noshow) / emp.citas) * 100)}%` : '—'}
                        </div>
                        <div style={{ fontSize: 9, color: C.textDim }}>asist.</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CLIENTES ── */}
        {tab === 'clientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: C.panel, borderRadius: 16, padding: isMobile ? '14px 12px' : 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
                Top clientes · {rankingClientes.length} activos en período
              </p>
              {rankingClientes.length === 0 ? (
                <p style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 20 }}>Sin datos en este período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {rankingClientes.map((cl, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, padding: isMobile ? '10px 10px' : '12px 14px', background: i < 3 ? C.panelAlt : 'transparent', borderRadius: 10 }}>
                      {/* Posición */}
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: i === 0 ? C.amber + '33' : i === 1 ? C.textDim + '22' : i === 2 ? C.amber + '18' : C.panelAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: i === 0 ? C.amber : C.textDim, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      {/* Avatar */}
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.green, flexShrink: 0 }}>
                        {cl.nombre[0].toUpperCase()}
                      </div>
                      {/* Nombre */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.nombre}</div>
                        {!isMobile && (
                          <div style={{ fontSize: 11, color: C.textDim }}>
                            Última: {cl.ultimaVisita ? new Date(cl.ultimaVisita).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                          </div>
                        )}
                      </div>
                      {/* Citas */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: C.blue }}>{cl.citas}</div>
                        <div style={{ fontSize: 9, color: C.textDim }}>citas</div>
                      </div>
                      {/* Ingresos — solo si tiene y hay espacio */}
                      {cl.ingresos > 0 && (
                        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: isMobile ? 44 : 56 }}>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: C.green }}>{cl.ingresos.toFixed(0)}€</div>
                          {!isMobile && <div style={{ fontSize: 9, color: C.textDim }}>ingresos</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB SERVICIOS ── */}
        {tab === 'servicios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: C.panel, borderRadius: 16, padding: isMobile ? '14px 12px' : 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Servicios más solicitados</p>
              {topServicios.length === 0 ? (
                <p style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 20 }}>Sin datos en este período</p>
              ) : topServicios.map((s, i) => (
                <BarraHorizontal
                  key={i}
                  label={s.nombre}
                  value={s.count}
                  max={maxServicio}
                  color={i === 0 ? C.green : i === 1 ? C.blue : i === 2 ? C.purple : C.textMid}
                  sub={s.ingresos > 0 ? `${s.ingresos.toFixed(0)}€` : undefined}
                />
              ))}
            </div>

            {/* Catálogo — 1 columna en móvil, auto-fill en desktop */}
            <div style={{ background: C.panel, borderRadius: 16, padding: isMobile ? '14px 12px' : 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Catálogo de servicios</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {servicios.map(s => (
                  <div key={s.id} style={{ background: C.panelAlt, borderRadius: 10, padding: '11px 14px', borderLeft: `3px solid ${s.color || C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.nombre}</div>
                    <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                      {s.precio ? <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{s.precio}€</span> : null}
                      {s.duracion_minutos && <span style={{ fontSize: 11, color: C.textDim }}>{s.duracion_minutos}min</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
