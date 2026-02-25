'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Phone, Mail, FileText, ChevronRight, ArrowLeft, Trash2, Edit2, Check, Calendar, MessageCircle } from 'lucide-react';

const C = {
  bg: '#0F172A', surface: '#1E293B', surfaceAlt: '#243247',
  green: '#22C55E', greenBg: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.1)',
  amber: '#F59E0B', amberBg: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueBg: 'rgba(59,130,246,0.12)',
  purple: '#A855F7', purpleBg: 'rgba(168,85,247,0.12)',
  text: '#F1F5F9', textSec: '#94A3B8', textTer: '#64748B',
  border: 'rgba(148,163,184,0.08)',
};

interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  notas?: string;
  created_at?: string;
}

interface FormCliente {
  nombre: string;
  telefono: string;
  email: string;
  notas: string;
}

// ─── SCORE RING (SVG) ───
function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? C.green : score >= 40 ? C.amber : C.red;
  const label = score >= 70 ? 'Fiel' : score >= 40 ? 'En riesgo' : 'Inactivo';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.surfaceAlt} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: C.textSec, fontWeight: 600, marginTop: 2 }}>{label}</span>
      </div>
    </div>
  );
}

// ─── VISIT PATTERN BARS (last 6 months) ───
function VisitPattern({ citas }: { citas: any[] }) {
  const months = useMemo(() => {
    const now = new Date();
    const result: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const count = citas.filter(c => {
        if (!c.hora_inicio) return false;
        const cd = new Date(c.hora_inicio);
        return cd.getFullYear() === y && cd.getMonth() === m && c.estado !== 'cancelada';
      }).length;
      result.push({
        label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
        count,
      });
    }
    return result;
  }, [citas]);

  const max = Math.max(...months.map(m => m.count), 1);
  const isCurrentMonth = (i: number) => i === months.length - 1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56, width: '100%' }}>
      {months.map((m, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 36 }}>
            <div style={{
              width: '100%', maxWidth: 28, borderRadius: 4,
              height: m.count === 0 ? 3 : Math.max(8, (m.count / max) * 36),
              background: m.count === 0 ? C.surfaceAlt : isCurrentMonth(i) ? C.green : 'rgba(34,197,94,0.4)',
              transition: 'height 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 9, color: isCurrentMonth(i) ? C.text : C.textTer, fontWeight: isCurrentMonth(i) ? 600 : 400, textTransform: 'capitalize' }}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── TIMELINE DOT ───
function TimelineDot({ cita, isLast }: { cita: any; isLast: boolean }) {
  const color = cita.estado === 'cancelada' ? C.textTer
    : (cita.estado === 'no-show' || cita.estado === 'no_show') ? C.red
    : C.green;

  const fecha = new Date(cita.hora_inicio);
  const hoy = new Date();
  const diffDays = Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  let fechaStr: string;
  if (diffDays === 0) fechaStr = 'Hoy';
  else if (diffDays === 1) fechaStr = 'Ayer';
  else if (diffDays < 7) fechaStr = `Hace ${diffDays} días`;
  else if (diffDays < 30) fechaStr = `Hace ${Math.floor(diffDays / 7)} sem`;
  else fechaStr = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const servicio = cita.servicios?.nombre || cita.servicio_nombre_libre || 'Servicio';
  const hora = cita.hora_inicio?.substring(11, 16);

  return (
    <div style={{ display: 'flex', gap: 12, minHeight: 44 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
        {!isLast && <div style={{ flex: 1, width: 1.5, background: C.surfaceAlt, marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{servicio}</span>
          <span style={{ fontSize: 11, color: C.textTer }}>{hora}</span>
        </div>
        <span style={{ fontSize: 11, color: C.textTer }}>{fechaStr}
          {cita.estado === 'cancelada' && <span style={{ color: C.textTer }}> · cancelada</span>}
          {(cita.estado === 'no-show' || cita.estado === 'no_show') && <span style={{ color: C.red }}> · no-show</span>}
        </span>
      </div>
    </div>
  );
}

// ─── MODAL (sin cambios) ───
interface ModalClienteProps {
  editando: boolean;
  form: FormCliente;
  setForm: React.Dispatch<React.SetStateAction<FormCliente>>;
  guardando: boolean;
  error: string;
  onGuardar: () => void;
  onCerrar: () => void;
}

function ModalCliente({ editando, form, setForm, guardando, error, onGuardar, onCerrar }: ModalClienteProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCerrar}
    >
      <div
        style={{ background: C.surface, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 500, paddingBottom: 32 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editando ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>NOMBRE *</label>
            <input type="text" placeholder="Nombre del cliente" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>TELÉFONO</label>
            <input type="tel" placeholder="600 000 000" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input type="email" placeholder="email@ejemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>NOTAS</label>
            <textarea placeholder="Alergias, preferencias, observaciones..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={3} style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: C.red, fontSize: 13 }}>{error}</p>}
          <button onClick={onGuardar} disabled={guardando}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: C.green, color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, opacity: guardando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {guardando ? 'Guardando...' : (<><Check className="w-4 h-4" />{editando ? 'Guardar cambios' : 'Crear cliente'}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ───
interface ClientesSectionProps {
  empresaId: string;
}

export default function ClientesSection({ empresaId }: ClientesSectionProps) {
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

  // ─── ANALYTICS ENGINE ───
  const analytics = useMemo(() => {
    if (historialCitas.length === 0) return null;

    const ahora = new Date();
    const confirmadas = historialCitas.filter(c => c.estado !== 'cancelada' && c.estado !== 'no-show' && c.estado !== 'no_show');
    const canceladas = historialCitas.filter(c => c.estado === 'cancelada');
    const noShows = historialCitas.filter(c => c.estado === 'no-show' || c.estado === 'no_show');

    // Última visita (confirmada, en el pasado)
    const pasadas = confirmadas.filter(c => new Date(c.hora_inicio) <= ahora);
    const ultimaVisita = pasadas.length > 0 ? new Date(pasadas[0].hora_inicio) : null;
    const diasDesdeUltima = ultimaVisita ? Math.floor((ahora.getTime() - ultimaVisita.getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Frecuencia media (días entre visitas confirmadas pasadas)
    let frecuenciaMedia: number | null = null;
    if (pasadas.length >= 2) {
      const fechas = pasadas.map(c => new Date(c.hora_inicio).getTime()).sort((a, b) => b - a);
      let totalDiff = 0;
      for (let i = 0; i < fechas.length - 1; i++) {
        totalDiff += fechas[i] - fechas[i + 1];
      }
      frecuenciaMedia = Math.round(totalDiff / ((fechas.length - 1) * 1000 * 60 * 60 * 24));
    }

    // Score: 100 base, penalizar por inactividad, cancelaciones, no-shows
    let score = 100;
    if (historialCitas.length > 0) {
      const cancelRatio = canceladas.length / historialCitas.length;
      score -= Math.round(cancelRatio * 30);
    }
    if (historialCitas.length > 0) {
      const noShowRatio = noShows.length / historialCitas.length;
      score -= Math.round(noShowRatio * 40);
    }
    if (diasDesdeUltima !== null && frecuenciaMedia !== null && frecuenciaMedia > 0) {
      const overdue = diasDesdeUltima / frecuenciaMedia;
      if (overdue > 2) score -= 25;
      else if (overdue > 1.5) score -= 15;
      else if (overdue > 1.2) score -= 5;
    } else if (diasDesdeUltima !== null) {
      if (diasDesdeUltima > 120) score -= 25;
      else if (diasDesdeUltima > 60) score -= 15;
      else if (diasDesdeUltima > 30) score -= 5;
    }
    if (confirmadas.length >= 10) score = Math.min(100, score + 5);
    score = Math.max(0, Math.min(100, score));

    // Servicio favorito
    const conteoServicios: Record<string, number> = {};
    historialCitas.forEach(c => {
      const nombre = c.servicios?.nombre || c.servicio_nombre_libre;
      if (nombre) conteoServicios[nombre] = (conteoServicios[nombre] || 0) + 1;
    });
    const servicioTop = Object.entries(conteoServicios).sort((a, b) => b[1] - a[1])[0];

    // Insights
    const insights: string[] = [];

    if (frecuenciaMedia !== null) {
      if (frecuenciaMedia <= 7) insights.push('Viene aproximadamente cada semana');
      else if (frecuenciaMedia <= 14) insights.push(`Viene cada ~${Math.round(frecuenciaMedia)} días`);
      else if (frecuenciaMedia <= 35) insights.push(`Viene cada ~${Math.round(frecuenciaMedia / 7)} semanas`);
      else insights.push(`Viene cada ~${Math.round(frecuenciaMedia / 30)} meses`);
    }

    if (diasDesdeUltima !== null) {
      if (diasDesdeUltima === 0) insights.push('Ha venido hoy');
      else if (diasDesdeUltima === 1) insights.push('Vino ayer');
      else if (diasDesdeUltima < 7) insights.push(`Última visita hace ${diasDesdeUltima} días`);
      else if (diasDesdeUltima < 30) insights.push(`Última visita hace ${Math.floor(diasDesdeUltima / 7)} semanas`);
      else insights.push(`Última visita hace ${Math.floor(diasDesdeUltima / 30)} meses`);
    }

    if (frecuenciaMedia !== null && diasDesdeUltima !== null && diasDesdeUltima > frecuenciaMedia * 1.5) {
      insights.push('⚠️ Lleva más tiempo del habitual sin venir');
    }

    if (noShows.length > 0 && noShows.length >= confirmadas.length * 0.2) {
      insights.push('Tiene tendencia a no presentarse');
    }

    const futuras = historialCitas.filter(c => new Date(c.hora_inicio) > ahora && c.estado !== 'cancelada');
    const proximaCita = futuras.length > 0 ? futuras[futuras.length - 1] : null;
    if (proximaCita) {
      const diasHasta = Math.floor((new Date(proximaCita.hora_inicio).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
      if (diasHasta === 0) insights.push('Tiene cita hoy');
      else if (diasHasta === 1) insights.push('Tiene cita mañana');
      else insights.push(`Próxima cita en ${diasHasta} días`);
    } else if (confirmadas.length > 0) {
      insights.push('No tiene próxima cita reservada');
    }

    return {
      score, totalVisitas: confirmadas.length, cancelaciones: canceladas.length,
      noShows: noShows.length, totalCitas: historialCitas.length,
      ultimaVisita, diasDesdeUltima, frecuenciaMedia,
      servicioTop: servicioTop ? { nombre: servicioTop[0], veces: servicioTop[1] } : null,
      insights, proximaCita,
    };
  }, [historialCitas]);

  useEffect(() => { if (empresaId) cargarClientes(); }, [empresaId]);
  useEffect(() => { if (vistaDetalle) cargarHistorialCitas(vistaDetalle.id); }, [vistaDetalle]);

  async function cargarClientes() {
    setLoading(true);
    const { data, error } = await supabase.from('clientes').select('*').eq('empresa_id', empresaId).order('nombre');
    if (!error) setClientes(data || []);
    setLoading(false);
  }

  async function cargarHistorialCitas(clienteId: string) {
    setLoadingCitas(true);
    const { data } = await supabase.from('citas').select('*, servicios(nombre)').eq('cliente_id', clienteId).order('hora_inicio', { ascending: false }).limit(100);
    setHistorialCitas(data || []);
    setLoadingCitas(false);
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono || '').includes(busqueda) ||
    (c.email || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  function abrirNuevoCliente() {
    setForm({ nombre: '', telefono: '', email: '', notas: '' });
    setError(''); setEditando(false); setModalAbierto(true);
  }

  function abrirEditarCliente(cliente: Cliente) {
    setForm({ nombre: cliente.nombre || '', telefono: cliente.telefono || '', email: cliente.email || '', notas: cliente.notas || '' });
    setError(''); setEditando(true); setModalAbierto(true);
  }

  async function guardarCliente() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true); setError('');
    if (editando && vistaDetalle) {
      const { error } = await supabase.from('clientes').update({
        nombre: form.nombre.trim(), telefono: form.telefono.trim() || null,
        email: form.email.trim() || null, notas: form.notas.trim() || null,
      }).eq('id', vistaDetalle.id);
      if (error) { setError('Error al guardar'); setGuardando(false); return; }
      setVistaDetalle(prev => prev ? { ...prev, ...form } : prev);
    } else {
      const { error } = await supabase.from('clientes').insert({
        empresa_id: empresaId, nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null, email: form.email.trim() || null, notas: form.notas.trim() || null,
      });
      if (error) { setError('Error al guardar'); setGuardando(false); return; }
    }
    await cargarClientes(); setModalAbierto(false); setGuardando(false);
  }

  async function eliminarCliente() {
    if (!vistaDetalle) return;
    const { error } = await supabase.from('clientes').delete().eq('id', vistaDetalle.id);
    if (!error) { await cargarClientes(); setVistaDetalle(null); setConfirmDelete(false); }
  }

  function formatFecha(s?: string) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ══════════════════════════════════════════════════════════
  // ─── VISTA DETALLE: DASHBOARD INTELIGENTE ───
  // ══════════════════════════════════════════════════════════
  if (vistaDetalle) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, paddingBottom: 90 }}>

        {/* ─── HEADER: Identity + Score ─── */}
        <div style={{ background: C.surface, padding: '20px 20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <button onClick={() => { setVistaDetalle(null); setConfirmDelete(false); }}
              style={{ color: C.textSec, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span style={{ fontSize: 14, color: C.textSec, flex: 1 }}>Ficha de cliente</span>
            <button onClick={() => abrirEditarCliente(vistaDetalle)}
              style={{ color: C.textSec, background: C.surfaceAlt, border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Edit2 className="w-3.5 h-3.5" /> Editar
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>{vistaDetalle.nombre}</h2>
              <p style={{ fontSize: 12, color: C.textTer }}>
                Cliente desde {formatFecha(vistaDetalle.created_at)}
                {analytics?.servicioTop && (<> · Favorito: <span style={{ color: C.purple, fontWeight: 600 }}>{analytics.servicioTop.nombre}</span></>)}
              </p>
            </div>
            {!loadingCitas && analytics && <ScoreRing score={analytics.score} />}
          </div>
        </div>

        <div style={{ padding: '16px 20px', maxWidth: 600, margin: '0 auto' }}>

          {loadingCitas ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: C.textSec, fontSize: 14 }}>Cargando datos...</p>
            </div>
          ) : analytics ? (
            <>
              {/* ─── INSIGHTS ─── */}
              {analytics.insights.length > 0 && (
                <div style={{
                  background: analytics.insights.some(i => i.startsWith('⚠️')) ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.04)',
                  border: `1px solid ${analytics.insights.some(i => i.startsWith('⚠️')) ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.1)'}`,
                  borderRadius: 14, padding: '14px 16px', marginBottom: 16,
                }}>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                    {analytics.insights.join(' · ')}
                  </p>
                </div>
              )}

              {/* ─── METRICS LINE ─── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20,
                fontSize: 13, color: C.textSec, flexWrap: 'wrap',
              }}>
                <span><span style={{ fontWeight: 700, color: C.green, fontSize: 15 }}>{analytics.totalVisitas}</span> visitas</span>
                <span style={{ margin: '0 8px', color: C.textTer }}>·</span>
                <span><span style={{ fontWeight: 700, color: analytics.cancelaciones > 0 ? C.amber : C.textTer, fontSize: 15 }}>{analytics.cancelaciones}</span> cancel.</span>
                <span style={{ margin: '0 8px', color: C.textTer }}>·</span>
                <span><span style={{ fontWeight: 700, color: analytics.noShows > 0 ? C.red : C.textTer, fontSize: 15 }}>{analytics.noShows}</span> no-shows</span>
                {analytics.frecuenciaMedia && (
                  <>
                    <span style={{ margin: '0 8px', color: C.textTer }}>·</span>
                    <span>cada <span style={{ fontWeight: 700, color: C.blue, fontSize: 15 }}>~{analytics.frecuenciaMedia}</span> días</span>
                  </>
                )}
              </div>

              {/* ─── VISIT PATTERN ─── */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, color: C.textTer, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Actividad (últimos 6 meses)
                </p>
                <VisitPattern citas={historialCitas} />
              </div>

              {/* ─── CONTACTO (compact) ─── */}
              {(vistaDetalle.telefono || vistaDetalle.email || vistaDetalle.notas) && (
                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, color: C.textTer, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Contacto</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {vistaDetalle.telefono && (
                      <a href={`tel:${vistaDetalle.telefono}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', textDecoration: 'none', color: C.text, fontSize: 13 }}>
                        <Phone className="w-3.5 h-3.5" style={{ color: C.green }} />
                        {vistaDetalle.telefono}
                      </a>
                    )}
                    {vistaDetalle.email && (
                      <a href={`mailto:${vistaDetalle.email}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', textDecoration: 'none', color: C.text, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        <Mail className="w-3.5 h-3.5" style={{ color: C.blue }} />
                        {vistaDetalle.email}
                      </a>
                    )}
                  </div>
                  {vistaDetalle.notas && (
                    <p style={{ fontSize: 12, color: C.textSec, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
                      {vistaDetalle.notas}
                    </p>
                  )}
                </div>
              )}

              {/* ─── TIMELINE ─── */}
              {historialCitas.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, color: C.textTer, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Últimas citas
                  </p>
                  <div style={{ background: C.surface, borderRadius: 14, padding: '16px 16px 12px', border: `1px solid ${C.border}` }}>
                    {historialCitas.slice(0, 8).map((cita, i, arr) => (
                      <TimelineDot key={cita.id} cita={cita} isLast={i === arr.length - 1} />
                    ))}
                    {historialCitas.length > 8 && (
                      <p style={{ fontSize: 11, color: C.textTer, textAlign: 'center', marginTop: 8 }}>
                        +{historialCitas.length - 8} citas anteriores
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ─── DANGER ZONE ─── */}
              <div style={{ marginTop: 8 }}>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: C.textTer, cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar cliente
                  </button>
                ) : (
                  <div style={{ background: C.redBg, borderRadius: 12, padding: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>¿Eliminar a {vistaDetalle.nombre}?</p>
                    <p style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>Se borrarán todos sus datos. Esta acción no se puede deshacer.</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.surfaceAlt, color: C.text, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                      <button onClick={eliminarCliente} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Sí, eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ fontSize: 15, color: C.textSec, marginBottom: 4 }}>Sin citas registradas aún</p>
              <p style={{ fontSize: 12, color: C.textTer }}>Las estadísticas aparecerán con la primera cita</p>
            </div>
          )}
        </div>

        {/* ─── ACTION BAR (fixed bottom) ─── */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: C.surface, borderTop: `1px solid ${C.border}`,
          padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={() => {/* TODO: abrir NuevaCitaModal con cliente preseleccionado */}}
            style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: C.green, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Calendar className="w-4 h-4" /> Crear cita
          </button>
          {vistaDetalle.telefono && (
            <a href={`tel:${vistaDetalle.telefono}`}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
              <Phone className="w-4 h-4" /> Llamar
            </a>
          )}
          {vistaDetalle.telefono && (
            <a href={`https://wa.me/${vistaDetalle.telefono.replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
        </div>

        {modalAbierto && (
          <ModalCliente editando={editando} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={guardarCliente} onCerrar={() => setModalAbierto(false)} />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ─── VISTA LISTA (sin cambios) ───
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Clientes</h2>
          <button onClick={abrirNuevoCliente}
            style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textSec }} />
          <input type="text" placeholder="Buscar por nombre, teléfono o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textSec }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 16px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textSec }}>Cargando clientes...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: C.textSec, fontSize: 15 }}>{busqueda ? 'No hay resultados para esa búsqueda' : 'Aún no tienes clientes'}</p>
            {!busqueda && (
              <button onClick={abrirNuevoCliente}
                style={{ marginTop: 16, background: C.green, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Añadir primer cliente
              </button>
            )}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>{clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientesFiltrados.map(cliente => (
                <button key={cliente.id} onClick={() => setVistaDetalle(cliente)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.surface)}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                    {cliente.nombre[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{cliente.nombre}</p>
                    <p style={{ fontSize: 12, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.telefono || cliente.email || 'Sin contacto'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: C.textSec, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {modalAbierto && (
        <ModalCliente editando={editando} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={guardarCliente} onCerrar={() => setModalAbierto(false)} />
      )}
    </div>
  );
}
