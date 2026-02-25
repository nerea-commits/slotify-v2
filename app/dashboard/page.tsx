'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Plus, X, Edit2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import NuevaCitaModal from '@/components/NuevaCitaModal';
import ClientesSection from '@/components/ClientesSection';
import { calcularFiabilidad, getRiskIndicator } from '@/lib/fiabilidad';

const ALL_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

function timeToMinutes(t: string) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function toDS(d: Date) {
  const y = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${y}-${mo}-${dd}`;
}

function rawDate(s: string): string {
  return (s || '').substring(0, 10);
}

function rawTimeMin(s: string): number {
  if (!s) return 0;
  const sep = s.indexOf('T') !== -1 ? s.indexOf('T') : s.indexOf(' ');
  if (sep === -1) return 0;
  const [h, m] = s.substring(sep + 1).split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

const C = {
  bg: '#0F172A', surface: '#1E293B', surfaceAlt: '#243247', occupied: '#334155',
  green: '#22C55E', greenSel: '#16A34A', greenBg: 'rgba(34,197,94,0.12)',
  yellow: '#F59E0B', orange: '#FB923C', red: '#EF4444',
  text: '#F1F5F9', textSec: '#94A3B8',
};

type ViewMode = 'day' | 'week' | 'month';

export default function Dashboard() {
  const [view, setView] = useState<ViewMode>('day');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allCitas, setAllCitas] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any>(null);
  const [profesional, setProfesional] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedCita, setSelectedCita] = useState<any>(null);
  const [editingCita, setEditingCita] = useState<any>(null);
  const [preselectedTime, setPreselectedTime] = useState('');
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null);
  const [currentMinutes, setCurrentMinutes] = useState(-1);
  const [activeSection, setActiveSection] = useState<string>('agenda');
  const [estadosCita, setEstadosCita] = useState<any[]>([]);
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());

  // Edit form state
  const [editServicio, setEditServicio] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editHoraInicio, setEditHoraInicio] = useState('');
  const [editHoraFin, setEditHoraFin] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Risk indicator cache
  const [clientRiskCache, setClientRiskCache] = useState<Record<string, { show: boolean; color: string; icon: string | null }>>({});

  const empresaIdRef = useRef<string | null>(null);
  const profesionalIdRef = useRef<string | null>(null);
  const isAdminRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      const eid = localStorage.getItem('slotify_empresa_id');
      const pid = localStorage.getItem('slotify_profesional_id');
      const admin = localStorage.getItem('slotify_rol') === 'admin';
      isAdminRef.current = admin;
      empresaIdRef.current = eid;
      profesionalIdRef.current = pid;
      setIsAdmin(admin);
      if (eid) {
        supabase.from('empresas').select('*').eq('id', eid).single()
          .then(({ data }) => { if (data) setEmpresa(data); });
        supabase.from('estados_cita').select('*').eq('empresa_id', eid).eq('activo', true).order('orden')
          .then(({ data }) => { if (data) setEstadosCita(data); });
      }
      if (pid) {
        supabase.from('profesionales').select('*').eq('id', pid).single()
          .then(({ data }) => { if (data) setProfesional(data); });
      } else if (eid) {
        supabase.from('profesionales').select('*').eq('empresa_id', eid).limit(1).single()
          .then(({ data }) => {
            if (data) {
              setProfesional(data);
              localStorage.setItem('slotify_profesional_id', data.id);
              profesionalIdRef.current = data.id;
            }
          });
      }
    }
    init();
  }, []);

  useEffect(() => {
    function tick() { const n = new Date(); setCurrentMinutes(n.getHours() * 60 + n.getMinutes()); }
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { loadAllCitas(); }, [selectedDate, view]);
  useEffect(() => { if (profesional) { profesionalIdRef.current = profesional.id; loadAllCitas(); } }, [profesional]);

  function loadClientRisks(citas: any[]) {
    const citasPorCliente: Record<string, any[]> = {};
    citas.forEach(c => {
      if (c.cliente_id) {
        if (!citasPorCliente[c.cliente_id]) citasPorCliente[c.cliente_id] = [];
        citasPorCliente[c.cliente_id].push(c);
      }
    });
    const riskMap: Record<string, { show: boolean; color: string; icon: string | null }> = {};
    Object.entries(citasPorCliente).forEach(([clienteId, clienteCitas]) => {
      const fiab = calcularFiabilidad(clienteCitas);
      const risk = getRiskIndicator(fiab);
      riskMap[clienteId] = risk;
    });
    setClientRiskCache(riskMap);
  }

  async function loadAllCitas() {
    const eid = empresaIdRef.current || localStorage.getItem('slotify_empresa_id');
    if (!eid) return;
    const admin = isAdminRef.current || localStorage.getItem('slotify_rol') === 'admin';
    const pid = profesionalIdRef.current || localStorage.getItem('slotify_profesional_id');
    const ref = new Date(selectedDate);
    const from = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const to = new Date(ref.getFullYear(), ref.getMonth() + 2, 0);
    let q = supabase.from('citas')
      .select('*, clientes(nombre, telefono), servicios(nombre)')
      .eq('empresa_id', eid)
      .gte('hora_inicio', `${toDS(from)}T00:00:00`)
      .lte('hora_inicio', `${toDS(to)}T23:59:59`);
    if (!admin && pid) q = q.eq('profesional_id', pid);
    const { data, error } = await q.order('hora_inicio');
    if (error) console.error('loadAllCitas error:', error);
    const citas = data || [];
    setAllCitas(citas);
    loadClientRisks(citas);
  }

  const scheduleStart = empresa?.horario_inicio || '09:00';
  const scheduleEnd = empresa?.horario_fin || '18:00';
  const startMin = timeToMinutes(scheduleStart);
  const endMin = timeToMinutes(scheduleEnd);
  const visibleSlots = ALL_SLOTS.filter(s => {
    const m = timeToMinutes(s);
    return m >= startMin && m < endMin;
  });
  const totalSlots = visibleSlots.length;

  function parseDiasLaborables(raw: any): number[] {
    const fallback = [1, 2, 3, 4, 5];
    if (!raw) return fallback;
    if (Array.isArray(raw)) {
      if (raw.length === 0) return fallback;
      const nums = raw.map((x: any) => {
        if (typeof x === 'number') return x;
        if (typeof x === 'string') return Number(x);
        if (typeof x === 'object' && x !== null) {
          const val = x.value ?? x.day ?? x.id ?? Object.values(x)[0];
          return Number(val);
        }
        return NaN;
      }).filter((n: number) => !isNaN(n) && n >= 1 && n <= 7);
      return nums.length > 0 ? nums : fallback;
    }
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[{}\[\]\s]/g, '');
      if (!cleaned) return fallback;
      const nums = cleaned.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 7);
      return nums.length > 0 ? nums : fallback;
    }
    return fallback;
  }

  const diasLaborables = parseDiasLaborables(empresa?.dias_laborables);

  function isWorkingDay(d: Date): boolean {
    const dow = d.getDay();
    const isoDay = dow === 0 ? 7 : dow;
    return diasLaborables.includes(isoDay);
  }

  // Canceladas NO aparecen en vistas operativas
  function citasForDate(d: Date): any[] {
    const ds = toDS(d);
    return allCitas.filter(c =>
      c.hora_inicio &&
      rawDate(c.hora_inicio) === ds &&
      (c.estado || '').toLowerCase() !== 'cancelada'
    );
  }

  function activeCitasForDate(d: Date): any[] {
    return citasForDate(d);
  }

  function slotOccupied(citas: any[], slot: string): boolean {
    const slotM = timeToMinutes(slot);
    return citas.some(c => {
      const sm = rawTimeMin(c.hora_inicio);
      const em = c.hora_fin ? rawTimeMin(c.hora_fin) : sm + 30;
      return slotM >= sm && slotM < em;
    });
  }

  function freeSlotCount(d: Date): number {
    const citas = activeCitasForDate(d);
    return visibleSlots.filter(s => !slotOccupied(citas, s)).length;
  }

  function getAvailability(freeCount: number) {
    if (!totalSlots) return { label: '', color: C.textSec };
    if (freeCount === 0) return { label: 'Completo', color: C.red };
    const ratio = freeCount / totalSlots;
    if (ratio > 0.7) return { label: `${freeCount} libres`, color: C.green };
    if (ratio > 0.4) return { label: `${freeCount} libres`, color: C.yellow };
    return { label: `${freeCount} libres`, color: C.orange };
  }

  function citaColor(estado: string): string {
    if (!estado) return C.green;
    const estadoNombre = estado.toLowerCase();
    const found = estadosCita.find(e => {
      const nombre = (e.nombre_personalizado || e.nombre_defecto || '').toLowerCase();
      return nombre === estadoNombre || nombre.includes(estadoNombre) || estadoNombre.includes(nombre.split(' ')[0]);
    });
    if (found) return found.color;
    if (estadoNombre === 'cancelada') return C.textSec;
    if (estadoNombre === 'pendiente') return C.yellow;
    if (estadoNombre === 'no-show' || estadoNombre === 'no_show') return C.orange;
    if (estadoNombre === 'lista de espera') return '#8B5CF6';
    if (estadoNombre === 'en proceso') return '#3B82F6';
    if (estadoNombre === 'completada') return C.textSec;
    return C.green;
  }

  function citaEstadoNombre(estado: string): string {
    if (!estado) return 'Confirmada';
    const estadoNombre = estado.toLowerCase();
    const found = estadosCita.find(e => {
      const nombre = (e.nombre_personalizado || e.nombre_defecto || '').toLowerCase();
      return nombre === estadoNombre || nombre.includes(estadoNombre) || estadoNombre.includes(nombre.split(' ')[0]);
    });
    if (found) return found.nombre_personalizado || found.nombre_defecto;
    return estado.charAt(0).toUpperCase() + estado.slice(1);
  }

  function isToday(d: Date) { return d.toDateString() === new Date().toDateString(); }
  function formatDate(d: Date) { return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function formatMonth(d: Date) { return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); }
  function changeDay(n: number) { const d = new Date(selectedDate); d.setDate(d.getDate() + n); setSelectedDate(d); }
  function changeWeek(n: number) { const d = new Date(selectedDate); d.setDate(d.getDate() + n * 7); setSelectedDate(d); }
  function changeMonth(n: number) { const d = new Date(selectedDate); d.setMonth(d.getMonth() + n); setSelectedDate(d); }
  function goToDay(d: Date) { setSelectedDate(new Date(d)); setView('day'); }

  function getWeekDays(): Date[] {
    const d = new Date(selectedDate);
    const dow = d.getDay() || 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - dow + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(mon); x.setDate(mon.getDate() + i); return x;
    });
  }

  function getMonthDays(refDate?: Date): (Date | null)[] {
    const base = refDate || selectedDate;
    const y = base.getFullYear(), mo = base.getMonth();
    const lastDay = new Date(y, mo + 1, 0).getDate();
    const startDow = new Date(y, mo, 1).getDay() || 7;
    const days: (Date | null)[] = [];
    for (let i = 1; i < startDow; i++) days.push(null);
    for (let day = 1; day <= lastDay; day++) days.push(new Date(y, mo, day));
    return days;
  }

  function openEdit(cita: any) {
    setSelectedCita(null);
    setEditingCita(cita);
    setEditServicio(cita.servicios?.nombre || cita.servicio_nombre_libre || '');
    setEditNotas(cita.notas || '');
    setEditHoraInicio(cita.hora_inicio?.substring(11, 16) || '');
    setEditHoraFin(cita.hora_fin?.substring(11, 16) || '');
    setEditEstado(cita.estado || '');
    setEditError('');
  }

  // ═══ VALIDAR SOLAPAMIENTO (para edición) ═══
  async function validarSolapamientoEdicion(dateStr: string, inicio: string, fin: string, excludeId: string): Promise<string | null> {
    const eid = empresaIdRef.current || localStorage.getItem('slotify_empresa_id');
    const pid = profesionalIdRef.current || localStorage.getItem('slotify_profesional_id');
    if (!eid || !pid) return null;

    const hInicioISO = `${dateStr}T${inicio}:00`;
    const hFinISO = `${dateStr}T${fin}:00`;

    const { data, error } = await supabase
      .from('citas')
      .select('id, hora_inicio, hora_fin, estado, clientes(nombre)')
      .eq('empresa_id', eid)
      .eq('profesional_id', pid)
      .neq('estado', 'cancelada')
      .neq('estado', 'Cancelada')
      .neq('id', excludeId)
      // Solapamiento: start < newEnd AND end > newStart
      .lt('hora_inicio', hFinISO)
      .gt('hora_fin', hInicioISO);

    if (error) { console.error('Error validando solapamiento edición:', error); return null; }
    if (data && data.length > 0) {
      const conflicto = data[0];
      const _cl = conflicto.clientes; const clienteConflicto = (Array.isArray(_cl) ? _cl[0]?.nombre : (_cl as any)?.nombre) || 'otro cliente';
      const horaConflicto = conflicto.hora_inicio?.substring(11, 16) || '';
      return `Conflicto de horario: ya hay una cita con ${clienteConflicto} a las ${horaConflicto}. Elige otro horario.`;
    }
    return null;
  }

  async function guardarEdicion() {
    if (!editingCita) return;
    if (editHoraFin <= editHoraInicio) {
      setEditError('La hora de fin debe ser posterior a la de inicio');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      const dateStr = rawDate(editingCita.hora_inicio);

      // Validar solapamiento (excluyendo la cita actual)
      const conflicto = await validarSolapamientoEdicion(dateStr, editHoraInicio, editHoraFin, editingCita.id);
      if (conflicto) {
        setEditError(conflicto);
        setEditLoading(false);
        return;
      }

      const updates: any = {
        hora_inicio: `${dateStr}T${editHoraInicio}:00`,
        hora_fin: `${dateStr}T${editHoraFin}:00`,
        notas: editNotas || null,
        estado: editEstado,
        servicio_nombre_libre: editServicio || null,
      };
      await supabase.from('citas').update(updates).eq('id', editingCita.id);
      setEditingCita(null);
      loadAllCitas();
    } catch (e) {
      console.error(e);
      setEditError('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setEditLoading(false);
    }
  }

  async function cancelarCita(id: string) {
    await supabase.from('citas').update({ estado: 'cancelada' }).eq('id', id);
    setSelectedCita(null);
    setEditingCita(null);
    loadAllCitas();
  }

  function openModal(date?: Date, time?: string) {
    setPreselectedDate(date ? new Date(date) : null);
    setPreselectedTime(time || '');
    setModalOpen(true);
  }

  function isInCurrentWeek(d: Date): boolean {
    return getWeekDays().some(wd => wd.toDateString() === d.toDateString());
  }

  const weekDayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const WEEK_SLOT_H = 28;

  // ═══ RENDER BLOQUE DE CITA ═══
  // Línea 2 usa el mismo color base que línea 1, diferenciado por font-weight
  function renderCitaBlock(cita: any, style: React.CSSProperties) {
    const name = cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente';
    const svc = cita.servicios?.nombre || cita.servicio_nombre_libre || '';
    const notas = cita.notas || '';
    const linea2 = svc && notas ? `${svc} - ${notas}` : svc || notas;
    const color = citaColor(cita.estado);
    const fs = (style.fontSize as number) || 10;
    const risk = cita.cliente_id ? clientRiskCache[cita.cliente_id] : null;

    return (
      <div
        key={cita.id}
        onClick={() => setSelectedCita(cita)}
        style={{
          ...style,
          background: `${color}1A`,
          borderLeft: `3px solid ${color}`,
          cursor: 'pointer',
          overflow: 'hidden',
          zIndex: 10,
          pointerEvents: 'auto',
          boxShadow: `0 1px 4px ${color}22`,
        }}
      >
        {/* Línea 1: Nombre — font-weight 700, color principal del estado */}
        <div style={{
          fontSize: fs,
          fontWeight: 700,
          color: color,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {risk?.show && (
            <span style={{ fontSize: Math.max(fs - 2, 8), lineHeight: 1, flexShrink: 0, opacity: 0.85 }}>
              {risk.icon}
            </span>
          )}
        </div>
        {/* Línea 2: Servicio - Notas — mismo color, font-weight 400 */}
        {linea2 && (
          <div style={{
            fontSize: fs - 1,
            fontWeight: 400,
            color: color,
            opacity: 0.75,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {linea2}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg, color: C.text }}>

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: C.surface, borderBottom: `1px solid ${C.surfaceAlt}` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: C.green }}>
            {empresa?.nombre?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold">{empresa?.nombre || 'Mi negocio'}</p>
            <p className="text-xs flex items-center gap-1" style={{ color: C.textSec }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: C.green }} />
              {profesional?.nombre || ''}
            </p>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg" style={{ color: C.textSec }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* SECCIONES */}
      {activeSection !== 'agenda' && (
        <div className="flex-1 overflow-y-auto" style={{ background: C.bg }}>
          {activeSection === 'clientes' && <ClientesSection empresaId={empresa?.id || ''} />}
          {activeSection === 'servicios' && <div className="flex items-center justify-center pt-32 text-gray-500">Servicios — próximamente</div>}
          {activeSection === 'estadisticas' && <div className="flex items-center justify-center pt-32 text-gray-500">Estadísticas — próximamente</div>}
          {activeSection === 'notificaciones' && <div className="flex items-center justify-center pt-32 text-gray-500">Notificaciones — próximamente</div>}
          {activeSection === 'configuracion' && <div className="flex items-center justify-center pt-32 text-gray-500">Configuración — próximamente</div>}
        </div>
      )}

      {/* AGENDA */}
      {activeSection === 'agenda' && (<>

        {/* TABS */}
        <div className="flex justify-center gap-2 py-3 px-4 flex-shrink-0"
          style={{ background: C.surface, borderBottom: `1px solid ${C.surfaceAlt}` }}>
          {(['day', 'week', 'month'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-5 py-2 rounded-full text-sm font-medium"
              style={{
                background: view === v ? C.green : 'transparent',
                color: view === v ? '#fff' : C.textSec,
                border: view === v ? 'none' : `1px solid ${C.surfaceAlt}`,
              }}>
              {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* ── VISTA DÍA ── */}
        {view === 'day' && (<>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: C.surface, borderBottom: `1px solid ${C.surfaceAlt}` }}>
            <button onClick={() => changeDay(-1)} className="p-2 rounded-full"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-center">
              <p className="text-sm font-medium capitalize">{formatDate(selectedDate)}</p>
              {isToday(selectedDate) && <p className="text-xs font-semibold" style={{ color: C.green }}>Hoy</p>}
            </div>
            <button onClick={() => changeDay(1)} className="p-2 rounded-full"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ paddingTop: 24, paddingBottom: 80 }}>
            <div className="relative flex" style={{ minHeight: visibleSlots.length * 50, paddingLeft: 16, paddingRight: 16 }}>
              <div style={{ width: 64, flexShrink: 0 }}>
                {visibleSlots.map(slot => (
                  <div key={slot} className="flex items-start justify-end pr-3" style={{ height: 50 }}>
                    <span style={{ fontSize: 11, color: C.textSec, fontWeight: slot.endsWith(':00') ? 600 : 400, opacity: slot.endsWith(':00') ? 1 : 0.4 }}>
                      {slot}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex-1 relative" style={{ background: C.surface, borderRadius: 16, overflow: 'hidden' }}>
                {visibleSlots.map(slot => (
                  <div key={slot} onClick={() => openModal(selectedDate, slot)} className="cursor-pointer"
                    style={{ height: 50, borderBottom: `1px solid ${slot.endsWith(':00') ? C.surfaceAlt : 'rgba(36,50,71,0.4)'}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.greenBg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  />
                ))}
                <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                  {citasForDate(selectedDate).map(cita => {
                    const citaStart = rawTimeMin(cita.hora_inicio);
                    const citaEnd = cita.hora_fin ? rawTimeMin(cita.hora_fin) : citaStart + 30;
                    const dur = Math.max(citaEnd - citaStart, 30);
                    const top = ((citaStart - startMin) / 30) * 50;
                    const h = (dur / 30) * 50;
                    return renderCitaBlock(cita, {
                      position: 'absolute', top, height: h, left: 8, right: 8,
                      borderRadius: 10, padding: '8px 12px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
                      fontSize: 13,
                    });
                  })}
                </div>
                {isToday(selectedDate) && currentMinutes >= startMin && currentMinutes < endMin && (
                  <div className="absolute left-0 right-0 pointer-events-none" style={{ top: ((currentMinutes - startMin) / 30) * 50, zIndex: 30 }}>
                    <div className="flex items-center">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, boxShadow: '0 0 6px rgba(239,68,68,0.8)' }} />
                      <div style={{ flex: 1, height: 2, background: C.red, opacity: 0.85 }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => openModal(selectedDate, '')}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
            style={{ background: C.green }}>
            <Plus className="w-6 h-6 text-white" />
          </button>
        </>)}

        {/* ── VISTA SEMANA ── */}
        {view === 'week' && (
          <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>

            {/* MINI CALENDARIO lateral */}
            <div style={{
              width: 196, flexShrink: 0,
              borderRight: `1px solid ${C.surfaceAlt}`,
              background: C.surface,
              padding: '16px 10px',
              display: 'flex', flexDirection: 'column', gap: 0,
              overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x; })}
                  style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: 'capitalize', letterSpacing: 0.3 }}>
                  {miniCalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; })}
                  style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 9, color: C.textSec, fontWeight: 700, padding: '1px 0' }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {getMonthDays(miniCalMonth).map((day, i) => {
                  if (!day) return <div key={`e${i}`} style={{ height: 22 }} />;
                  const today = isToday(day);
                  const inWeek = isInCurrentWeek(day);
                  const hasCitas = allCitas.some(c =>
                    rawDate(c.hora_inicio) === toDS(day) &&
                    (c.estado || '').toLowerCase() !== 'cancelada'
                  );
                  return (
                    <div key={i} onClick={() => setSelectedDate(new Date(day))}
                      style={{
                        textAlign: 'center', fontSize: 10, lineHeight: '22px', height: 22,
                        borderRadius: 4, cursor: 'pointer',
                        background: today ? C.green : inWeek ? `${C.green}25` : 'transparent',
                        color: today ? '#fff' : inWeek ? C.green : C.text,
                        fontWeight: inWeek || today ? 700 : 400,
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!today && !inWeek) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
                      onMouseLeave={e => { if (!today && !inWeek) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {day.getDate()}
                      {hasCitas && (
                        <div style={{
                          position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                          width: 3, height: 3, borderRadius: '50%',
                          background: today ? 'rgba(255,255,255,0.7)' : inWeek ? C.green : C.textSec,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => { const t = new Date(); setSelectedDate(t); setMiniCalMonth(t); }}
                style={{
                  marginTop: 14, padding: '6px 0', borderRadius: 8,
                  border: `1px solid ${C.surfaceAlt}`, background: 'transparent',
                  color: C.textSec, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                  letterSpacing: 0.2,
                }}>
                Hoy
              </button>
            </div>

            {/* GRID SEMANA */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '10px 12px 0' }}>
              <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 8 }}>
                <button onClick={() => changeWeek(-1)} className="p-2" style={{ color: C.textSec }}><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-sm font-semibold">
                  {(() => { const d = getWeekDays(); return `${d[0].getDate()} – ${d[6].getDate()} ${d[6].toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`; })()}
                </span>
                <button onClick={() => changeWeek(1)} className="p-2" style={{ color: C.textSec }}><ChevronRight className="w-5 h-5" /></button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 80 }}>
                <div style={{ display: 'flex', gap: 3, minHeight: visibleSlots.length * WEEK_SLOT_H + 44 }}>
                  <div style={{ width: 38, flexShrink: 0, paddingTop: 44 }}>
                    {visibleSlots.map((slot, si) => (
                      <div key={si} style={{ height: WEEK_SLOT_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 4 }}>
                        <span style={{ fontSize: slot.endsWith(':00') ? 10 : 8, color: C.textSec, fontWeight: slot.endsWith(':00') ? 600 : 400, opacity: slot.endsWith(':00') ? 1 : 0.35, lineHeight: 1 }}>
                          {slot}
                        </span>
                      </div>
                    ))}
                  </div>

                  {getWeekDays().map((day, di) => {
                    const today = isToday(day);
                    const working = isWorkingDay(day);
                    const dayCitas = citasForDate(day);

                    return (
                      <div key={di} style={{
                        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                        background: working ? C.surface : 'rgba(15,23,42,0.3)',
                        borderRadius: 10,
                        border: today ? `2px solid ${C.green}` : `1px solid rgba(148,163,184,0.1)`,
                        overflow: 'hidden',
                      }}>
                        <div onClick={() => goToDay(day)} className="cursor-pointer text-center flex-shrink-0"
                          style={{
                            height: 44, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            background: today ? 'rgba(34,197,94,0.15)' : 'rgba(36,50,71,0.4)',
                            borderBottom: `1px solid rgba(148,163,184,0.08)`,
                          }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: C.textSec, letterSpacing: 0.8 }}>{weekDayNames[di]}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: today ? C.green : C.text }}>{day.getDate()}</div>
                          {today && <div style={{ fontSize: 7, color: C.green, fontWeight: 700 }}>HOY</div>}
                        </div>

                        <div style={{ position: 'relative', height: visibleSlots.length * WEEK_SLOT_H }}>
                          {visibleSlots.map((slot, si) => {
                            const occ = slotOccupied(dayCitas, slot);
                            return (
                              <div key={si}
                                onClick={() => { if (!occ) openModal(day, slot); }}
                                style={{
                                  height: WEEK_SLOT_H,
                                  borderBottom: `1px solid ${slot.endsWith(':00') ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.07)'}`,
                                  cursor: occ ? 'default' : 'pointer',
                                }}
                                onMouseEnter={e => { if (!occ) (e.currentTarget as HTMLElement).style.background = C.greenBg; }}
                                onMouseLeave={e => { if (!occ) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              />
                            );
                          })}

                          {dayCitas.map(cita => {
                            const citaStart = rawTimeMin(cita.hora_inicio);
                            const citaEnd = cita.hora_fin ? rawTimeMin(cita.hora_fin) : citaStart + 30;
                            const dur = Math.max(citaEnd - citaStart, 30);
                            const top = ((citaStart - startMin) / 30) * WEEK_SLOT_H;
                            const h = (dur / 30) * WEEK_SLOT_H;
                            if (top >= visibleSlots.length * WEEK_SLOT_H || top + h <= 0) return null;
                            return renderCitaBlock(cita, {
                              position: 'absolute', top, height: h, left: 2, right: 2,
                              borderRadius: 5, padding: '2px 4px', fontSize: 10,
                            });
                          })}

                          {today && currentMinutes >= startMin && currentMinutes < endMin && (
                            <div style={{
                              position: 'absolute', top: ((currentMinutes - startMin) / 30) * WEEK_SLOT_H,
                              left: 0, right: 0, display: 'flex', alignItems: 'center', zIndex: 20, pointerEvents: 'none',
                            }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, boxShadow: '0 0 5px rgba(239,68,68,0.8)' }} />
                              <div style={{ flex: 1, height: 2, background: C.red, opacity: 0.8 }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button onClick={() => openModal()}
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
              style={{ background: C.green }}>
              <Plus className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* ── VISTA MES ── */}
        {view === 'month' && (
          <div className="flex-1 overflow-y-auto" style={{ padding: '20px 16px 80px' }}>
            <div style={{ background: C.surface, borderRadius: 16, padding: 20, maxWidth: 1100, margin: '0 auto' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <button onClick={() => changeMonth(-1)} className="p-2" style={{ color: C.textSec }}><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="font-semibold capitalize" style={{ fontSize: 18 }}>{formatMonth(selectedDate)}</h2>
                <button onClick={() => changeMonth(1)} className="p-2" style={{ color: C.textSec }}><ChevronRight className="w-5 h-5" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {weekDayNames.map(d => (
                  <div key={d} className="text-center text-xs font-medium" style={{ color: C.textSec, padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {getMonthDays().map((day, i) => {
                  if (!day) return <div key={`e${i}`} />;
                  const today = isToday(day);
                  const working = isWorkingDay(day);
                  const free = working ? freeSlotCount(day) : -1;
                  const av = working ? getAvailability(free) : null;
                  const citasCount = activeCitasForDate(day).length;
                  return (
                    <div key={i} onClick={() => goToDay(day)} className="cursor-pointer"
                      style={{
                        background: C.surfaceAlt, borderRadius: 10, padding: '8px', minHeight: 72,
                        border: today ? `2px solid ${C.green}` : '2px solid transparent',
                        opacity: working ? 1 : 0.35, display: 'flex', flexDirection: 'column',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2d3d54'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: today ? C.green : C.text }}>{day.getDate()}</span>
                      {working && av && (
                        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${totalSlots > 0 ? ((totalSlots - free) / totalSlots) * 100 : 0}%`, borderRadius: 2, background: av.color }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: av.color, display: 'inline-block' }} />
                            <span style={{ fontSize: 10, color: av.color, fontWeight: 600 }}>{av.label}</span>
                          </div>
                          {citasCount > 0 && <span style={{ fontSize: 9, color: C.textSec }}>{citasCount} cita{citasCount !== 1 ? 's' : ''}</span>}
                        </div>
                      )}
                      {!working && <span style={{ fontSize: 9, color: C.textSec, marginTop: 'auto' }}>—</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <button onClick={() => openModal()}
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
              style={{ background: C.green }}>
              <Plus className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* ── MODAL DETALLE CITA ── */}
        {selectedCita && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedCita(null)}>
            <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 className="text-lg font-bold">Detalle de cita</h3>
                <button onClick={() => setSelectedCita(null)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 text-sm mb-6">
                <p><span style={{ color: C.textSec }}>Cliente: </span>{selectedCita.clientes?.nombre || selectedCita.cliente_nombre_libre || '—'}</p>
                <p><span style={{ color: C.textSec }}>Teléfono: </span>{selectedCita.clientes?.telefono || '—'}</p>
                <p><span style={{ color: C.textSec }}>Servicio: </span>{selectedCita.servicios?.nombre || selectedCita.servicio_nombre_libre || '—'}</p>
                <p><span style={{ color: C.textSec }}>Inicio: </span>{selectedCita.hora_inicio?.substring(11, 16) || '—'}</p>
                <p><span style={{ color: C.textSec }}>Fin: </span>{selectedCita.hora_fin?.substring(11, 16) || '—'}</p>
                {selectedCita.notas && <p><span style={{ color: C.textSec }}>Notas: </span>{selectedCita.notas}</p>}
                <p>
                  <span style={{ color: C.textSec }}>Estado: </span>
                  <span style={{ color: citaColor(selectedCita.estado), background: citaColor(selectedCita.estado) + '22', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                    {citaEstadoNombre(selectedCita.estado)}
                  </span>
                </p>
                {selectedCita.cliente_id && clientRiskCache[selectedCita.cliente_id]?.show && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ color: C.textSec }}>Fiabilidad: </span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      color: clientRiskCache[selectedCita.cliente_id].color,
                      background: clientRiskCache[selectedCita.cliente_id].color + '18',
                    }}>
                      {clientRiskCache[selectedCita.cliente_id].icon} Cliente con riesgo
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => openEdit(selectedCita)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: C.surfaceAlt, color: C.text }}>
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
                {(selectedCita.estado || '').toLowerCase() !== 'cancelada' && (
                  <button onClick={() => cancelarCita(selectedCita.id)}
                    className="flex-1 py-2 rounded-xl text-sm text-white" style={{ background: C.red }}>
                    Cancelar cita
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL EDITAR CITA ── */}
        {editingCita && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setEditingCita(null)}>
            <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 className="text-lg font-bold">Editar cita</h3>
                  <p style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                    {editingCita.clientes?.nombre || editingCita.cliente_nombre_libre || 'Cliente'} · {rawDate(editingCita.hora_inicio)}
                  </p>
                </div>
                <button onClick={() => setEditingCita(null)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Servicio</label>
                  <input value={editServicio} onChange={e => setEditServicio(e.target.value)}
                    style={{ width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="Nombre del servicio" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Hora inicio</label>
                    <input type="time" value={editHoraInicio} onChange={e => setEditHoraInicio(e.target.value)}
                      style={{ width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Hora fin</label>
                    <input type="time" value={editHoraFin} onChange={e => setEditHoraFin(e.target.value)}
                      style={{ width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                {estadosCita.length > 0 && (
                  <div>
                    <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 8 }}>Estado</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {estadosCita.map(estado => {
                        const nombre = estado.nombre_personalizado || estado.nombre_defecto;
                        const nombreNorm = nombre.toLowerCase();
                        const selected = editEstado.toLowerCase() === nombreNorm;
                        return (
                          <button key={estado.id} onClick={() => setEditEstado(nombreNorm)}
                            style={{
                              background: selected ? estado.color + '33' : 'rgba(255,255,255,0.05)',
                              border: `1.5px solid ${selected ? estado.color : 'rgba(255,255,255,0.1)'}`,
                              color: selected ? estado.color : C.textSec,
                              borderRadius: 20, padding: '5px 12px', fontSize: 12,
                              fontWeight: selected ? 700 : 400, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: estado.color, display: 'inline-block' }} />
                            {nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Notas</label>
                  <textarea value={editNotas} onChange={e => setEditNotas(e.target.value)} rows={3}
                    style={{ width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                    placeholder="Observaciones, preferencias..." />
                </div>

                {/* Error de edición */}
                {editError && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
                    <p style={{ color: C.red, fontSize: 13, lineHeight: 1.4 }}>⚠ {editError}</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => cancelarCita(editingCita.id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 12, background: `${C.red}22`, border: `1px solid ${C.red}55`, color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar cita
                  </button>
                  <button onClick={guardarEdicion} disabled={editLoading}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 12, background: C.green, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: editLoading ? 0.6 : 1 }}>
                    {editLoading ? 'Comprobando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </>)}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        empresaNombre={empresa?.nombre || ''}
        isAdmin={isAdmin}
        onNavigate={(section) => { setActiveSection(section); setSidebarOpen(false); }}
        activeSection={activeSection}
      />

      <NuevaCitaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => { setModalOpen(false); loadAllCitas(); }}
        profesionalId={profesional?.id || ''}
        empresaId={empresa?.id || ''}
        selectedDate={preselectedDate || selectedDate}
        preselectedTime={preselectedTime}
      />
    </div>
  );
}
