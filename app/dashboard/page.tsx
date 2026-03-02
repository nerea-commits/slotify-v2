'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Plus, X, Edit2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import NuevaCitaModal from '@/components/NuevaCitaModal';
import ClientesSection from '@/components/ClientesSection';
import ServiciosSection from '@/components/ServiciosSection';
import ConfiguracionSection from '@/components/ConfiguracionSection';
import NotificacionesSection from '@/components/NotificacionesSection';
import EstadisticasSection from '@/components/EstadisticasSection';
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
  const hhmm = s.length >= 16 ? s.substring(11, 16) : s.length >= 5 ? s.substring(0, 5) : '';
  return timeToMinutes(hhmm);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // ═══ RISK INDICATOR CACHE ═══
  const [clientRiskCache, setClientRiskCache] = useState<Record<string, { show: boolean; color: string; icon: string | null }>>({});

  const empresaIdRef = useRef<string | null>(null);
  const profesionalIdRef = useRef<string | null>(null);
  const isAdminRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '/login'; return; }

  // 1) Usuario autenticado (fuente de verdad)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userErr || !user) {
    // Si por lo que sea no podemos obtener user, salimos (más seguro)
    window.location.href = '/login';
    return;
  }

  // 2) Buscar el profesional vinculado a este usuario
  const { data: prof, error: profErr } = await supabase
    .from('profesionales')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profErr || !prof) {
    // Fallback temporal: si aún no está vinculado, intentamos lo que había antes
    const eidLS = localStorage.getItem('slotify_empresa_id');
    const pidLS = localStorage.getItem('slotify_profesional_id');

    empresaIdRef.current = eidLS;
    profesionalIdRef.current = pidLS;

    if (eidLS) {
      supabase.from('empresas').select('*').eq('id', eidLS).single()
        .then(({ data }) => { if (data) setEmpresa(data); });
      supabase.from('estados_cita').select('*').eq('empresa_id', eidLS).eq('activo', true).order('orden')
        .then(({ data }) => { if (data) setEstadosCita(data); });
    }

    if (pidLS) {
      supabase.from('profesionales').select('*').eq('id', pidLS).single()
        .then(({ data }) => { if (data) setProfesional(data); });
    }

    console.warn('⚠️ No se encontró profesional por user_id. Usando fallback localStorage temporal.');
    return;
  }

  // 3) Ya tenemos el profesional real (sin localStorage)
  setProfesional(prof);
  profesionalIdRef.current = prof.id;

  const eid = prof.empresa_id as string | null;
  empresaIdRef.current = eid;

  // Admin desde rol del profesional
  const r = (prof.rol || '').toLowerCase();
  const isAdm = r === 'admin' || r === 'administración' || r === 'administracion' || r === 'owner';
  setIsAdmin(isAdm);
  isAdminRef.current = isAdm;

  // 4) Cargar empresa y estados_cita igual que antes
  if (eid) {
    supabase.from('empresas').select('*').eq('id', eid).single()
      .then(({ data }) => { if (data) setEmpresa(data); });
    supabase.from('estados_cita').select('*').eq('empresa_id', eid).eq('activo', true).order('orden')
      .then(({ data }) => { if (data) setEstadosCita(data); });
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

  // ═══ LOAD CLIENT RISKS ═══
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
    const rolLS = localStorage.getItem('slotify_rol') || ''; const admin = isAdminRef.current || rolLS === 'admin' || rolLS === 'administración' || rolLS === 'administracion' || rolLS === 'owner';
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

  // Canceladas NO aparecen en las vistas operativas
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
  }

  async function guardarEdicion() {
    if (!editingCita) return;
    setEditLoading(true);
    try {
      const dateStr = rawDate(editingCita.hora_inicio);
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
  const WEEK_SLOT_H = 44;

  function renderCitaBlock(cita: any, style: React.CSSProperties) {
    const name = cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente';
    const svc = cita.servicios?.nombre || cita.servicio_nombre_libre || '';
    const notas = cita.notas || '';
    const linea2 = svc && notas ? `${svc} — ${notas}` : svc || notas;
    const color = citaColor(cita.estado);
    const fs = (style.fontSize as number) || 11;
    const risk = cita.cliente_id ? clientRiskCache[cita.cliente_id] : null;
    return (
      <div key={cita.id} onClick={() => setSelectedCita(cita)}
        style={{
          ...style,
          background: `${color}33`,
          borderLeft: `3px solid ${color}`,
          cursor: 'pointer',
          overflow: 'hidden',
          zIndex: 10,
          pointerEvents: 'auto',
          boxShadow: `0 1px 4px ${color}33`,
          boxSizing: 'border-box' as const,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: fs, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35, wordBreak: 'break-word' as const, flex: 1, minWidth: 0 }}>{name}</span>
          {risk?.show && (
            <span style={{ fontSize: Math.max(fs - 2, 8), lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
              {risk.icon}
            </span>
          )}
        </div>
        {linea2 && (
          <div style={{ fontSize: fs - 1, fontWeight: 400, color: '#FFFFFF', opacity: 0.85, lineHeight: 1.35, wordBreak: 'break-word' as const, marginTop: 2, minWidth: 0, overflow: 'hidden' }}>
            {linea2}
          </div>
        )}
      </div>
    );
  }

  const sidebarW = sidebarCollapsed ? 56 : 220;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex' }}>

      {/* SIDEBAR — desktop only */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        empresaNombre={empresa?.nombre || 'Mi negocio'}
        profesionalNombre={profesional?.nombre || ''}
        empresaLogo={empresa?.logo_url || ''}
        colorPrimario={empresa?.color_primario || '#22C55E'}
        isAdmin={isAdmin}
        onNavigate={setActiveSection}
        activeSection={activeSection}
      />

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
        className="main-content-desktop">

      {/* HEADER — 64px, todo en una línea */}
      <div style={{
        height: 56,
        background: C.surface,
        borderBottom: `1px solid ${C.surfaceAlt}`,
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 8, flexShrink: 0,
      }}>
        {/* Mobile: logo empresa */}
        <div className="show-mobile-flex" style={{ alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {empresa?.nombre?.[0]?.toUpperCase() || '?'}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{empresa?.nombre || 'Mi negocio'}</p>
        </div>

        {/* View selector — solo en agenda */}
        {activeSection === 'agenda' && (
          <div style={{ display: 'flex', gap: 4, background: C.surfaceAlt, borderRadius: 8, padding: 3 }}>
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: view === v ? 600 : 400,
                  background: view === v ? C.green : 'transparent',
                  color: view === v ? '#fff' : C.textSec,
                  transition: 'all 0.12s',
                }}>
                {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        )}

        {/* Day nav — solo en agenda */}
        {activeSection === 'agenda' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
            <button onClick={() => view === 'day' ? changeDay(-1) : view === 'week' ? changeWeek(-1) : changeMonth(-1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, borderRadius: 6, display: 'flex' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div style={{ textAlign: 'center', minWidth: 130 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
                {view === 'day' ? formatDate(selectedDate) : view === 'week' ? (() => { const wd = getWeekDays(); return `${wd[0].getDate()} – ${wd[6].getDate()} ${wd[6].toLocaleDateString('es-ES',{month:'short',year:'numeric'})}`; })() : formatMonth(selectedDate)}
              </p>
              {view === 'day' && isToday(selectedDate) && <p style={{ fontSize: 10, fontWeight: 700, color: C.green, lineHeight: 1 }}>HOY</p>}
            </div>
            <button onClick={() => view === 'day' ? changeDay(1) : view === 'week' ? changeWeek(1) : changeMonth(1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, borderRadius: 6, display: 'flex' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Perfil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'right' }} className="hidden-mobile">
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{profesional?.nombre || ''}</p>
            <p style={{ fontSize: 10, color: C.textSec, lineHeight: 1.2 }}>{isAdmin ? 'Admin' : 'Empleado'}</p>
          </div>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
            {profesional?.nombre?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      </div>

      {/* SECCIONES */}
      {activeSection !== 'agenda' && (
        <div className="flex-1 overflow-y-auto" style={{ background: C.bg }}>
          {activeSection === 'clientes' && <ClientesSection empresaId={empresa?.id || ''} />}
          {activeSection === 'servicios' && <ServiciosSection empresaId={empresa?.id || ''} />}
          {activeSection === 'estadisticas' && <EstadisticasSection empresaId={empresa?.id || ''} />}
          {activeSection === 'notificaciones' && <NotificacionesSection empresaId={empresa?.id || ''} />}
          {activeSection === 'configuracion' && empresa && <ConfiguracionSection empresa={empresa} profesional={profesional} onEmpresaUpdated={(data: any) => setEmpresa((prev: any) => ({ ...prev, ...data }))}/>}
        </div>
      )}

      {/* AGENDA */}
      {activeSection === 'agenda' && (<>

        {/* ── VISTA DÍA ── */}
        {view === 'day' && (<>

          <div className="flex-1 overflow-y-auto" style={{ paddingTop: 8, paddingBottom: 80 }}>
            <div style={{ paddingLeft: 16, paddingRight: 16 }}>
              {(() => {
                const dayCitas = citasForDate(selectedDate);
                // Build a map: slotIndex -> cita (first slot of the cita)
                const citaAtSlot: Record<number, any> = {};
                const citaSpans: Record<number, number> = {};
                const coveredSlots = new Set<number>();
                dayCitas.forEach(cita => {
                  const citaStart = rawTimeMin(cita.hora_inicio);
                  const citaEnd = cita.hora_fin ? rawTimeMin(cita.hora_fin) : citaStart + 30;
                  const dur = Math.max(citaEnd - citaStart, 30);
                  const slotIdx = visibleSlots.findIndex(s => timeToMinutes(s) === citaStart);
                  if (slotIdx === -1) return;
                  const spanSlots = Math.ceil(dur / 30);
                  citaAtSlot[slotIdx] = cita;
                  citaSpans[slotIdx] = spanSlots;
                  for (let i = slotIdx; i < slotIdx + spanSlots; i++) coveredSlots.add(i);
                });
                // Current time slot index
                const nowSlotIdx = isToday(selectedDate)
                  ? visibleSlots.findIndex(s => {
                      const m = timeToMinutes(s);
                      return currentMinutes >= m && currentMinutes < m + 30;
                    })
                  : -1;
                return visibleSlots.map((slot, si) => {
                  // Skip slots covered by a multi-slot cita (not the first slot)
                  if (coveredSlots.has(si) && !citaAtSlot[si]) return null;
                  const cita = citaAtSlot[si];
                  const isHour = slot.endsWith(':00');
                  const MIN_H = 50;
                  return (
                    <div key={slot} style={{ display: 'flex', minHeight: MIN_H }}>
                      {/* Time label */}
                      <div style={{ width: 64, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 12, paddingTop: 4 }}>
                        <span style={{ fontSize: 11, color: C.textSec, fontWeight: isHour ? 600 : 400, opacity: isHour ? 1 : 0.4 }}>
                          {slot}
                        </span>
                      </div>
                      {/* Slot content */}
                      <div style={{ flex: 1, borderBottom: `1px solid ${isHour ? C.surfaceAlt : 'rgba(36,50,71,0.4)'}`, minHeight: MIN_H, position: 'relative' }}>
                        {cita ? (
                          <div
                            onClick={() => setSelectedCita(cita)}
                            style={{
                              background: `${citaColor(cita.estado)}33`,
                              borderLeft: `3px solid ${citaColor(cita.estado)}`,
                              borderRadius: 10,
                              padding: '10px 14px',
                              margin: '3px 8px',
                              cursor: 'pointer',
                              boxShadow: `0 1px 4px ${citaColor(cita.estado)}33`,
                              boxSizing: 'border-box' as const,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.4, wordBreak: 'break-word' as const, flex: 1 }}>
                                {cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente'}
                                {cita.cliente_id && clientRiskCache[cita.cliente_id]?.show && (
                                  <span style={{ marginLeft: 4, fontSize: 11 }}>{clientRiskCache[cita.cliente_id].icon}</span>
                                )}
                              </span>
                            </div>
                            {(() => {
                              const svc = cita.servicios?.nombre || cita.servicio_nombre_libre || '';
                              const notas = cita.notas || '';
                              const linea2 = svc && notas ? `${svc} — ${notas}` : svc || notas;
                              return linea2 ? (
                                <div style={{ fontSize: 13, fontWeight: 400, color: '#FFFFFF', opacity: 0.85, lineHeight: 1.4, wordBreak: 'break-word' as const, marginTop: 3 }}>
                                  {linea2}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <div
                            onClick={() => openModal(selectedDate, slot)}
                            style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.greenBg; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          />
                        )}
                        {/* Current time indicator */}
                        {nowSlotIdx === si && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, boxShadow: '0 0 6px rgba(239,68,68,0.8)', flexShrink: 0 }} />
                            <div style={{ flex: 1, height: 2, background: C.red, opacity: 0.85 }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          <button onClick={() => openModal(selectedDate, '')}
            style={{ position:'fixed', bottom:80, right:20, width:56, height:56, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(0,0,0,0.4)', zIndex:50, background: C.green, border:'none', cursor:'pointer' }}>
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
                {(() => {
                  const weekDays = getWeekDays();
                  const nCols = 8; // time col + 7 days
                  const nRows = 1 + visibleSlots.length; // header + slots

                  // Build cita maps per day
                  const dayCitaMaps = weekDays.map(day => {
                    const dayCitas = citasForDate(day);
                    const citaAtSlot: Record<number, any> = {};
                    const citaSpans: Record<number, number> = {};
                    const coveredSlots = new Set<number>();
                    dayCitas.forEach(cita => {
                      const citaStart = rawTimeMin(cita.hora_inicio);
                      const citaEnd = cita.hora_fin ? rawTimeMin(cita.hora_fin) : citaStart + 30;
                      const dur = Math.max(citaEnd - citaStart, 30);
                      const slotIdx = visibleSlots.findIndex(s => timeToMinutes(s) === citaStart);
                      if (slotIdx === -1) return;
                      const spanSlots = Math.max(1, Math.ceil(dur / 30));
                      citaAtSlot[slotIdx] = cita;
                      citaSpans[slotIdx] = spanSlots;
                      for (let i = slotIdx; i < slotIdx + spanSlots; i++) coveredSlots.add(i);
                    });
                    return { citaAtSlot, citaSpans, coveredSlots, dayCitas };
                  });

                  const cells: React.ReactNode[] = [];

                  // ── ROW 0: headers ──
                  // Time col header (empty)
                  cells.push(
                    <div key="th-time" style={{ gridColumn: 1, gridRow: 1, minHeight: 44 }} />
                  );
                  // Day headers
                  weekDays.forEach((day, di) => {
                    const today = isToday(day);
                    cells.push(
                      <div key={`th-${di}`}
                        onClick={() => goToDay(day)}
                        style={{
                          gridColumn: di + 2, gridRow: 1,
                          height: 44, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          background: today ? 'rgba(34,197,94,0.2)' : C.surfaceAlt,
                          borderRadius: '10px 10px 0 0',
                          borderTop: today ? `1px solid ${C.green}55` : `1px solid rgba(148,163,184,0.12)`,
                          borderLeft: today ? `1px solid ${C.green}55` : `1px solid rgba(148,163,184,0.12)`,
                          borderRight: today ? `1px solid ${C.green}55` : `1px solid rgba(148,163,184,0.12)`,
                          borderBottom: `1px solid rgba(148,163,184,0.08)`,
                          cursor: 'pointer',
                        }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: C.textSec, letterSpacing: 0.8 }}>{weekDayNames[di]}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: today ? C.green : C.text }}>{day.getDate()}</div>
                        {today && <div style={{ fontSize: 7, color: C.green, fontWeight: 700 }}>HOY</div>}
                      </div>
                    );
                  });

                  // ── ROWS 1..N: slots ──
                  visibleSlots.forEach((slot, si) => {
                    const rowIdx = si + 2; // 1-based, row 1 = header
                    const isHour = slot.endsWith(':00');

                    // Time label cell
                    cells.push(
                      <div key={`time-${si}`} style={{
                        gridColumn: 1, gridRow: rowIdx,
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                        paddingRight: 6, paddingTop: 6,
                        borderBottom: `1px solid ${isHour ? C.surfaceAlt : 'rgba(36,50,71,0.25)'}`,
                        background: C.bg,
                      }}>
                        <span style={{ fontSize: isHour ? 10 : 9, color: C.textSec, fontWeight: isHour ? 600 : 400, opacity: isHour ? 1 : 0.5, lineHeight: 1, whiteSpace: 'nowrap' }}>
                          {slot}
                        </span>
                      </div>
                    );

                    // Day cells
                    weekDays.forEach((day, di) => {
                      const today = isToday(day);
                      const working = isWorkingDay(day);
                      const { citaAtSlot, citaSpans, coveredSlots } = dayCitaMaps[di];

                      const cita = citaAtSlot[si];

                      // Skip cells covered by a multi-slot cita — the start cell uses gridRow span
                      if (coveredSlots.has(si) && !cita) return;

                      const spanSlots = cita ? (citaSpans[si] || 1) : 1;

                      const isNowSlot = today && (() => {
                        const m = timeToMinutes(slot);
                        return currentMinutes >= m && currentMinutes < m + 30;
                      })();

                      cells.push(
                            <div key={`cell-${si}-${di}`} style={{
                              gridColumn: di + 2,
                              gridRow: spanSlots > 1 ? `${rowIdx} / span ${spanSlots}` : `${rowIdx}`,
                              background: working ? C.surface : 'rgba(15,23,42,0.25)',
                              borderBottom: `1px solid ${isHour ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.06)'}`,
                              borderLeft: `1px solid ${today ? C.green + '55' : 'rgba(148,163,184,0.12)'}`,
                              borderRight: `1px solid ${today ? C.green + '55' : 'rgba(148,163,184,0.12)'}`,

                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: cita ? 'center' : 'flex-start',
                              boxSizing: 'border-box' as const,
                              overflow: 'hidden',
                            }}>
                              {cita && (
                                <div
                                  onClick={() => setSelectedCita(cita)}
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: `${citaColor(cita.estado)}33`,
                                    borderLeft: `3px solid ${citaColor(cita.estado)}`,
                                    borderRadius: 4,
                                    padding: '8px 10px',
                                    cursor: 'pointer',
                                    boxShadow: `0 1px 3px ${citaColor(cita.estado)}33`,
                                    boxSizing: 'border-box' as const,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35, wordBreak: 'break-word' as const, display: 'block' }}>
                                    {cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente'}
                                    {cita.cliente_id && clientRiskCache[cita.cliente_id]?.show && (
                                      <span style={{ marginLeft: 3, fontSize: 9 }}>{clientRiskCache[cita.cliente_id].icon}</span>
                                    )}
                                  </span>
                                  {(() => {
                                    const svc = cita.servicios?.nombre || cita.servicio_nombre_libre || '';
                                    const notas = cita.notas || '';
                                    const linea2 = svc && notas ? `${svc} — ${notas}` : svc || notas;
                                    return linea2 ? (
                                      <span style={{ fontSize: 11, fontWeight: 400, color: '#FFFFFF', opacity: 0.85, lineHeight: 1.35, wordBreak: 'break-word' as const, display: 'block', marginTop: 2 }}>
                                        {linea2}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              )}
                              {!cita && (
                                <div
                                  onClick={() => openModal(day, slot)}
                                  style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.greenBg; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                />
                              )}
                              {isNowSlot && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, boxShadow: '0 0 5px rgba(239,68,68,0.8)', flexShrink: 0 }} />
                                  <div style={{ flex: 1, height: 2, background: C.red, opacity: 0.8 }} />
                                </div>
                              )}
                            </div>
                          );
                    });
                  });

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `42px repeat(7, 1fr)`,
                      gridTemplateRows: `44px repeat(${visibleSlots.length}, ${WEEK_SLOT_H}px)`,
                      columnGap: '4px',
                      rowGap: 0,
                    }}>
                      {cells}
                    </div>
                  );
                })()}
              </div>
            </div>

            <button onClick={() => openModal()}
              style={{
                position: 'fixed',
                bottom: 'calc(80px + env(safe-area-inset-bottom))',
                right: 16,
                width: 56, height: 56,
                borderRadius: '50%',
                background: C.green,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 20px rgba(34,197,94,0.45)`,
                zIndex: 35,
              }}>
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
              style={{
                position: 'fixed',
                bottom: 'calc(80px + env(safe-area-inset-bottom))',
                right: 16,
                width: 56, height: 56,
                borderRadius: '50%',
                background: C.green,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 20px rgba(34,197,94,0.45)`,
                zIndex: 35,
              }}>
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

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => cancelarCita(editingCita.id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 12, background: `${C.red}22`, border: `1px solid ${C.red}55`, color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar cita
                  </button>
                  <button onClick={guardarEdicion} disabled={editLoading}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 12, background: C.green, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: editLoading ? 0.6 : 1 }}>
                    {editLoading ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </>)}

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

      {/* BOTTOM NAV — mobile only */}
      <BottomNav
        activeSection={activeSection}
        onNavigate={setActiveSection}
        isAdmin={isAdmin}
      />

      {/* Global layout CSS */}
      <style>{`
        @media (min-width: 768px) {
          .main-content-desktop {
            margin-left: ${sidebarCollapsed ? 56 : 240}px;
            transition: margin-left 0.2s cubic-bezier(0.4,0,0.2,1);
          }
          .show-mobile-flex { display: none !important; }
        }
        @media (max-width: 767px) {
          .main-content-desktop { margin-left: 0 !important; padding-bottom: 64px; }
          .hidden-mobile { display: none !important; }
          .show-mobile-only { display: none !important; }
          .show-mobile-only { display: none; }
          .show-mobile-flex { display: flex !important; }
          .show-mobile-only { display: flex !important; }
          .show-mobile-only { display: block; }
        }
      `}</style>
    </div>
  );
}
