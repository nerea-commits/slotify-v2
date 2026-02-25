'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Phone, Mail, FileText, ChevronRight, ArrowLeft, Trash2, Edit2, Check, Calendar, MessageCircle } from 'lucide-react';

const C = {
  bg: '#0B0F1A',
  panel: '#111827',
  panelAlt: '#1A2332',
  accent: '#22C55E',
  accentDim: 'rgba(34,197,94,0.15)',
  red: '#EF4444',
  redDim: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B',
  amberDim: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.12)',
  purple: '#A855F7',
  text: '#F1F5F9',
  textMid: '#94A3B8',
  textDim: '#4B5563',
  divider: 'rgba(148,163,184,0.06)',
  gridLine: 'rgba(148,163,184,0.05)',
};

interface Cliente { id: string; nombre: string; telefono?: string; email?: string; notas?: string; created_at?: string; }
interface FormCliente { nombre: string; telefono: string; email: string; notas: string; }

// ═══════════════════════════════════════════════
// SCORE RING — large, analytical, protagonist
// ═══════════════════════════════════════════════
function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? C.accent : score >= 40 ? C.amber : C.red;
  const label = score >= 70 ? 'FIEL' : score >= 40 ? 'EN RIESGO' : 'INACTIVO';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
        <span style={{ fontSize: 10, color: C.textMid, fontWeight: 700, letterSpacing: 1.5, marginTop: 4 }}>{label}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// BAR CHART — real SVG with grid, axes, labels
// ═══════════════════════════════════════════════
function ActivityChart({ citas }: { citas: any[] }) {
  const data = useMemo(() => {
    const now = new Date();
    const result: { label: string; count: number; isCurrent: boolean }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(); const m = d.getMonth();
      const count = citas.filter(c => {
        if (!c.hora_inicio) return false;
        const cd = new Date(c.hora_inicio);
        return cd.getFullYear() === y && cd.getMonth() === m && c.estado !== 'cancelada';
      }).length;
      result.push({
        label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase(),
        count, isCurrent: i === 0,
      });
    }
    return result;
  }, [citas]);

  const max = Math.max(...data.map(d => d.count), 1);
  const W = 460; const H = 160;
  const padL = 30; const padR = 10; const padT = 14; const padB = 26;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = chartW / data.length;
  const barInner = barW * 0.5;

  const ticks: number[] = [];
  const step = max <= 4 ? 1 : max <= 10 ? 2 : 5;
  for (let t = 0; t <= max; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] < max) ticks.push(max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map(t => {
        const y = padT + chartH - (t / max) * chartH;
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke={C.gridLine} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fill={C.textDim} fontSize={9} fontFamily="system-ui">{t}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + i * barW + (barW - barInner) / 2;
        const barH = d.count === 0 ? 2 : (d.count / max) * chartH;
        const y = padT + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barInner} height={barH} rx={3}
              fill={d.isCurrent ? C.accent : 'rgba(34,197,94,0.35)'}
              style={{ transition: 'height 0.4s ease, y 0.4s ease' }} />
            {d.count > 0 && (
              <text x={x + barInner / 2} y={y - 5} textAnchor="middle" fill={d.isCurrent ? C.accent : C.textMid}
                fontSize={10} fontWeight={700} fontFamily="system-ui">{d.count}</text>
            )}
            <text x={x + barInner / 2} y={H - 6} textAnchor="middle"
              fill={d.isCurrent ? C.text : C.textDim} fontSize={9} fontWeight={d.isCurrent ? 700 : 400} fontFamily="system-ui">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════
// KPI BLOCK — flat BI metric
// ═══════════════════════════════════════════════
function KPI({ value, label, color, sub }: { value: string | number; label: string; color: string; sub?: string }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: C.textDim, fontWeight: 500 }}>{sub}</span>}
      </div>
      <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TIMELINE DOT
// ═══════════════════════════════════════════════
function TimelineDot({ cita, isLast }: { cita: any; isLast: boolean }) {
  const color = cita.estado === 'cancelada' ? C.textDim
    : (cita.estado === 'no-show' || cita.estado === 'no_show') ? C.red : C.accent;
  const fecha = new Date(cita.hora_inicio);
  const hoy = new Date();
  const diff = Math.floor((hoy.getTime() - fecha.getTime()) / 86400000);
  const fechaStr = diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : diff < 7 ? `Hace ${diff}d`
    : diff < 30 ? `Hace ${Math.floor(diff / 7)}sem` : fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const servicio = cita.servicios?.nombre || cita.servicio_nombre_libre || 'Servicio';
  const hora = cita.hora_inicio?.substring(11, 16);

  return (
    <div style={{ display: 'flex', gap: 10, minHeight: 36 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 10, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
        {!isLast && <div style={{ flex: 1, width: 1, background: C.divider, marginTop: 3 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{servicio}</span>
          <span style={{ fontSize: 10, color: C.textDim }}>{hora}</span>
          <span style={{ fontSize: 10, color: C.textDim }}>{fechaStr}</span>
        </div>
        {(cita.estado === 'cancelada' || cita.estado === 'no-show' || cita.estado === 'no_show') && (
          <span style={{ fontSize: 10, color: cita.estado === 'cancelada' ? C.textDim : C.red, fontWeight: 600 }}>
            {cita.estado === 'cancelada' ? 'CANCELADA' : 'NO-SHOW'}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL (unchanged)
// ═══════════════════════════════════════════════
function ModalCliente({ editando, form, setForm, guardando, error, onGuardar, onCerrar }:
  { editando: boolean; form: FormCliente; setForm: React.Dispatch<React.SetStateAction<FormCliente>>; guardando: boolean; error: string; onGuardar: () => void; onCerrar: () => void; }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onCerrar}>
      <div style={{ background: C.panel, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 500, paddingBottom: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editando ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMid }}><X className="w-5 h-5" /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'NOMBRE *', type: 'text', key: 'nombre', ph: 'Nombre del cliente' },
            { label: 'TELÉFONO', type: 'tel', key: 'telefono', ph: '600 000 000' },
            { label: 'EMAIL', type: 'email', key: 'email', ph: 'email@ejemplo.com' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, color: C.textMid, fontWeight: 600, display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', background: C.panelAlt, border: `1px solid ${C.divider}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, color: C.textMid, fontWeight: 600, display: 'block', marginBottom: 6 }}>NOTAS</label>
            <textarea placeholder="Alergias, preferencias..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={3} style={{ width: '100%', padding: '12px 14px', background: C.panelAlt, border: `1px solid ${C.divider}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: C.red, fontSize: 13 }}>{error}</p>}
          <button onClick={onGuardar} disabled={guardando}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: C.accent, color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, opacity: guardando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {guardando ? 'Guardando...' : (<><Check className="w-4 h-4" />{editando ? 'Guardar cambios' : 'Crear cliente'}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function ClientesSection({ empresaId }: { empresaId: string }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [vistaDetalle, setVistaDetalle] = useState<Cliente | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historialCitas, setHistorialCitas] = useState<any[]>([]);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [form, setForm] = useState<FormCliente>({ nombre: '', telefono: '', email: '', notas: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // ─── ANALYTICS ───
  const analytics = useMemo(() => {
    if (historialCitas.length === 0) return null;
    const ahora = new Date();
    const confirmadas = historialCitas.filter(c => c.estado !== 'cancelada' && c.estado !== 'no-show' && c.estado !== 'no_show');
    const canceladas = historialCitas.filter(c => c.estado === 'cancelada');
    const noShows = historialCitas.filter(c => c.estado === 'no-show' || c.estado === 'no_show');
    const pasadas = confirmadas.filter(c => new Date(c.hora_inicio) <= ahora);
    const ultimaVisita = pasadas.length > 0 ? new Date(pasadas[0].hora_inicio) : null;
    const diasDesdeUltima = ultimaVisita ? Math.floor((ahora.getTime() - ultimaVisita.getTime()) / 86400000) : null;

    let frecuenciaMedia: number | null = null;
    if (pasadas.length >= 2) {
      const fechas = pasadas.map(c => new Date(c.hora_inicio).getTime()).sort((a, b) => b - a);
      let totalDiff = 0;
      for (let i = 0; i < fechas.length - 1; i++) totalDiff += fechas[i] - fechas[i + 1];
      frecuenciaMedia = Math.round(totalDiff / ((fechas.length - 1) * 86400000));
    }

    let score = 100;
    if (historialCitas.length > 0) score -= Math.round((canceladas.length / historialCitas.length) * 30);
    if (historialCitas.length > 0) score -= Math.round((noShows.length / historialCitas.length) * 40);
    if (diasDesdeUltima !== null && frecuenciaMedia !== null && frecuenciaMedia > 0) {
      const overdue = diasDesdeUltima / frecuenciaMedia;
      if (overdue > 2) score -= 25; else if (overdue > 1.5) score -= 15; else if (overdue > 1.2) score -= 5;
    } else if (diasDesdeUltima !== null) {
      if (diasDesdeUltima > 120) score -= 25; else if (diasDesdeUltima > 60) score -= 15; else if (diasDesdeUltima > 30) score -= 5;
    }
    if (confirmadas.length >= 10) score = Math.min(100, score + 5);
    score = Math.max(0, Math.min(100, score));

    const conteo: Record<string, number> = {};
    historialCitas.forEach(c => { const n = c.servicios?.nombre || c.servicio_nombre_libre; if (n) conteo[n] = (conteo[n] || 0) + 1; });
    const servicioTop = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];

    const insights: string[] = [];
    if (frecuenciaMedia !== null) {
      if (frecuenciaMedia <= 7) insights.push('Viene ~cada semana');
      else if (frecuenciaMedia <= 14) insights.push(`Frecuencia: cada ~${frecuenciaMedia} días`);
      else if (frecuenciaMedia <= 35) insights.push(`Frecuencia: cada ~${Math.round(frecuenciaMedia / 7)} semanas`);
      else insights.push(`Frecuencia: cada ~${Math.round(frecuenciaMedia / 30)} meses`);
    }
    if (diasDesdeUltima !== null) {
      if (diasDesdeUltima === 0) insights.push('Ha venido hoy');
      else if (diasDesdeUltima < 7) insights.push(`Última visita hace ${diasDesdeUltima}d`);
      else if (diasDesdeUltima < 30) insights.push(`Última visita hace ${Math.floor(diasDesdeUltima / 7)} sem`);
      else insights.push(`Última visita hace ${Math.floor(diasDesdeUltima / 30)} meses`);
    }
    if (frecuenciaMedia !== null && diasDesdeUltima !== null && diasDesdeUltima > frecuenciaMedia * 1.5)
      insights.push('⚠ Más tiempo del habitual sin venir');
    const futuras = historialCitas.filter(c => new Date(c.hora_inicio) > ahora && c.estado !== 'cancelada');
    if (futuras.length > 0) {
      const d = Math.floor((new Date(futuras[futuras.length - 1].hora_inicio).getTime() - ahora.getTime()) / 86400000);
      insights.push(d === 0 ? 'Tiene cita hoy' : d === 1 ? 'Cita mañana' : `Próxima cita en ${d}d`);
    } else if (confirmadas.length > 0) insights.push('Sin próxima cita');

    return { score, totalVisitas: confirmadas.length, cancelaciones: canceladas.length, noShows: noShows.length,
      totalCitas: historialCitas.length, diasDesdeUltima, frecuenciaMedia,
      servicioTop: servicioTop ? { nombre: servicioTop[0], veces: servicioTop[1] } : null, insights };
  }, [historialCitas]);

  useEffect(() => { if (empresaId) cargarClientes(); }, [empresaId]);
  useEffect(() => { if (vistaDetalle) cargarHistorialCitas(vistaDetalle.id); }, [vistaDetalle]);

  async function cargarClientes() {
    setLoading(true);
    const { data } = await supabase.from('clientes').select('*').eq('empresa_id', empresaId).order('nombre');
    setClientes(data || []); setLoading(false);
  }
  async function cargarHistorialCitas(clienteId: string) {
    setLoadingCitas(true);
    const { data } = await supabase.from('citas').select('*, servicios(nombre)').eq('cliente_id', clienteId).order('hora_inicio', { ascending: false }).limit(100);
    setHistorialCitas(data || []); setLoadingCitas(false);
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono || '').includes(busqueda) ||
    (c.email || '').toLowerCase().includes(busqueda.toLowerCase()));

  function abrirNuevoCliente() { setForm({ nombre: '', telefono: '', email: '', notas: '' }); setError(''); setEditando(false); setModalAbierto(true); }
  function abrirEditarCliente(cl: Cliente) { setForm({ nombre: cl.nombre || '', telefono: cl.telefono || '', email: cl.email || '', notas: cl.notas || '' }); setError(''); setEditando(true); setModalAbierto(true); }

  async function guardarCliente() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true); setError('');
    if (editando && vistaDetalle) {
      const { error } = await supabase.from('clientes').update({ nombre: form.nombre.trim(), telefono: form.telefono.trim() || null, email: form.email.trim() || null, notas: form.notas.trim() || null }).eq('id', vistaDetalle.id);
      if (error) { setError('Error al guardar'); setGuardando(false); return; }
      setVistaDetalle(prev => prev ? { ...prev, ...form } : prev);
    } else {
      const { error } = await supabase.from('clientes').insert({ empresa_id: empresaId, nombre: form.nombre.trim(), telefono: form.telefono.trim() || null, email: form.email.trim() || null, notas: form.notas.trim() || null });
      if (error) { setError('Error al guardar'); setGuardando(false); return; }
    }
    await cargarClientes(); setModalAbierto(false); setGuardando(false);
  }

  async function eliminarCliente() {
    if (!vistaDetalle) return;
    const { error } = await supabase.from('clientes').delete().eq('id', vistaDetalle.id);
    if (!error) { await cargarClientes(); setVistaDetalle(null); setConfirmDelete(false); }
  }

  function formatFecha(s?: string) { if (!s) return '—'; return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); }

  // ═══════════════════════════════════════════════════════
  // DETAIL — FULL WIDTH BI DASHBOARD
  // ═══════════════════════════════════════════════════════
  if (vistaDetalle) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>

        {/* TOP BAR */}
        <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setVistaDetalle(null); setConfirmDelete(false); }}
            style={{ color: C.textMid, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span style={{ fontSize: 13, color: C.textDim, fontWeight: 600, letterSpacing: 0.4 }}>ANÁLISIS DE CLIENTE</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => abrirEditarCliente(vistaDetalle)}
            style={{ color: C.textMid, background: 'none', border: `1px solid ${C.divider}`, cursor: 'pointer', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Edit2 className="w-3.5 h-3.5" /> Editar
          </button>
        </div>

        {loadingCitas ? (
          <div style={{ padding: 60, textAlign: 'center', color: C.textDim }}>Cargando análisis...</div>
        ) : (
          <div style={{ display: 'flex', minHeight: 'calc(100vh - 49px)' }}>

            {/* ═══ LEFT PANEL ═══ */}
            <div style={{ width: '32%', minWidth: 280, maxWidth: 380, background: C.panel, borderRight: `1px solid ${C.divider}`, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

              {/* Identity */}
              <div style={{ padding: '28px 24px 20px', borderBottom: `1px solid ${C.divider}` }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: C.accent, marginBottom: 14 }}>
                  {vistaDetalle.nombre[0].toUpperCase()}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>{vistaDetalle.nombre}</h2>
                <p style={{ fontSize: 12, color: C.textDim }}>Cliente desde {formatFecha(vistaDetalle.created_at)}</p>
                {analytics?.servicioTop && (
                  <p style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                    Favorito: <span style={{ color: C.purple, fontWeight: 700 }}>{analytics.servicioTop.nombre}</span>
                    <span style={{ color: C.textDim }}> ({analytics.servicioTop.veces}x)</span>
                  </p>
                )}
              </div>

              {/* Contact */}
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.divider}` }}>
                <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>CONTACTO</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {vistaDetalle.telefono ? (
                    <a href={`tel:${vistaDetalle.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text, textDecoration: 'none', fontSize: 13 }}>
                      <Phone className="w-3.5 h-3.5" style={{ color: C.accent, flexShrink: 0 }} /> {vistaDetalle.telefono}
                    </a>
                  ) : <span style={{ fontSize: 12, color: C.textDim }}>Sin teléfono</span>}
                  {vistaDetalle.email ? (
                    <a href={`mailto:${vistaDetalle.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text, textDecoration: 'none', fontSize: 13, wordBreak: 'break-all' }}>
                      <Mail className="w-3.5 h-3.5" style={{ color: C.blue, flexShrink: 0 }} /> {vistaDetalle.email}
                    </a>
                  ) : <span style={{ fontSize: 12, color: C.textDim }}>Sin email</span>}
                </div>
                {vistaDetalle.notas && (
                  <p style={{ fontSize: 12, color: C.textMid, marginTop: 12, lineHeight: 1.5, borderTop: `1px solid ${C.divider}`, paddingTop: 10 }}>{vistaDetalle.notas}</p>
                )}
              </div>

              {/* Insights */}
              {analytics && analytics.insights.length > 0 && (
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.divider}` }}>
                  <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>INSIGHTS</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analytics.insights.map((ins, i) => (
                      <p key={i} style={{ fontSize: 12, lineHeight: 1.4, color: ins.includes('⚠') ? C.amber : C.textMid, fontWeight: ins.includes('⚠') ? 600 : 400 }}>{ins}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.divider}` }}>
                <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>ACCIONES</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => {}}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar className="w-4 h-4" /> Crear cita
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {vistaDetalle.telefono && (
                      <a href={`tel:${vistaDetalle.telefono}`}
                        style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${C.divider}`, background: 'transparent', color: C.textMid, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none' }}>
                        <Phone className="w-3.5 h-3.5" /> Llamar
                      </a>
                    )}
                    {vistaDetalle.telefono && (
                      <a href={`https://wa.me/${vistaDetalle.telefono.replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${C.divider}`, background: 'transparent', color: C.textMid, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none' }}>
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div style={{ marginTop: 'auto', padding: '16px 24px' }}>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', background: 'transparent', color: C.textDim, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Trash2 className="w-3 h-3" /> Eliminar cliente
                  </button>
                ) : (
                  <div style={{ background: C.redDim, borderRadius: 8, padding: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>¿Eliminar a {vistaDetalle.nombre}?</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: C.panelAlt, color: C.text, cursor: 'pointer', fontSize: 12 }}>No</button>
                      <button onClick={eliminarCliente} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Sí, eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ RIGHT PANEL — Analytics ═══ */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
              {analytics ? (
                <>
                  {/* ROW 1: Score + KPIs */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: 28, alignItems: 'stretch' }}>
                    <div style={{ background: C.panel, borderRight: `1px solid ${C.divider}`, padding: '28px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <ScoreRing score={analytics.score} size={160} />
                      <p style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: 1, marginTop: 12, textTransform: 'uppercase' }}>Salud del cliente</p>
                    </div>
                    <div style={{ flex: 1, background: C.panel, padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32 }}>
                      <KPI value={analytics.totalVisitas} label="Visitas completadas" color={C.accent} />
                      <KPI value={analytics.cancelaciones} label="Cancelaciones" color={analytics.cancelaciones > 0 ? C.amber : C.textDim} />
                      <KPI value={analytics.noShows} label="No-shows" color={analytics.noShows > 0 ? C.red : C.textDim} />
                      <KPI value={analytics.frecuenciaMedia ? `~${analytics.frecuenciaMedia}` : '—'} label="Días entre visitas" color={C.blue} sub={analytics.frecuenciaMedia ? 'días' : ''} />
                      <KPI value={analytics.totalCitas} label="Total citas" color={C.textMid} />
                      <KPI value={analytics.diasDesdeUltima !== null ? analytics.diasDesdeUltima : '—'} label="Días desde última visita"
                        color={analytics.diasDesdeUltima !== null && analytics.diasDesdeUltima > 60 ? C.red : analytics.diasDesdeUltima !== null && analytics.diasDesdeUltima > 30 ? C.amber : C.text}
                        sub={analytics.diasDesdeUltima !== null ? 'días' : ''} />
                    </div>
                  </div>

                  {/* ROW 2: Chart */}
                  <div style={{ background: C.panel, padding: '20px 24px', marginBottom: 28 }}>
                    <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>ACTIVIDAD — ÚLTIMOS 6 MESES</p>
                    <ActivityChart citas={historialCitas} />
                  </div>

                  {/* ROW 3: Timeline */}
                  {historialCitas.length > 0 && (
                    <div style={{ background: C.panel, padding: '20px 24px' }}>
                      <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' }}>HISTORIAL DE CITAS</p>
                      {historialCitas.slice(0, 12).map((cita, i, arr) => (
                        <TimelineDot key={cita.id} cita={cita} isLast={i === arr.length - 1} />
                      ))}
                      {historialCitas.length > 12 && (
                        <p style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>+{historialCitas.length - 12} citas anteriores</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 16, color: C.textMid }}>Sin datos de actividad</p>
                    <p style={{ fontSize: 13, color: C.textDim }}>Los análisis aparecerán con la primera cita</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {modalAbierto && <ModalCliente editando={editando} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={guardarCliente} onCerrar={() => setModalAbierto(false)} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // LIST VIEW (unchanged)
  // ═══════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Clientes</h2>
          <button onClick={abrirNuevoCliente}
            style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMid }} />
          <input type="text" placeholder="Buscar por nombre, teléfono o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: C.panelAlt, border: `1px solid ${C.divider}`, borderRadius: 12, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMid }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: '12px 16px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textMid }}>Cargando clientes...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: C.textMid, fontSize: 15 }}>{busqueda ? 'No hay resultados' : 'Aún no tienes clientes'}</p>
            {!busqueda && <button onClick={abrirNuevoCliente} style={{ marginTop: 16, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Añadir primer cliente</button>}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: C.textMid, marginBottom: 10 }}>{clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientesFiltrados.map(cl => (
                <button key={cl.id} onClick={() => setVistaDetalle(cl)}
                  style={{ background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.panelAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.panel)}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{cl.nombre[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{cl.nombre}</p>
                    <p style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.telefono || cl.email || 'Sin contacto'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: C.textMid, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {modalAbierto && <ModalCliente editando={editando} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={guardarCliente} onCerrar={() => setModalAbierto(false)} />}
    </div>
  );
}
