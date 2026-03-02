'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, TrendingDown, Users, Calendar, DollarSign,
  Clock, BarChart3, Star, AlertTriangle, RefreshCw,
  ChevronDown, Award, Target, Zap
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
    <div style={{ background: C.panel, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</span>
        {Icon && <Icon size={16} style={{ color, opacity: 0.6 }} />}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textDim }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {trend >= 0
            ? <TrendingUp size={12} style={{ color: C.green }} />
            : <TrendingDown size={12} style={{ color: C.red }} />}
          <span style={{ fontSize: 11, color: trend >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {trend >= 0 ? '+' : ''}{trend}% vs período anterior
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
        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

  // Rango de fechas
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

  // Rango anterior (para tendencias)
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

  // Precio efectivo de una cita
  function precioEfectivo(cita: any): number | null {
    if (cita.importar && parseFloat(cita.importar) > 0) return parseFloat(cita.importar);
    if (cita.servicios?.precio && parseFloat(cita.servicios.precio) > 0) return parseFloat(cita.servicios.precio);
    return null;
  }

  // KPIs generales
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

  // Clientes nuevos vs recurrentes
  const clientesEnPeriodo = new Set(citasPeriodo.map(c => c.cliente_id).filter(Boolean));
  const clientesNuevos = clientes.filter(c => {
    const creado = new Date(c.created_at);
    return creado >= desde && creado <= hasta;
  }).length;
  const clientesRecurrentes = Array.from(clientesEnPeriodo).filter(id => {
    const citasCliente = citas.filter(c => c.cliente_id === id);
    return citasCliente.length > 1;
  }).length;

  // Servicios más solicitados
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

  // Hora punta
  const horaCount: Record<number, number> = {};
  citasPeriodo.forEach(c => {
    if (!c.hora_inicio) return;
    const h = new Date(c.hora_inicio).getHours();
    horaCount[h] = (horaCount[h] || 0) + 1;
  });
  const maxHora = Math.max(...Object.values(horaCount), 1);
  const horaPunta = Object.entries(horaCount).sort((a, b) => b[1] - a[1])[0];

  // Evolución mensual (últimos 6 meses)
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

  // Stats por empleado
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

  // Ranking clientes
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
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: '90d', label: '3 meses' },
    { key: '365d', label: '1 año' },
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
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Estadísticas</h2>
            <p style={{ fontSize: 12, color: C.textDim, margin: '2px 0 0' }}>Panel de análisis del negocio</p>
          </div>
          {/* Filtro período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: C.panelAlt, borderRadius: 10, padding: 3, gap: 2 }}>
              {PERIODOS.map(p => (
                <button key={p.key} onClick={() => { setPeriodo(p.key); setUsandoCustom(false); }}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: !usandoCustom && periodo === p.key ? C.green : 'transparent', color: !usandoCustom && periodo === p.key ? '#fff' : C.textMid, transition: 'all 0.12s' }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Custom range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={fechaCustomDesde} onChange={e => setFechaCustomDesde(e.target.value)}
                style={{ padding: '6px 10px', background: C.panelAlt, border: `1px solid ${usandoCustom ? C.green + '55' : C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
              <span style={{ color: C.textDim, fontSize: 12 }}>—</span>
              <input type="date" value={fechaCustomHasta} onChange={e => setFechaCustomHasta(e.target.value)}
                style={{ padding: '6px 10px', background: C.panelAlt, border: `1px solid ${usandoCustom ? C.green + '55' : C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
              <button onClick={() => { if (fechaCustomDesde && fechaCustomHasta) setUsandoCustom(true); }}
                disabled={!fechaCustomDesde || !fechaCustomHasta}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !fechaCustomDesde || !fechaCustomHasta ? 0.5 : 1 }}>
                Aplicar
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? C.green + '20' : 'transparent', color: tab === t.key ? C.green : C.textMid, borderBottom: tab === t.key ? `2px solid ${C.green}` : '2px solid transparent', transition: 'all 0.12s' }}>
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* ── TAB GENERAL ── */}
        {tab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* KPIs fila 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <KPI label="Total citas" value={totalCitas} icon={Calendar} color={C.blue}
                trend={tendencia(totalCitas, citasAnt.length)} sub={`${citasCompletadas} completadas`} />
              <KPI label="Ingresos período"
                value={citasConPrecio > 0 ? `${ingresosPeriodo.toFixed(0)}€` : '—'}
                icon={DollarSign} color={C.green}
                trend={ingresosAnt > 0 ? tendencia(ingresosPeriodo, ingresosAnt) : undefined}
                sub={citasConPrecio > 0 ? `Ticket medio ${ticketMedio.toFixed(0)}€` : 'Sin precios registrados'} />
              <KPI label="Tasa cancelación" value={`${tasaCancelacion}%`} icon={AlertTriangle}
                color={tasaCancelacion > 20 ? C.red : tasaCancelacion > 10 ? C.amber : C.green}
                sub={`${citasCanceladas} canceladas · ${noShows} no-shows`} />
              <KPI label="Clientes activos" value={clientesEnPeriodo.size} icon={Users} color={C.purple}
                sub={`${clientesNuevos} nuevos · ${clientesRecurrentes} recurrentes`} />
            </div>

            {/* Evolución + Hora punta */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>

              {/* Evolución mensual */}
              <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Evolución mensual — últimos 6 meses</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                  {evolucion.map((e, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>{e.citas}</span>
                      <div style={{ width: '100%', height: `${Math.max((e.citas / maxEv) * 90, e.citas > 0 ? 4 : 0)}px`, background: i === evolucion.length - 1 ? C.green : C.blue + '88', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease', minHeight: e.citas > 0 ? 4 : 0 }} />
                      <span style={{ fontSize: 10, color: C.textDim }}>{e.label}</span>
                    </div>
                  ))}
                </div>
                {evolucion.some(e => e.ingresos > 0) && (
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
                    {evolucion.map((e, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>{e.ingresos > 0 ? `${e.ingresos.toFixed(0)}€` : '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hora punta */}
              <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Hora punta</p>
                {horaPunta ? (
                  <>
                    <div style={{ fontSize: 36, fontWeight: 800, color: C.amber, marginBottom: 4 }}>{horaPunta[0]}:00</div>
                    <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>{horaPunta[1]} citas en este horario</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>Sin datos</div>
                )}
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
              </div>
            </div>

            {/* Nuevos vs recurrentes */}
            <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Clientes nuevos vs recurrentes</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { label: 'Clientes únicos en período', value: clientesEnPeriodo.size, color: C.blue   },
                  { label: 'Clientes nuevos',            value: clientesNuevos,         color: C.green  },
                  { label: 'Clientes recurrentes',       value: clientesRecurrentes,    color: C.purple },
                ].map(s => (
                  <div key={s.label} style={{ background: C.panelAlt, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{s.label}</div>
                    {clientesEnPeriodo.size > 0 && (
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginTop: 4 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {statsEmpleados.length === 0 ? (
                <p style={{ color: C.textDim, fontSize: 13 }}>No hay empleados activos</p>
              ) : statsEmpleados.map((emp, i) => (
                <div key={emp.id} style={{ background: C.panel, borderRadius: 16, padding: 20, border: i === 0 ? `1px solid ${C.green}33` : `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: emp.color || C.panelAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {emp.nombre?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{emp.nombre}</span>
                        {i === 0 && <Award size={14} style={{ color: C.amber }} />}
                      </div>
                      <span style={{ fontSize: 11, color: C.textDim }}>{emp.rol || 'Empleado'}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{emp.citas}</div>
                      <div style={{ fontSize: 10, color: C.textDim }}>citas</div>
                    </div>
                  </div>
                  <BarraHorizontal label="Citas" value={emp.citas} max={maxEmpCitas} color={C.blue} />
                  <BarraHorizontal label="Ingresos" value={emp.ingresos > 0 ? `${emp.ingresos.toFixed(0)}€` : '—'} max={statsEmpleados[0]?.ingresos || 1} color={C.green} />
                  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <div style={{ flex: 1, background: C.redDim, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{emp.canceladas}</div>
                      <div style={{ fontSize: 10, color: C.textDim }}>canceladas</div>
                    </div>
                    <div style={{ flex: 1, background: C.amberDim, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{emp.noshow}</div>
                      <div style={{ fontSize: 10, color: C.textDim }}>no-shows</div>
                    </div>
                    <div style={{ flex: 1, background: C.greenDim, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>
                        {emp.citas > 0 ? `${Math.round(((emp.citas - emp.canceladas - emp.noshow) / emp.citas) * 100)}%` : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim }}>asistencia</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB CLIENTES ── */}
        {tab === 'clientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
                Top 10 clientes · {rankingClientes.length} con actividad en período
              </p>
              {rankingClientes.length === 0 ? (
                <p style={{ color: C.textDim, fontSize: 13 }}>Sin datos en este período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {rankingClientes.map((cl, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: i < 3 ? C.panelAlt : 'transparent', borderRadius: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? C.amber + '33' : i === 1 ? C.textDim + '22' : i === 2 ? C.amber + '18' : C.panelAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: i === 0 ? C.amber : C.textDim, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: C.green, flexShrink: 0 }}>
                        {cl.nombre[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cl.nombre}</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>
                          Última visita: {cl.ultimaVisita ? new Date(cl.ultimaVisita).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{cl.citas}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>citas</div>
                      </div>
                      {cl.ingresos > 0 && (
                        <div style={{ textAlign: 'right', minWidth: 60 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{cl.ingresos.toFixed(0)}€</div>
                          <div style={{ fontSize: 10, color: C.textDim }}>ingresos</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Servicios más solicitados</p>
              {topServicios.length === 0 ? (
                <p style={{ color: C.textDim, fontSize: 13 }}>Sin datos en este período</p>
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

            {/* Catálogo con precios */}
            <div style={{ background: C.panel, borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Catálogo de servicios</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {servicios.map(s => (
                  <div key={s.id} style={{ background: C.panelAlt, borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${s.color || C.green}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{s.nombre}</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {s.precio ? <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{s.precio}€</span> : <span style={{ fontSize: 11, color: C.textDim }}>Sin precio</span>}
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
