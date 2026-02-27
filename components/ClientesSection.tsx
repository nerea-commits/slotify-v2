'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Search, Plus, X, Phone, Mail, ChevronRight, ArrowLeft,
  Trash2, Edit2, Check, Calendar, MessageCircle, DollarSign,
  Clock, TrendingUp, AlertTriangle, ChevronDown
} from 'lucide-react';
import { calcularFiabilidad, inferEstadoDetallado, type FiabilidadResult } from '@/lib/fiabilidad';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0B0F1A',
  panel:     '#111827',
  panelAlt:  '#1A2332',
  panelB:    '#1E293B',
  accent:    '#22C55E',
  accentDim: 'rgba(34,197,94,0.12)',
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.10)',
  amber:     '#F59E0B',
  amberDim:  'rgba(245,158,11,0.10)',
  blue:      '#3B82F6',
  purple:    '#A855F7',
  text:      '#F1F5F9',
  textMid:   '#94A3B8',
  textDim:   '#4B5563',
  divider:   'rgba(148,163,184,0.07)',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Cliente { id: string; nombre: string; telefono?: string; email?: string; notas?: string; created_at?: string; }
interface FormCliente { nombre: string; telefono: string; email: string; notas: string; }
type PeriodoFiltro = '30d' | '90d' | '180d' | 'all';
type SegmentoActivo = 'all' | 'completadas' | 'canceladas' | 'noshow';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtRelative(date: Date) {
  const diff = Math.floor((new Date().getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff}d`;
  if (diff < 30) return `Hace ${Math.floor(diff/7)}sem`;
  if (diff < 365) return `Hace ${Math.floor(diff/30)}m`;
  return fmtDate(date.toISOString());
}
function periodLabel(p: PeriodoFiltro) {
  return { '30d': 'Últimos 30 días', '90d': 'Últimos 3 meses', '180d': 'Últimos 6 meses', all: 'Histórico' }[p];
}

// ─── Donut interactivo ────────────────────────────────────────────────────────
interface DonutSegment { value: number; color: string; label: string; key: SegmentoActivo; }
interface DonutProps {
  completadas: number; canceladas: number; noShows: number; total: number;
  periodo: PeriodoFiltro; segmentoActivo: SegmentoActivo;
  onSegmentoClick: (s: SegmentoActivo) => void;
}

const DonutInteractivo = memo(function DonutInteractivo({ completadas, canceladas, noShows, total, periodo, segmentoActivo, onSegmentoClick }: DonutProps) {
  const [hovered, setHovered] = useState<SegmentoActivo | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; seg: DonutSegment } | null>(null);

  const SIZE = 220, STROKE = 22, r = (SIZE - STROKE) / 2, circ = 2 * Math.PI * r;
  const gap = 3;

  const segments: DonutSegment[] = useMemo(() => [
    { value: completadas, color: C.accent, label: 'Completadas', key: 'completadas' },
    { value: canceladas,  color: C.amber,  label: 'Canceladas',  key: 'canceladas'  },
    { value: noShows,     color: C.red,    label: 'No-show',     key: 'noshow'      },
  ].filter(s => s.value > 0), [completadas, canceladas, noShows]);

  const arcs = useMemo(() => {
    let off = 0;
    return segments.map(seg => {
      const pct = seg.value / (total || 1);
      const dash = Math.max(pct * circ - gap, 0);
      const a = { ...seg, pct, dash, offset: off };
      off += pct * circ;
      return a;
    });
  }, [segments, total, circ]);

  if (total === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, color: C.textDim, gap: 8 }}>
      <Calendar size={32} style={{ opacity: 0.3 }} />
      <span style={{ fontSize: 12 }}>Sin citas en este periodo</span>
    </div>
  );

  // Active label for center
  const centerSeg = hovered ? segments.find(s => s.key === hovered) : (segmentoActivo !== 'all' ? segments.find(s => s.key === segmentoActivo) : null);
  const centerNum = centerSeg ? centerSeg.value : total;
  const centerLabel = centerSeg ? centerSeg.label : periodLabel(periodo);
  const centerColor = centerSeg ? centerSeg.color : C.text;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>

      {/* SVG Donut */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE, cursor: 'pointer' }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}
          onMouseLeave={() => { setHovered(null); setTooltip(null); }}>
          {/* Track */}
          <circle cx={SIZE/2} cy={SIZE/2} r={r} fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth={STROKE} />
          {arcs.map((arc, i) => {
            const isActive = segmentoActivo === arc.key || hovered === arc.key;
            const isInactive = segmentoActivo !== 'all' && segmentoActivo !== arc.key && hovered !== arc.key;
            return (
              <circle key={i}
                cx={SIZE/2} cy={SIZE/2} r={r} fill="none"
                stroke={arc.color}
                strokeWidth={isActive ? STROKE + 4 : STROKE}
                strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap="round"
                opacity={isInactive ? 0.25 : 1}
                style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                onClick={() => onSegmentoClick(segmentoActivo === arc.key ? 'all' : arc.key)}
                onMouseEnter={(e) => {
                  setHovered(arc.key);
                  const rect = (e.currentTarget.ownerSVGElement as SVGElement).getBoundingClientRect();
                  setTooltip({ x: rect.left + SIZE/2, y: rect.top + SIZE/2, seg: arc });
                }}
                onMouseLeave={() => { setHovered(null); setTooltip(null); }}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 42, fontWeight: 800, color: centerColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', transition: 'color 0.15s' }}>{centerNum}</span>
          <span style={{ fontSize: 10, color: C.textMid, fontWeight: 600, letterSpacing: 0.8, marginTop: 4, textAlign: 'center', maxWidth: 100, lineHeight: 1.3 }}>{centerLabel}</span>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 28, zIndex: 100,
            background: C.panelB, border: `1px solid ${tooltip.seg.color}44`,
            borderRadius: 8, padding: '6px 10px', pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            <span style={{ fontSize: 12, color: tooltip.seg.color, fontWeight: 700 }}>{tooltip.seg.label}</span>
            <span style={{ fontSize: 11, color: C.textMid, marginLeft: 8 }}>
              {tooltip.seg.value} · {Math.round(tooltip.seg.pct * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {segments.map(seg => {
          const isActive = segmentoActivo === seg.key;
          const isInactive = segmentoActivo !== 'all' && !isActive;
          return (
            <button key={seg.key} onClick={() => onSegmentoClick(segmentoActivo === seg.key ? 'all' : seg.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, background: isActive ? seg.color + '18' : 'transparent',
                border: isActive ? `1px solid ${seg.color}44` : '1px solid transparent',
                borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
                opacity: isInactive ? 0.4 : 1, transition: 'all 0.15s',
              }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isActive ? seg.color : C.textMid, fontWeight: isActive ? 700 : 400 }}>{seg.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: seg.color, fontVariantNumeric: 'tabular-nums' }}>{seg.value}</span>
              <span style={{ fontSize: 10, color: C.textDim }}>{Math.round((seg.value / total) * 100)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps { value: string | number; label: string; color?: string; suffix?: string; active?: boolean; onClick?: () => void; }
const KpiCard = memo(function KpiCard({ value, label, color = C.text, suffix, active, onClick }: KpiCardProps) {
  return (
    <div onClick={onClick}
      style={{
        background: active ? color + '12' : C.panelAlt,
        border: `1px solid ${active ? color + '44' : C.divider}`,
        borderRadius: 12, padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = color + '18'; }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = active ? color + '12' : C.panelAlt; }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {suffix && <span style={{ fontSize: 11, color: C.textDim }}>{suffix}</span>}
      </div>
      <span style={{ fontSize: 11, color: C.textMid, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
    </div>
  );
});

// ─── Risk Badge ────────────────────────────────────────────────────────────────
function RiskBadge({ fiab }: { fiab: FiabilidadResult }) {
  const cfg = {
    fiable:   { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  text: '#22C55E', emoji: '🟢' },
    atencion: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#F59E0B', emoji: '🟡' },
    riesgo:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  text: '#EF4444', emoji: '🔴' },
    nuevo:    { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)',text: '#94A3B8', emoji: '⚫' },
  }[fiab.riskLabel];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '5px 12px' }}>
      <span style={{ fontSize: 11 }}>{cfg.emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.text }}>{fiab.displayLabel}</span>
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ fiab }: { fiab: FiabilidadResult }) {
  if (fiab.alertLevel === 'none' || !fiab.alertMessage) return null;
  const isRed = fiab.alertLevel === 'danger';
  const color = isRed ? C.red : C.amber;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: color + '10', border: `1px solid ${color}30`, borderRadius: 10, padding: '10px 14px' }}>
      <AlertTriangle size={15} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color, fontWeight: 600 }}>{fiab.alertMessage}</span>
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────
const ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  completada:              { label: '✓ Completada',          color: C.accent, bg: C.accentDim },
  no_show_real:            { label: '✕ No-show',             color: C.red,    bg: C.redDim    },
  no_show_justificado:     { label: '○ No-show just.',       color: C.amber,  bg: C.amberDim  },
  cancelacion_tardia:      { label: '⚡ Cancel. tardía',     color: C.amber,  bg: C.amberDim  },
  cancelacion_anticipada:  { label: '◌ Cancelada',           color: C.textMid,bg: 'rgba(148,163,184,0.08)' },
  reprogramada:            { label: '↻ Reprogramada',        color: C.blue,   bg: 'rgba(59,130,246,0.1)'   },
};

const ESTADOS_OPCIONES = Object.entries(ESTADO_CFG).map(([k, v]) => ({ key: k, ...v }));

interface HistoryRowProps { cita: any; isLast: boolean; onChangeEstado: (citaId: string, estado: string) => void; }
const HistoryRow = memo(function HistoryRow({ cita, isLast, onChangeEstado }: HistoryRowProps) {
  const [open, setOpen] = useState(false);
  const ed = inferEstadoDetallado(cita);
  const cfg = ESTADO_CFG[ed] || ESTADO_CFG.completada;
  const date = new Date(cita.hora_inicio);
  const hora = cita.hora_inicio?.substring(11, 16);
  const sv = cita.servicios?.nombre || cita.servicio_nombre_libre || 'Servicio';

  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${C.divider}`, paddingBottom: isLast ? 0 : 10, marginBottom: isLast ? 0 : 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Date block */}
        <div style={{ flexShrink: 0, width: 44, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1 }}>{date.getDate()}</div>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase' }}>
            {date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}
          </div>
        </div>

        {/* Time + service */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{sv}</span>
            {cita.importe > 0 && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>{cita.importe}€</span>}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>{hora} · {fmtRelative(date)}</div>
        </div>

        {/* Status tag + dropdown toggle */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 20, padding: '4px 10px', cursor: 'pointer' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
            <ChevronDown size={10} style={{ color: cfg.color, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
          </button>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', zIndex: 50,
              background: C.panelB, border: `1px solid ${C.divider}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden', minWidth: 180,
            }}>
              {ESTADOS_OPCIONES.map(opt => (
                <button key={opt.key} onClick={() => { onChangeEstado(cita.id, opt.key); setOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none',
                    background: ed === opt.key ? opt.bg : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = opt.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = ed === opt.key ? opt.bg : 'transparent')}>
                  <span style={{ fontSize: 12, color: opt.color, fontWeight: ed === opt.key ? 700 : 400 }}>{opt.label}</span>
                  {ed === opt.key && <Check size={11} style={{ color: opt.color, marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Modal Editar/Crear cliente ───────────────────────────────────────────────
interface ModalProps { editando: boolean; form: FormCliente; setForm: React.Dispatch<React.SetStateAction<FormCliente>>; guardando: boolean; error: string; onGuardar: () => void; onCerrar: () => void; }
const ModalCliente = memo(function ModalCliente({ editando, form, setForm, guardando, error, onGuardar, onCerrar }: ModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onCerrar}>
      <div style={{ background: C.panel, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 520, paddingBottom: 36 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editando ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMid }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {([
            { l: 'NOMBRE *', t: 'text',  k: 'nombre',   p: 'Nombre del cliente' },
            { l: 'TELÉFONO',  t: 'tel',   k: 'telefono', p: '600 000 000' },
            { l: 'EMAIL',     t: 'email', k: 'email',    p: 'email@ejemplo.com' },
          ] as const).map(f => (
            <div key={f.k}>
              <label style={{ fontSize: 11, color: C.textMid, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>{f.l}</label>
              <input type={f.t} placeholder={f.p} value={(form as any)[f.k]}
                onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                style={{ width: '100%', padding: '11px 14px', background: C.panelAlt, border: `1px solid ${C.divider}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, color: C.textMid, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>NOTAS</label>
            <textarea placeholder="Alergias, preferencias..." value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              rows={3} style={{ width: '100%', padding: '11px 14px', background: C.panelAlt, border: `1px solid ${C.divider}`, borderRadius: 12, color: C.text, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: C.red, fontSize: 13 }}>{error}</p>}
          <button onClick={onGuardar} disabled={guardando}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: C.accent, color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, opacity: guardando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {guardando ? 'Guardando...' : <><Check size={16} />{editando ? 'Guardar cambios' : 'Crear cliente'}</>}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── VISTA DETALLE ─────────────────────────────────────────────────────────────
interface DetalleProps {
  cliente: Cliente; empresaId: string; mostrarImporte: boolean;
  onVolver: () => void;
  onCrearCita?: (clienteId: string) => void;
}

function VistaDetalle({ cliente, empresaId, mostrarImporte, onVolver, onCrearCita }: DetalleProps) {
  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('90d');
  const [segmento, setSegmento] = useState<SegmentoActivo>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<FormCliente>({ nombre: cliente.nombre, telefono: cliente.telefono || '', email: cliente.email || '', notas: cliente.notas || '' });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [clienteData, setClienteData] = useState(cliente);

  useEffect(() => {
    setLoading(true);
    supabase.from('citas').select('*, servicios(nombre)').eq('cliente_id', cliente.id).order('hora_inicio', { ascending: false }).limit(300)
      .then(({ data }) => { setCitas(data || []); setLoading(false); });
  }, [cliente.id]);

  const handleChangeEstado = useCallback(async (citaId: string, estado: string) => {
    await supabase.from('citas').update({ estado_detallado: estado }).eq('id', citaId);
    setCitas(prev => prev.map(c => c.id === citaId ? { ...c, estado_detallado: estado } : c));
  }, []);

  // Filtered by period
  const citasPeriodo = useMemo(() => {
    const now = new Date();
    if (periodo === 'all') return citas;
    const days = { '30d': 30, '90d': 90, '180d': 180 }[periodo];
    const cutoff = new Date(now.getTime() - days * 86400000);
    return citas.filter(c => c.hora_inicio && new Date(c.hora_inicio) >= cutoff);
  }, [citas, periodo]);

  // Filtered by segment
  const citasFiltradas = useMemo(() => {
    if (segmento === 'all') return citasPeriodo;
    return citasPeriodo.filter(c => {
      const ed = inferEstadoDetallado(c);
      if (segmento === 'completadas') return ed === 'completada';
      if (segmento === 'canceladas')  return ed === 'cancelacion_anticipada' || ed === 'cancelacion_tardia';
      if (segmento === 'noshow')      return ed === 'no_show_real' || ed === 'no_show_justificado';
      return true;
    });
  }, [citasPeriodo, segmento]);

  // Analytics from period citas
  const fiab = useMemo(() => calcularFiabilidad(citas), [citas]);
  const stats = useMemo(() => {
    const completadas = citasPeriodo.filter(c => inferEstadoDetallado(c) === 'completada').length;
    const canceladas  = citasPeriodo.filter(c => ['cancelacion_anticipada','cancelacion_tardia'].includes(inferEstadoDetallado(c))).length;
    const noShows     = citasPeriodo.filter(c => ['no_show_real','no_show_justificado'].includes(inferEstadoDetallado(c))).length;
    const total = citasPeriodo.length;

    // Frequency from all completed past citas
    const past = citas.filter(c => inferEstadoDetallado(c) === 'completada' && new Date(c.hora_inicio) <= new Date());
    let freq: number | null = null;
    if (past.length >= 2) {
      const ts = past.map(c => new Date(c.hora_inicio).getTime()).sort((a,b) => b-a);
      let td = 0; for (let i = 0; i < ts.length-1; i++) td += ts[i]-ts[i+1];
      freq = Math.round(td / ((ts.length-1) * 86400000));
    }

    const lastPast = past[0] ? new Date(past[0].hora_inicio) : null;
    const daysSince = lastPast ? Math.floor((new Date().getTime() - lastPast.getTime()) / 86400000) : null;

    const ingresos = citas.filter(c => c.importe > 0).reduce((s, c) => s + parseFloat(c.importe || 0), 0);
    const mediaPor = citas.filter(c => c.importe > 0).length > 0 ? ingresos / citas.filter(c => c.importe > 0).length : 0;

    const svc: Record<string, number> = {};
    citas.forEach(c => { const nm = c.servicios?.nombre || c.servicio_nombre_libre; if (nm) svc[nm] = (svc[nm]||0)+1; });
    const top = Object.entries(svc).sort((a,b) => b[1]-a[1])[0];

    return { completadas, canceladas, noShows, total, freq, daysSince, ingresos, mediaPor, top };
  }, [citas, citasPeriodo]);

  async function save() {
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio'); return; }
    setGuardando(true); setErrorForm('');
    const { error } = await supabase.from('clientes').update({ nombre: form.nombre.trim(), telefono: form.telefono.trim() || null, email: form.email.trim() || null, notas: form.notas.trim() || null }).eq('id', cliente.id);
    if (error) { setErrorForm('Error al guardar'); setGuardando(false); return; }
    setClienteData(p => ({ ...p, nombre: form.nombre, telefono: form.telefono, email: form.email, notas: form.notas }));
    setModalOpen(false); setGuardando(false);
  }

  async function del() {
    await supabase.from('clientes').delete().eq('id', cliente.id);
    onVolver();
  }

  const PERIODOS: { key: PeriodoFiltro; label: string }[] = [
    { key: '30d', label: '30d' }, { key: '90d', label: '3m' }, { key: '180d', label: '6m' }, { key: 'all', label: 'Todo' },
  ];

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.textDim }}>Cargando...</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={{ color: C.textMid, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
          <ArrowLeft size={20} />
        </button>

        {/* Avatar + nombre */}
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: C.accent, flexShrink: 0 }}>
          {clienteData.nombre[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{clienteData.nombre}</h2>
          {clienteData.telefono && <span style={{ fontSize: 12, color: C.textMid }}>{clienteData.telefono}</span>}
        </div>

        <RiskBadge fiab={fiab} />

        <button onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.textMid, background: C.panelAlt, border: `1px solid ${C.divider}`, cursor: 'pointer', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
          <Edit2 size={13} /> Editar
        </button>

        <button onClick={() => onCrearCita?.(clienteData.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
          <Calendar size={14} /> Crear cita
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 16px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* Alert */}
        <div style={{ marginBottom: 16 }}>
          <AlertBanner fiab={fiab} />
        </div>

        {/* Periodo filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Periodo</span>
          <div style={{ display: 'flex', background: C.panelAlt, borderRadius: 10, padding: 3, gap: 2 }}>
            {PERIODOS.map(p => (
              <button key={p.key} onClick={() => { setPeriodo(p.key); setSegmento('all'); }}
                style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: periodo === p.key ? C.panel : 'transparent', color: periodo === p.key ? C.text : C.textDim, transition: 'all 0.15s' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Donut grande centrado */}
        <div style={{ background: C.panel, borderRadius: 16, padding: '24px 20px', marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <DonutInteractivo
            completadas={stats.completadas} canceladas={stats.canceladas} noShows={stats.noShows}
            total={stats.total} periodo={periodo}
            segmentoActivo={segmento} onSegmentoClick={setSegmento}
          />
        </div>

        {/* KPIs 2x2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <KpiCard
            value={stats.freq ? `~${stats.freq}` : '—'} suffix={stats.freq ? 'días' : ''}
            label="Frecuencia media" color={C.blue}
          />
          <KpiCard
            value={stats.daysSince !== null ? stats.daysSince : '—'} suffix={stats.daysSince !== null ? 'd' : ''}
            label="Desde última visita"
            color={stats.daysSince !== null && stats.daysSince > 60 ? C.red : stats.daysSince !== null && stats.daysSince > 30 ? C.amber : C.text}
          />
          <KpiCard
            value={stats.noShows} label="No-shows (total)"
            color={stats.noShows > 0 ? C.red : C.textMid}
            active={segmento === 'noshow'}
            onClick={() => setSegmento(segmento === 'noshow' ? 'all' : 'noshow')}
          />
          <KpiCard
            value={stats.total} label={`Citas ${periodLabel(periodo).toLowerCase()}`}
            color={C.textMid}
          />
        </div>

        {/* Ingreso (si aplica) */}
        {mostrarImporte && stats.ingresos > 0 && (
          <div style={{ background: C.panel, borderRadius: 12, padding: '14px 18px', marginBottom: 12, display: 'flex', gap: 24, alignItems: 'center' }}>
            <DollarSign size={18} style={{ color: C.accent, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{stats.ingresos.toFixed(0)}€</span>
              <span style={{ fontSize: 11, color: C.textDim, marginLeft: 6 }}>total · {stats.mediaPor.toFixed(0)}€/visita</span>
            </div>
            {clienteData.telefono && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <a href={`tel:${clienteData.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.divider}`, color: C.textMid, textDecoration: 'none', fontSize: 12 }}>
                  <Phone size={12} /> Llamar
                </a>
                <a href={`https://wa.me/${clienteData.telefono.replace(/\s/g,'')}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.divider}`, color: C.textMid, textDecoration: 'none', fontSize: 12 }}>
                  <MessageCircle size={12} /> WhatsApp
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        <div style={{ background: C.panel, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {segmento === 'all' ? 'Historial' : ({ completadas: 'Completadas', canceladas: 'Canceladas', noshow: 'No-shows' }[segmento])}
              <span style={{ color: C.textDim, fontWeight: 400, marginLeft: 6 }}>({citasFiltradas.length})</span>
            </span>
            {segmento !== 'all' && (
              <button onClick={() => setSegmento('all')} style={{ fontSize: 11, color: C.textDim, background: C.panelAlt, border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: 6 }}>
                Ver todas
              </button>
            )}
          </div>

          <div style={{ padding: '14px 18px' }}>
            {citasFiltradas.length === 0 ? (
              <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: '20px 0' }}>Sin citas en este filtro</p>
            ) : (
              citasFiltradas.slice(0, 30).map((c, i, arr) => (
                <HistoryRow key={c.id} cita={c} isLast={i === arr.length - 1} onChangeEstado={handleChangeEstado} />
              ))
            )}
            {citasFiltradas.length > 30 && (
              <p style={{ fontSize: 11, color: C.textDim, textAlign: 'center', marginTop: 8 }}>+{citasFiltradas.length - 30} más en el historial completo</p>
            )}
          </div>
        </div>

        {/* Datos cliente + eliminar */}
        <div style={{ background: C.panel, borderRadius: 12, padding: '14px 18px', marginTop: 12, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' }}>Contacto</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {clienteData.telefono ? <a href={`tel:${clienteData.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.text, textDecoration: 'none', fontSize: 12 }}><Phone size={12} style={{ color: C.accent }} />{clienteData.telefono}</a> : <span style={{ fontSize: 11, color: C.textDim }}>Sin teléfono</span>}
              {clienteData.email && <a href={`mailto:${clienteData.email}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.text, textDecoration: 'none', fontSize: 12 }}><Mail size={12} style={{ color: C.blue }} />{clienteData.email}</a>}
            </div>
            {clienteData.notas && <p style={{ fontSize: 11, color: C.textMid, marginTop: 8, lineHeight: 1.5 }}>{clienteData.notas}</p>}
            <p style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>Cliente desde {fmtDate(clienteData.created_at)} · {stats.top ? `Favorito: ${stats.top[0]}` : ''}</p>
          </div>

          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: '6px 10px', borderRadius: 8 }}>
              <Trash2 size={13} /> Eliminar
            </button>
          ) : (
            <div style={{ background: C.redDim, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>¿Eliminar?</span>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: C.panelAlt, color: C.text, cursor: 'pointer', fontSize: 12 }}>No</button>
              <button onClick={del} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Sí</button>
            </div>
          )}
        </div>

        <div style={{ height: 80 }} />
      </div>

      {modalOpen && <ModalCliente editando form={form} setForm={setForm} guardando={guardando} error={errorForm} onGuardar={save} onCerrar={() => setModalOpen(false)} />}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function ClientesSection({ empresaId }: { empresaId: string }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [vistaDetalle, setVistaDetalle] = useState<Cliente | null>(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [mostrarImporte, setMostrarImporte] = useState(false);
  const [form, setForm] = useState<FormCliente>({ nombre: '', telefono: '', email: '', notas: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (empresaId) { load(); loadConfig(); } }, [empresaId]);

  async function load() { setLoading(true); const { data } = await supabase.from('clientes').select('*').eq('empresa_id', empresaId).order('nombre'); setClientes(data || []); setLoading(false); }
  async function loadConfig() { const { data } = await supabase.from('empresas').select('mostrar_importe').eq('id', empresaId).single(); setMostrarImporte(data?.mostrar_importe || false); }

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono || '').includes(busqueda) ||
    (c.email || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  async function saveNuevo() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true); setError('');
    const { error } = await supabase.from('clientes').insert({ empresa_id: empresaId, nombre: form.nombre.trim(), telefono: form.telefono.trim() || null, email: form.email.trim() || null, notas: form.notas.trim() || null });
    if (error) { setError('Error al crear'); setGuardando(false); return; }
    await load(); setModalNuevo(false); setGuardando(false); setForm({ nombre: '', telefono: '', email: '', notas: '' });
  }

  if (vistaDetalle) return (
    <VistaDetalle
      cliente={vistaDetalle} empresaId={empresaId} mostrarImporte={mostrarImporte}
      onVolver={() => setVistaDetalle(null)}
    />
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Clientes</h2>
          <button onClick={() => { setForm({ nombre: '', telefono: '', email: '', notas: '' }); setError(''); setModalNuevo(true); }}
            style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Nuevo
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMid }} />
          <input type="text" placeholder="Buscar por nombre, teléfono o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: C.panelAlt, border: `1px solid ${C.divider}`, borderRadius: 12, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {busqueda && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMid }}><X size={16} /></button>}
        </div>
      </div>

      {/* Lista */}
      <div style={{ padding: '12px 16px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textMid }}>Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: C.textMid, fontSize: 15 }}>{busqueda ? 'No hay resultados' : 'Aún no tienes clientes'}</p>
            {!busqueda && <button onClick={() => setModalNuevo(true)} style={{ marginTop: 16, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Añadir primer cliente</button>}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: C.textMid, marginBottom: 10 }}>{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(cl => (
                <button key={cl.id} onClick={() => setVistaDetalle(cl)}
                  style={{ background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.panelAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.panel)}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
                    {cl.nombre[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{cl.nombre}</p>
                    <p style={{ fontSize: 12, color: C.textMid, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.telefono || cl.email || 'Sin contacto'}</p>
                  </div>
                  <ChevronRight size={16} style={{ color: C.textMid, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {modalNuevo && <ModalCliente editando={false} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={saveNuevo} onCerrar={() => setModalNuevo(false)} />}
    </div>
  );
}
