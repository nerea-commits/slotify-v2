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
import AusenciasSection from '@/components/AusenciasSection';
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
  const [miniCalOpen, setMiniCalOpen] = useState(false);
  const [permisos, setPermisos] = useState<Record<string, boolean>>({});
  const [anotaciones, setAnotaciones] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [anotacionModal, setAnotacionModal] = useState<{ open: boolean; date: Date | null }>({ open: false, date: null });
  const [anotacionTexto, setAnotacionTexto] = useState('');
  const [anotacionLoading, setAnotacionLoading] = useState(false);

  // ── CAMBIO 4: state para el aviso de ausencia al crear cita ──
  const [absenceWarning, setAbsenceWarning] = useState<{
    open: boolean;
    date: Date | null;
    time: string;
    absInfo: { icon: string; label: string; range: string } | null;
  } | null>(null);

  // Edit form state
  const [editServicio, setEditServicio] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editHoraInicio, setEditHoraInicio] = useState('');
  const [editHoraFin, setEditHoraFin] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // RISK INDICATOR CACHE
  const [clientRiskCache, setClientRiskCache] = useState<Record<string, { show: boolean; color: string; icon: string | null }>>({});

  // ── RESPONSIVE: detección de móvil ──
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth < 768); }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const empresaIdRef = useRef<string | null>(null);
  const profesionalIdRef = useRef<string | null>(null);
  const isAdminRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userErr || !user) {
        window.location.href = '/login';
        return;
      }

      const { data: emp } = await supabase
        .from('empresas')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (emp) {
        setEmpresa(emp);
        empresaIdRef.current = emp.id;
        setIsAdmin(true);
        isAdminRef.current = true;

        supabase.from('estados_cita').select('*').eq('empresa_id', emp.id).eq('activo', true).order('orden')
          .then(({ data }) => { if (data) setEstadosCita(data); });

        const pidLS = localStorage.getItem('slotify_profesional_id');
        if (pidLS) {
          const { data: prof } = await supabase
            .from('profesionales')
            .select('*')
            .eq('id', pidLS)
            .eq('empresa_id', emp.id)
            .maybeSingle();
          if (prof) {
            setProfesional(prof);
            profesionalIdRef.current = prof.id;
          }
        }
        return;
      }

      const { data: prof } = await supabase
        .from('profesionales')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (prof) {
        setProfesional(prof);
        profesionalIdRef.current = prof.id;
        empresaIdRef.current = prof.empresa_id;

        const r = (prof.rol || '').toLowerCase();
        const isAdm = r === 'admin' || r === 'owner';
        setIsAdmin(isAdm);
        isAdminRef.current = isAdm;

        if (!isAdm) {
          const permsRaw = prof.permisos || {};
          setPermisos(typeof permsRaw === 'object' ? permsRaw : {});
        }

        supabase.from('empresas').select('*').eq('id', prof.empresa_id).single()
          .then(({ data }) => { if (data) setEmpresa(data); });
        supabase.from('estados_cita').select('*').eq('empresa_id', prof.empresa_id).eq('activo', true).order('orden')
          .then(({ data }) => { if (data) setEstadosCita(data); });
        return;
      }

      window.location.href = '/login';
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
    const eid = empresaIdRef.current;
    if (!eid) return;
    const admin = isAdminRef.current;
    const pid = profesionalIdRef.current;
    const ref = new Date(selectedDate);
    const from = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const to = new Date(ref.getFullYear(), ref.getMonth() + 2, 0);
    let q = supabase.from('citas')
      .select('*, clientes(nombre, telefono), servicios(nombre), profesionales(nombre, color)')
      .eq('empresa_id', eid)
      .gte('hora_inicio', `${toDS(from)}T00:00:00`)
      .lte('hora_inicio', `${toDS(to)}T23:59:59`);
    if (!admin && pid) q = q.eq('profesional_id', pid);
    const { data, error } = await q.order('hora_inicio');
    if (error) console.error('loadAllCitas error:', error);
    const citas = data || [];
    setAllCitas(citas);
    loadClientRisks(citas);

    let aq = supabase.from('anotaciones')
      .select('*')
      .eq('empresa_id', eid)
      .gte('fecha', toDS(from))
      .lte('fecha', toDS(to));
    if (!admin && pid) aq = aq.eq('profesional_id', pid);
    const { data: aData } = await aq;
    setAnotaciones(aData || []);

    let absQ = supabase.from('absences')
      .select('*, profesionales(nombre)')
      .eq('empresa_id', eid)
      .neq('status', 'rejected')
      .lt('start_dt', `${toDS(to)}T23:59:59`)
      .gt('end_dt', `${toDS(from)}T00:00:00`);
    if (!admin && pid) {
      absQ = absQ.or(`scope.eq.company,employee_id.eq.${pid}`);
    }
    const { data: absData } = await absQ;
    setAbsences(absData || []);
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

  // ── Slots de 1h para vista día móvil ──
  const mobileHourSlots = visibleSlots.filter(s => s.endsWith(':00'));

  function parseDiasLaborables(raw: any): number[] {
    const fallback = [1, 2, 3, 4, 5];
    const nombreToNum: Record<string, number> = {
      'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
      'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 7
    };
    if (!raw) return fallback;
    if (Array.isArray(raw)) {
      if (raw.length === 0) return fallback;
      const nums = raw.map((x: any) => {
        const val = typeof x === 'string' ? x.trim().toLowerCase() : String(x);
        if (nombreToNum[val] !== undefined) return nombreToNum[val];
        const n = Number(val);
        return (!isNaN(n) && n >= 1 && n <= 7) ? n : NaN;
      }).filter((n: number) => !isNaN(n));
      return nums.length > 0 ? nums : fallback;
    }
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[{}\[\]\s"]/g, '');
      if (!cleaned) return fallback;
      const nums = cleaned.split(',').map(x => {
        const v = x.trim().toLowerCase();
        if (nombreToNum[v] !== undefined) return nombreToNum[v];
        const n = Number(v);
        return (!isNaN(n) && n >= 1 && n <= 7) ? n : NaN;
      }).filter(n => !isNaN(n));
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

  function anotacionesForDate(d: Date): any[] {
    return anotaciones.filter(a => a.fecha === toDS(d));
  }

  function absencesForDate(d: Date): any[] {
    const dayStart = `${toDS(d)}T00:00:00`;
    const dayEnd = `${toDS(d)}T23:59:59`;
    return absences.filter(abs =>
      abs.start_dt < dayEnd && abs.end_dt > dayStart
    );
  }

  function isSlotInAbsence(slot: string, d: Date): any | null {
    const slotMin = timeToMinutes(slot);
    const slotEnd = slotMin + 30;
    const ds = toDS(d);
    for (const abs of absences) {
      if (abs.status === 'rejected') continue;
      const absStartDate = rawDate(abs.start_dt);
      const absEndDate = rawDate(abs.end_dt);
      if (ds < absStartDate || ds > absEndDate) {
        if (abs.start_dt > `${ds}T23:59:59` || abs.end_dt < `${ds}T00:00:00`) continue;
      }
      if (abs.all_day) return abs;
      const absStartMin = (ds === absStartDate) ? rawTimeMin(abs.start_dt) : 0;
      const absEndMin = (ds === rawDate(abs.end_dt)) ? rawTimeMin(abs.end_dt) : 24 * 60;
      if (slotMin < absEndMin && slotEnd > absStartMin) return abs;
    }
    return null;
  }

  function absenceBannersForDate(d: Date): { icon: string; text: string; variant: 'warning' | 'danger' }[] {
    return absencesForDate(d)
      .filter(abs => abs.scope === 'company')
      .map((abs: any) => {
        const startStr = new Date(abs.start_dt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        const endStr = new Date(abs.end_dt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        return {
          icon: '⛔',
          text: `CIERRE EMPRESA (${startStr} → ${endStr})${abs.note ? ` · ${abs.note}` : ''}`,
          variant: 'danger' as const,
        };
      });
  }

  function absenceBlocksForDate(d: Date): { icon: string; label: string; name: string; scope: string; status: string }[] {
    return absencesForDate(d)
      .filter(abs => abs.scope === 'employee')
      .map((abs: any) => {
        const typeLabels: Record<string, string> = { vacation: 'Vacaciones', sick: 'Baja médica', personal: 'Personal', other: 'Ausencia' };
        const typeIcons: Record<string, string> = { vacation: '🌴', sick: '🏥', personal: '👤', other: '📌' };
        return {
          icon: typeIcons[abs.type] || '📌',
          label: typeLabels[abs.type] || abs.type,
          name: abs.profesionales?.nombre?.split(' ')[0] || 'Empleado',
          scope: abs.scope,
          status: abs.status,
        };
      });
  }

  // ── CAMBIO 1: activeAbsenceStatus sin cambios, se usa diferente en el render ──
  function activeAbsenceStatus(): { icon: string; label: string; range: string } | null {
    const today = new Date();
    const todayStr = today.toISOString();
    const visibleDateStr = toDS(selectedDate);
    for (const abs of absences) {
      if (abs.scope !== 'employee') continue;
      if (abs.status === 'rejected') continue;
      const absStart = new Date(abs.start_dt);
      const absEnd = new Date(abs.end_dt);
      const coversSelected = abs.start_dt <= `${visibleDateStr}T23:59:59` && abs.end_dt >= `${visibleDateStr}T00:00:00`;
      const coversToday = abs.start_dt <= todayStr && abs.end_dt >= todayStr;
      if (coversSelected || coversToday) {
        const typeLabels: Record<string, string> = { vacation: 'De vacaciones', sick: 'De baja médica', personal: 'Ausencia personal', other: 'Ausente' };
        const typeIcons: Record<string, string> = { vacation: '🌴', sick: '🏥', personal: '👤', other: '📌' };
        const startStr = absStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
        const endStr = absEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
        return {
          icon: typeIcons[abs.type] || '📌',
          label: typeLabels[abs.type] || 'Ausente',
          range: `${startStr} – ${endStr}`,
        };
      }
    }
    return null;
  }

  async function guardarAnotacion() {
    if (!anotacionTexto.trim() || !anotacionModal.date) return;
    setAnotacionLoading(true);
    const eid = empresaIdRef.current;
    const pid = profesionalIdRef.current;
    await supabase.from('anotaciones').insert({
      empresa_id: eid,
      profesional_id: pid,
      fecha: toDS(anotacionModal.date),
      texto: anotacionTexto.trim(),
    });
    setAnotacionTexto('');
    setAnotacionModal({ open: false, date: null });
    setAnotacionLoading(false);
    loadAllCitas();
  }

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

  // ── 3 días para vista semana móvil: centrado en selectedDate ──
  function getMobile3Days(): Date[] {
    const d = new Date(selectedDate);
    const prev = new Date(d); prev.setDate(d.getDate() - 1);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    return [prev, d, next];
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
    setEditFecha(rawDate(cita.hora_inicio));
    setEditHoraInicio(cita.hora_inicio?.substring(11, 16) || '');
    setEditHoraFin(cita.hora_fin?.substring(11, 16) || '');
    setEditEstado(cita.estado || '');
  }

  async function guardarEdicion() {
    if (!editingCita) return;
    setEditLoading(true);
    try {
      const dateStr = editFecha || rawDate(editingCita.hora_inicio);
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

  // ── CAMBIO 4: openModal intercepta ausencias de empleado ──
  function openModal(date?: Date, time?: string) {
    const targetDate = date ? new Date(date) : selectedDate;
    const targetTime = time || '';

    const dateStr = toDS(targetDate);
    const empAbsence = !isAdmin ? absences.find(abs =>
      abs.scope === 'employee' &&
      abs.status !== 'rejected' &&
      abs.start_dt <= `${dateStr}T23:59:59` &&
      abs.end_dt >= `${dateStr}T00:00:00`
    ) : null;

    if (empAbsence) {
      const typeLabels: Record<string, string> = { vacation: 'De vacaciones', sick: 'De baja médica', personal: 'Ausencia personal', other: 'Ausente' };
      const typeIcons: Record<string, string> = { vacation: '🌴', sick: '🏥', personal: '👤', other: '📌' };
      const startStr = new Date(empAbsence.start_dt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
      const endStr = new Date(empAbsence.end_dt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
      const empName = empAbsence.profesionales?.nombre?.split(' ')[0] || 'El empleado';
      setAbsenceWarning({
        open: true,
        date: targetDate,
        time: targetTime,
        absInfo: {
          icon: typeIcons[empAbsence.type] || '📌',
          label: `${empName} está ${(typeLabels[empAbsence.type] || 'ausente').toLowerCase()}`,
          range: `${startStr} – ${endStr}`,
        },
      });
      return;
    }

    setPreselectedDate(targetDate);
    setPreselectedTime(targetTime);
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
        style={{ ...style, background: `${color}33`, borderLeft: `3px solid ${color}`, cursor: 'pointer', overflow: 'hidden', zIndex: 10, pointerEvents: 'auto', boxShadow: `0 1px 4px ${color}33`, boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: fs, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35, wordBreak: 'break-word' as const, flex: 1, minWidth: 0 }}>{name}</span>
          {risk?.show && <span style={{ fontSize: Math.max(fs - 2, 8), lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{risk.icon}</span>}
        </div>
        {linea2 && <div style={{ fontSize: fs - 1, fontWeight: 400, color: '#FFFFFF', opacity: 0.85, lineHeight: 1.35, wordBreak: 'break-word' as const, marginTop: 2, minWidth: 0, overflow: 'hidden' }}>{linea2}</div>}
      </div>
    );
  }

  const sidebarW = sidebarCollapsed ? 56 : 220;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex' }}>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        empresaNombre={empresa?.nombre || 'Mi negocio'}
        profesionalNombre={profesional?.nombre || ''}
        empresaLogo={empresa?.logo_url || ''}
        colorPrimario={empresa?.color_primario || '#22C55E'}
        isAdmin={isAdmin}
        permisos={permisos}
        onNavigate={setActiveSection}
        activeSection={activeSection}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} className="main-content-desktop">
        {/* ── HEADER ── */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.surfaceAlt}`, flexShrink: 0 }}>
          {/* Fila 1: Logo + Toggle vista + Usuario */}
          <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
            <div className="show-mobile-flex" style={{ alignItems: 'center', gap: 6, marginRight: 4, flexShrink: 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {empresa?.nombre?.[0]?.toUpperCase() || '?'}
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{empresa?.nombre || 'Mi negocio'}</p>
            </div>

            {activeSection === 'agenda' && (
              <div style={{ display: 'flex', gap: 2, background: C.surfaceAlt, borderRadius: 8, padding: 2, flexShrink: 0 }}>
                {(['day', 'week', 'month'] as ViewMode[]).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: view === v ? 600 : 400, background: view === v ? C.green : 'transparent', color: view === v ? '#fff' : C.textSec, transition: 'all 0.12s' }}>
                    {v === 'day' ? 'Día' : v === 'week' ? 'Sem' : 'Mes'}
                  </button>
                ))}
              </div>
            )}

            {/* Desktop: navegación fecha en la misma fila */}
            {activeSection === 'agenda' && (
              <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <button onClick={() => view === 'day' ? changeDay(-1) : view === 'week' ? changeWeek(-1) : changeMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, borderRadius: 6, display: 'flex' }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div style={{ textAlign: 'center', minWidth: 130 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
                    {view === 'day' ? formatDate(selectedDate) : view === 'week' ? (() => { const wd = getWeekDays(); return `${wd[0].getDate()} – ${wd[6].getDate()} ${wd[6].toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`; })() : formatMonth(selectedDate)}
                  </p>
                  {view === 'day' && isToday(selectedDate) && <p style={{ fontSize: 10, fontWeight: 700, color: C.green, lineHeight: 1 }}>HOY</p>}
                </div>
                <button onClick={() => view === 'day' ? changeDay(1) : view === 'week' ? changeWeek(1) : changeMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, borderRadius: 6, display: 'flex' }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* Badge ausencia + usuario (solo desktop) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'right' }} className="hidden-mobile">
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{profesional?.nombre || ''}</p>
                {activeSection === 'agenda' && (() => {
                  const absStatus = activeAbsenceStatus();
                  if (!absStatus) return <p style={{ fontSize: 10, color: C.textSec, lineHeight: 1.2 }}>{isAdmin ? 'Admin' : 'Empleado'}</p>;
                  return (
                    <p style={{ fontSize: 10, color: '#F59E0B', lineHeight: 1.2, fontWeight: 600 }}>
                      {absStatus.icon} {absStatus.label} · {absStatus.range}
                    </p>
                  );
                })()}
                {activeSection !== 'agenda' && (
                  <p style={{ fontSize: 10, color: C.textSec, lineHeight: 1.2 }}>{isAdmin ? 'Admin' : 'Empleado'}</p>
                )}
              </div>
              <div className="hidden-mobile" style={{ width: 30, height: 30, borderRadius: 8, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                {profesional?.nombre?.[0]?.toUpperCase() || '?'}
              </div>
            </div>
          </div>

          {/* Fila 2 (móvil): navegación de fecha compacta */}
          {activeSection === 'agenda' && (
            <div className="show-mobile-only" style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, borderTop: `1px solid ${C.surfaceAlt}`, padding: '0 8px' }}>
              <button onClick={() => view === 'day' ? changeDay(-1) : view === 'week' ? changeWeek(-1) : changeMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 6, borderRadius: 6, display: 'flex' }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {view === 'day'
                    ? (() => {
                        const t = isToday(selectedDate);
                        const short = selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                        return t ? `Hoy · ${short}` : short;
                      })()
                    : view === 'week'
                    ? (() => { const wd = getWeekDays(); return `${wd[0].getDate()} – ${wd[6].getDate()} ${wd[6].toLocaleDateString('es-ES', { month: 'short' })}`; })()
                    : selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                  }
                </p>
              </div>
              <button onClick={() => view === 'day' ? changeDay(1) : view === 'week' ? changeWeek(1) : changeMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 6, borderRadius: 6, display: 'flex' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {activeSection !== 'agenda' && (
          <div className="flex-1 overflow-y-auto" style={{ background: C.bg, paddingBottom: 80, maxHeight: 'calc(100vh - 64px)' }}>
            {activeSection === 'clientes' && <ClientesSection empresaId={empresa?.id || ''} />}
            {activeSection === 'servicios' && <ServiciosSection empresaId={empresa?.id || ''} {...({canEdit: isAdmin || !!permisos.editar_servicios} as any)} />}
            {activeSection === 'estadisticas' && <EstadisticasSection empresaId={empresa?.id || ''} />}
            {activeSection === 'ausencias' && <AusenciasSection empresaId={empresa?.id || ''} isAdmin={isAdmin} />}
            {activeSection === 'notificaciones' && <NotificacionesSection empresaId={empresa?.id || ''} />}
            {activeSection === 'configuracion' && empresa && <ConfiguracionSection empresa={empresa} profesional={profesional} onEmpresaUpdated={(data: any) => setEmpresa((prev: any) => ({ ...prev, ...data }))} />}
          </div>
        )}

        {activeSection === 'agenda' && (<>

          {/* ── VISTA DÍA ── */}
          {view === 'day' && (<>
            {/* ── Tira de días (solo móvil) ── */}
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'stretch', background: C.surface, borderBottom: `1px solid ${C.surfaceAlt}`, padding: '6px 8px', gap: 4, flexShrink: 0 }}>
                {getWeekDays().map((day, i) => {
                  const sel = day.toDateString() === selectedDate.toDateString();
                  const today = isToday(day);
                  const working = isWorkingDay(day);
                  const hasCitas = allCitas.some(c => rawDate(c.hora_inicio) === toDS(day) && (c.estado || '').toLowerCase() !== 'cancelada');
                  return (
                    <div key={i} onClick={() => setSelectedDate(new Date(day))}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '6px 0 4px', borderRadius: 10, cursor: 'pointer',
                        background: sel ? C.green : 'transparent',
                        opacity: working ? 1 : 0.4,
                        transition: 'background 0.15s',
                      }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sel ? '#fff' : C.textSec, letterSpacing: 0.5 }}>
                        {weekDayNames[i].charAt(0)}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: sel ? '#fff' : today ? C.green : C.text, lineHeight: 1 }}>
                        {day.getDate()}
                      </span>
                      {hasCitas && !sel && <div style={{ width: 4, height: 4, borderRadius: '50%', background: today ? C.green : C.textSec, marginTop: 1 }} />}
                      {!hasCitas && <div style={{ width: 4, height: 4, marginTop: 1 }} />}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto" style={{ paddingTop: 8, paddingBottom: 80 }}>
              <div style={{ paddingLeft: isMobile ? 8 : 16, paddingRight: isMobile ? 8 : 16 }}>
                {/* Banners cierre empresa */}
                {absenceBannersForDate(selectedDate).map((b, i) => (
                  <div key={`abs-banner-${i}`} style={{
                    padding: '8px 12px', borderRadius: 8, marginBottom: 6, fontSize: 12, fontWeight: 600,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#EF4444',
                  }}>
                    {b.icon} {b.text}
                  </div>
                ))}
                {/* Bloques elegantes de ausencia de empleado en vista día */}
                {absenceBlocksForDate(selectedDate).map((block, i) => (
                  <div key={`abs-block-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: isMobile ? '8px 10px' : '10px 14px', borderRadius: 10, marginBottom: 6,
                    background: 'rgba(245,158,11,0.08)',
                    borderLeft: '3px solid rgba(245,158,11,0.5)',
                  }}>
                    <span style={{ fontSize: isMobile ? 15 : 18 }}>{block.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#F59E0B', lineHeight: 1.3 }}>{block.label}</p>
                      <p style={{ fontSize: isMobile ? 10 : 11, color: C.textSec, lineHeight: 1.3 }}>{block.name}</p>
                    </div>
                    {block.status === 'pending' && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', flexShrink: 0 }}>Pendiente</span>
                    )}
                  </div>
                ))}
                {(() => {
                  const dayCitas = citasForDate(selectedDate);
                  const slotsToRender = isMobile ? mobileHourSlots : visibleSlots;
                  const SLOT_DUR = isMobile ? 60 : 30;

                  const citaAtSlot: Record<number, any> = {};
                  const citaSpans: Record<number, number> = {};
                  const coveredSlots = new Set<number>();
                  dayCitas.forEach(cita => {
                    const citaStart = rawTimeMin(cita.hora_inicio);
                    const citaEnd = cita.hora_fin ? rawTimeMin(cita.hora_fin) : citaStart + 30;
                    const dur = Math.max(citaEnd - citaStart, 30);
                    const slotIdx = slotsToRender.findIndex(s => timeToMinutes(s) === (isMobile ? Math.floor(citaStart / 60) * 60 : citaStart));
                    if (slotIdx === -1) return;
                    // En móvil, múltiples citas pueden caer en el mismo slot de 1h
                    if (!citaAtSlot[slotIdx]) {
                      citaAtSlot[slotIdx] = cita;
                      const spanSlots = isMobile ? 1 : Math.ceil(dur / 30);
                      citaSpans[slotIdx] = spanSlots;
                      for (let i = slotIdx; i < slotIdx + spanSlots; i++) coveredSlots.add(i);
                    }
                  });

                  // Para móvil: agrupar citas por slot horario
                  const citasPerHourSlot: Record<number, any[]> = {};
                  if (isMobile) {
                    dayCitas.forEach(cita => {
                      const citaStart = rawTimeMin(cita.hora_inicio);
                      const hourSlotIdx = slotsToRender.findIndex(s => timeToMinutes(s) === Math.floor(citaStart / 60) * 60);
                      if (hourSlotIdx === -1) return;
                      if (!citasPerHourSlot[hourSlotIdx]) citasPerHourSlot[hourSlotIdx] = [];
                      citasPerHourSlot[hourSlotIdx].push(cita);
                    });
                  }

                  const nowSlotIdx = isToday(selectedDate) ? slotsToRender.findIndex(s => { const m = timeToMinutes(s); return currentMinutes >= m && currentMinutes < m + SLOT_DUR; }) : -1;

                  return slotsToRender.map((slot, si) => {
                    if (!isMobile && coveredSlots.has(si) && !citaAtSlot[si]) return null;
                    const isHour = slot.endsWith(':00');
                    const MIN_H = isMobile ? 56 : 50;
                    const slotCitas = isMobile ? (citasPerHourSlot[si] || []) : (citaAtSlot[si] ? [citaAtSlot[si]] : []);

                    return (
                      <div key={slot} style={{ display: 'flex', minHeight: slotCitas.length > 0 ? Math.max(MIN_H, slotCitas.length * 52) : MIN_H }}>
                        <div style={{ width: isMobile ? 44 : 64, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: isMobile ? 8 : 12, paddingTop: 4 }}>
                          <span style={{ fontSize: isMobile ? 12 : 11, color: C.textSec, fontWeight: 600 }}>{slot}</span>
                        </div>
                        {(() => {
                          const slotAbsence = isSlotInAbsence(slot, selectedDate);
                          const absOverlay = (slotAbsence && slotAbsence.scope === 'company') ? {
                            background: 'rgba(239,68,68,0.05)',
                            borderLeftColor: 'rgba(239,68,68,0.3)',
                            borderLeftWidth: '2px',
                            borderLeftStyle: 'solid' as const,
                          } : null;
                          return (
                            <div style={{ flex: 1, borderBottom: `1px solid ${isHour ? C.surfaceAlt : 'rgba(36,50,71,0.4)'}`, minHeight: MIN_H, position: 'relative', display: 'flex', flexDirection: 'column', gap: 3, padding: slotCitas.length > 0 ? '2px 0' : 0, ...(absOverlay ? { background: absOverlay.background, borderLeft: `${absOverlay.borderLeftWidth} ${absOverlay.borderLeftStyle} ${absOverlay.borderLeftColor}` } : {}) }}>
                              {slotCitas.length > 0 ? (
                                slotCitas.map(cita => (
                                  <div key={cita.id} onClick={() => setSelectedCita(cita)} style={{
                                    background: `${citaColor(cita.estado)}22`,
                                    borderLeft: `3px solid ${citaColor(cita.estado)}`,
                                    borderRadius: isMobile ? 8 : 10,
                                    padding: isMobile ? '8px 10px' : '10px 14px',
                                    margin: isMobile ? '1px 4px' : '3px 8px',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box' as const,
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <p style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, letterSpacing: 0.2, textTransform: 'uppercase' as const, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                        {cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente'}
                                        {cita.cliente_id && clientRiskCache[cita.cliente_id]?.show && <span style={{ marginLeft: 4, fontSize: 11 }}>{clientRiskCache[cita.cliente_id].icon}</span>}
                                      </p>
                                      {isMobile && (
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                                          {cita.hora_inicio?.substring(11, 16)}
                                        </span>
                                      )}
                                    </div>
                                    {(() => { const svc = cita.servicios?.nombre || cita.servicio_nombre_libre || ''; const notas = cita.notas || ''; const linea2 = svc && notas ? `${svc} — ${notas}` : svc || notas; return linea2 ? <p style={{ fontSize: isMobile ? 11 : 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{linea2}</p> : null; })()}
                                    {isAdmin && cita.profesionales?.nombre && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: isMobile ? 3 : 6 }}>
                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: cita.profesionales?.color || C.green, flexShrink: 0 }} />
                                        <span style={{ fontSize: isMobile ? 11 : 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{cita.profesionales.nombre}</span>
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div onClick={() => openModal(selectedDate, slot)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} onMouseEnter={e => { if (!isMobile) (e.currentTarget as HTMLElement).style.background = C.greenBg; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }} />
                              )}
                              {nowSlotIdx === si && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, boxShadow: '0 0 6px rgba(239,68,68,0.8)', flexShrink: 0 }} />
                                  <div style={{ flex: 1, height: 2, background: C.red, opacity: 0.85 }} />
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <button onClick={() => openModal(selectedDate, '')} style={{ position: 'fixed', bottom: isMobile ? 72 : 32, right: isMobile ? 16 : 32, width: isMobile ? 50 : 56, height: isMobile ? 50 : 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(34,197,94,0.45)', zIndex: 50, background: C.green, border: 'none', cursor: 'pointer' }}>
              <Plus className="w-6 h-6 text-white" />
            </button>
          </>)}

          {/* ── VISTA SEMANA ── */}
          {view === 'week' && (
            <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
              {/* ── Sidebar mini calendario (solo desktop) ── */}
              {!isMobile && (
                <div style={{ width: 196, flexShrink: 0, borderRight: `1px solid ${C.surfaceAlt}`, background: C.surface, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <button onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x; })} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}><ChevronLeft className="w-3 h-3" /></button>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: 'capitalize', letterSpacing: 0.3 }}>{miniCalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; })} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}><ChevronRight className="w-3 h-3" /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 9, color: C.textSec, fontWeight: 700, padding: '1px 0' }}>{d}</div>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                    {getMonthDays(miniCalMonth).map((day, i) => {
                      if (!day) return <div key={`e${i}`} style={{ height: 22 }} />;
                      const today = isToday(day);
                      const inWeek = isInCurrentWeek(day);
                      const hasCitas = allCitas.some(c => rawDate(c.hora_inicio) === toDS(day) && (c.estado || '').toLowerCase() !== 'cancelada');
                      return (
                        <div key={i} onClick={() => setSelectedDate(new Date(day))}
                          style={{ textAlign: 'center', fontSize: 10, lineHeight: '22px', height: 22, borderRadius: 4, cursor: 'pointer', background: today ? C.green : inWeek ? `${C.green}25` : 'transparent', color: today ? '#fff' : inWeek ? C.green : C.text, fontWeight: inWeek || today ? 700 : 400, position: 'relative' }}
                          onMouseEnter={e => { if (!today && !inWeek) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
                          onMouseLeave={e => { if (!today && !inWeek) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                          {day.getDate()}
                          {hasCitas && <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: today ? 'rgba(255,255,255,0.7)' : inWeek ? C.green : C.textSec }} />}
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => { const t = new Date(); setSelectedDate(t); setMiniCalMonth(t); }} style={{ marginTop: 14, padding: '6px 0', borderRadius: 8, border: `1px solid ${C.surfaceAlt}`, background: 'transparent', color: C.textSec, fontSize: 11, cursor: 'pointer', fontWeight: 600, letterSpacing: 0.2 }}>Hoy</button>
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: isMobile ? '0' : '10px 12px 0' }}>

                {/* ── Móvil: mini calendario colapsable + navegación ── */}
                {isMobile && (
                  <div style={{ flexShrink: 0, background: C.surface, borderBottom: `1px solid ${C.surfaceAlt}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                      <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 3); setSelectedDate(d); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, display: 'flex' }}>
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button onClick={() => setMiniCalOpen(o => !o)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                          {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <ChevronRight className="w-3 h-3" style={{ color: C.textSec, transform: miniCalOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                      </button>
                      <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 3); setSelectedDate(d); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, display: 'flex' }}>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    {/* Mini calendario expandible */}
                    {miniCalOpen && (
                      <div style={{ padding: '0 12px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <button onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x; })} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 4 }}><ChevronLeft className="w-3 h-3" /></button>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'capitalize' }}>{miniCalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                          <button onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; })} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: 4 }}><ChevronRight className="w-3 h-3" /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, color: C.textSec, fontWeight: 700, padding: '2px 0' }}>{d}</div>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                          {getMonthDays(miniCalMonth).map((day, i) => {
                            if (!day) return <div key={`e${i}`} style={{ height: 32 }} />;
                            const today = isToday(day);
                            const isSel = day.toDateString() === selectedDate.toDateString();
                            const hasCitas = allCitas.some(c => rawDate(c.hora_inicio) === toDS(day) && (c.estado || '').toLowerCase() !== 'cancelada');
                            return (
                              <div key={i} onClick={() => { setSelectedDate(new Date(day)); setMiniCalOpen(false); }}
                                style={{ textAlign: 'center', fontSize: 12, lineHeight: '32px', height: 32, borderRadius: 8, cursor: 'pointer', background: isSel ? C.green : today ? `${C.green}25` : 'transparent', color: isSel ? '#fff' : today ? C.green : C.text, fontWeight: isSel || today ? 700 : 400, position: 'relative' }}>
                                {day.getDate()}
                                {hasCitas && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.7)' : C.green }} />}
                              </div>
                            );
                          })}
                        </div>
                        <button onClick={() => { const t = new Date(); setSelectedDate(t); setMiniCalMonth(t); setMiniCalOpen(false); }}
                          style={{ marginTop: 8, width: '100%', padding: '6px 0', borderRadius: 8, border: `1px solid ${C.surfaceAlt}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          Hoy
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Desktop: navegación semana ── */}
                {!isMobile && (
                  <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 8 }}>
                    <button onClick={() => changeWeek(-1)} className="p-2" style={{ color: C.textSec }}><ChevronLeft className="w-5 h-5" /></button>
                    <span className="text-sm font-semibold">{(() => { const d = getWeekDays(); return `${d[0].getDate()} – ${d[6].getDate()} ${d[6].toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`; })()}</span>
                    <button onClick={() => changeWeek(1)} className="p-2" style={{ color: C.textSec }}><ChevronRight className="w-5 h-5" /></button>
                  </div>
                )}

                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 80 }}>
                  {(() => {
                    const displayDays = isMobile ? getMobile3Days() : getWeekDays();
                    const numDays = displayDays.length;
                    const dayCitaMaps = displayDays.map(day => {
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
                    cells.push(<div key="th-time" style={{ gridColumn: 1, gridRow: 1, minHeight: 44 }} />);

                    displayDays.forEach((day, di) => {
                      const today = isToday(day);
                      const working = isWorkingDay(day);
                      const dayAnotaciones = anotacionesForDate(day);
                      const dayCompanyClosures = absencesForDate(day).filter(a => a.scope === 'company');
                      const isSel = isMobile && day.toDateString() === selectedDate.toDateString();
                      cells.push(
                        <div key={`th-${di}`} onClick={() => {
                            const hasEmpAbsence = !isAdmin && absenceBlocksForDate(day).length > 0;
                            if (hasEmpAbsence) { openModal(day); }
                            else if (working) { goToDay(day); }
                            else { setAnotacionModal({ open: true, date: day }); }
                          }}
                          style={{ gridColumn: di + 2, gridRow: 1, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isSel ? 'rgba(34,197,94,0.25)' : today ? 'rgba(34,197,94,0.2)' : dayCompanyClosures.length > 0 ? 'rgba(239,68,68,0.1)' : working ? C.surfaceAlt : 'rgba(15,23,42,0.4)', borderRadius: '10px 10px 0 0', borderTop: isSel || today ? `1px solid ${C.green}55` : dayCompanyClosures.length > 0 ? '1px solid rgba(239,68,68,0.25)' : `1px solid rgba(148,163,184,0.12)`, borderLeft: isSel || today ? `1px solid ${C.green}55` : `1px solid rgba(148,163,184,0.12)`, borderRight: isSel || today ? `1px solid ${C.green}55` : `1px solid rgba(148,163,184,0.12)`, borderBottom: `1px solid rgba(148,163,184,0.08)`, cursor: 'pointer', padding: '4px 2px' }}>
                          <div style={{ fontSize: isMobile ? 10 : 9, fontWeight: 700, color: working ? C.textSec : 'rgba(148,163,184,0.5)', letterSpacing: 0.8 }}>
                            {isMobile
                              ? day.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().substring(0, 3)
                              : weekDayNames[day.getDay() === 0 ? 6 : day.getDay() - 1]
                            }
                          </div>
                          <div style={{ fontSize: isMobile ? 18 : 15, fontWeight: 700, color: today ? C.green : dayCompanyClosures.length > 0 ? '#EF4444' : working ? C.text : 'rgba(241,245,249,0.3)' }}>{day.getDate()}</div>
                          {today && <div style={{ fontSize: 7, color: C.green, fontWeight: 700 }}>HOY</div>}
                          {!isMobile && !working && dayAnotaciones.length > 0 && <div style={{ fontSize: 7, color: C.yellow, fontWeight: 700 }}>● {dayAnotaciones.length}</div>}
                          {dayCompanyClosures.length > 0 && <div style={{ fontSize: 7, fontWeight: 700, color: '#EF4444' }}>⛔ CIERRE</div>}
                          {/* Bloque ausencia en header */}
                          {(() => {
                            const empAbs = absenceBlocksForDate(day);
                            if (!empAbs.length) return null;
                            return (
                              <div style={{
                                marginTop: 3,
                                padding: '2px 5px',
                                borderRadius: 5,
                                background: 'rgba(245,158,11,0.15)',
                                borderLeft: '2px solid rgba(245,158,11,0.6)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                maxWidth: '92%',
                              }}>
                                <span style={{ fontSize: 9, flexShrink: 0 }}>{empAbs[0].icon}</span>
                                <span style={{ fontSize: isMobile ? 9 : 8, fontWeight: 700, color: '#F59E0B', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{empAbs[0].label}{!isMobile ? ` · ${empAbs[0].name}` : ''}</span>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    });

                    visibleSlots.forEach((slot, si) => {
                      const rowIdx = si + 2;
                      const isHour = slot.endsWith(':00');
                      cells.push(
                        <div key={`time-${si}`} style={{ gridColumn: 1, gridRow: rowIdx, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: isMobile ? 4 : 6, paddingTop: 6, borderBottom: `1px solid ${isHour ? C.surfaceAlt : 'rgba(36,50,71,0.25)'}`, background: C.bg }}>
                          <span style={{ fontSize: isHour ? 10 : 9, color: C.textSec, fontWeight: isHour ? 600 : 400, opacity: isHour ? 1 : 0.5, lineHeight: 1, whiteSpace: 'nowrap' }}>{slot}</span>
                        </div>
                      );
                      displayDays.forEach((day, di) => {
                        const today = isToday(day);
                        const working = isWorkingDay(day);
                        const { citaAtSlot, citaSpans, coveredSlots } = dayCitaMaps[di];
                        const cita = citaAtSlot[si];
                        if (coveredSlots.has(si) && !cita) return;
                        const spanSlots = cita ? (citaSpans[si] || 1) : 1;
                        const alturaBloque = spanSlots * WEEK_SLOT_H;
                        const isNowSlot = today && (() => { const m = timeToMinutes(slot); return currentMinutes >= m && currentMinutes < m + 30; })();
                        const weekSlotAbsence = isSlotInAbsence(slot, day);
                        const isCompanyClosure = weekSlotAbsence && weekSlotAbsence.scope === 'company';

                        const weekCellBg = isCompanyClosure
                          ? 'rgba(239,68,68,0.05)'
                          : (working ? C.surface : 'rgba(15,23,42,0.35)');

                        cells.push(
                          <div key={`cell-${si}-${di}`} style={{ gridColumn: di + 2, gridRow: spanSlots > 1 ? `${rowIdx} / span ${spanSlots}` : `${rowIdx}`, background: weekCellBg, borderBottom: `1px solid ${isHour ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.06)'}`, borderLeft: `1px solid ${today ? C.green + '55' : isCompanyClosure ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.12)'}`, borderRight: `1px solid ${today ? C.green + '55' : 'rgba(148,163,184,0.12)'}`, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: cita ? 'center' : 'flex-start', boxSizing: 'border-box' as const, overflow: 'visible' }}>
                            {cita && (
                              <div onClick={() => setSelectedCita(cita)} style={{ position: 'absolute', inset: 0, background: `${citaColor(cita.estado)}22`, borderLeft: `3px solid ${citaColor(cita.estado)}`, borderRadius: 4, padding: isMobile ? '4px 6px' : '6px 8px', cursor: 'pointer', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflow: 'hidden' }}>
                                <p style={{ fontSize: isMobile ? 12 : 11, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, textTransform: 'uppercase' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                  {cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente'}
                                  {cita.cliente_id && clientRiskCache[cita.cliente_id]?.show && <span style={{ marginLeft: 3, fontSize: 9 }}>{clientRiskCache[cita.cliente_id].icon}</span>}
                                </p>
                                {(() => {
                                  const svc = cita.servicios?.nombre || cita.servicio_nombre_libre || '';
                                  const notas = cita.notas || '';
                                  const linea2 = svc && notas ? `${svc} — ${notas}` : svc || notas;
                                  const empNombre = cita.profesionales?.nombre?.split(' ')[0] || '';
                                  const expandido = alturaBloque >= 80;
                                  if (expandido) {
                                    return (
                                      <>
                                        {linea2 && <p style={{ fontSize: isMobile ? 11 : 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{linea2}</p>}
                                        {isAdmin && empNombre && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cita.profesionales?.color || C.green, flexShrink: 0 }} />
                                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' as const }}>{empNombre}</span>
                                          </div>
                                        )}
                                      </>
                                    );
                                  } else {
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, overflow: 'hidden' }}>
                                        {linea2 && <span style={{ fontSize: isMobile ? 10 : 10, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>{linea2}</span>}
                                        {isAdmin && empNombre && (
                                          <>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cita.profesionales?.color || C.green, flexShrink: 0 }} />
                                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>{empNombre}</span>
                                          </>
                                        )}
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                            {!cita && <div onClick={() => working ? openModal(day, slot) : setAnotacionModal({ open: true, date: day })} style={{ position: 'absolute', inset: 0, cursor: working ? 'pointer' : 'default' }} onMouseEnter={e => { if (working && !isMobile) (e.currentTarget as HTMLElement).style.background = C.greenBg; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }} />}
                            {isNowSlot && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, boxShadow: '0 0 5px rgba(239,68,68,0.8)', flexShrink: 0 }} /><div style={{ flex: 1, height: 2, background: C.red, opacity: 0.8 }} /></div>}
                          </div>
                        );
                      });
                    });

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: `${isMobile ? '36px' : '42px'} repeat(${numDays}, 1fr)`, gridTemplateRows: `auto repeat(${visibleSlots.length}, ${WEEK_SLOT_H}px)`, columnGap: isMobile ? '2px' : '4px', rowGap: 0 }}>
                        {cells}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <button onClick={() => openModal()} style={{ position: 'fixed', bottom: isMobile ? 72 : 32, right: isMobile ? 16 : 32, width: isMobile ? 50 : 56, height: isMobile ? 50 : 56, borderRadius: '50%', background: C.green, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px rgba(34,197,94,0.45)`, zIndex: 35 }}>
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>
          )}

          {/* ── VISTA MES ── */}
          {view === 'month' && (
            <div className="flex-1 overflow-y-auto" style={{ padding: isMobile ? '10px 8px 80px' : '20px 16px 80px' }}>
              <div style={{ background: C.surface, borderRadius: isMobile ? 12 : 16, padding: isMobile ? 12 : 20, maxWidth: 1100, margin: '0 auto' }}>
                {!isMobile && (
                  <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                    <button onClick={() => changeMonth(-1)} className="p-2" style={{ color: C.textSec }}><ChevronLeft className="w-5 h-5" /></button>
                    <h2 className="font-semibold capitalize" style={{ fontSize: 18 }}>{formatMonth(selectedDate)}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2" style={{ color: C.textSec }}><ChevronRight className="w-5 h-5" /></button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 0 : 6, marginBottom: isMobile ? 2 : 6 }}>
                  {(isMobile ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : weekDayNames).map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: isMobile ? 11 : 12, color: C.textSec, fontWeight: 600, padding: isMobile ? '6px 0' : '4px 0' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 6 }}>
                  {getMonthDays().map((day, i) => {
                    if (!day) return <div key={`e${i}`} />;
                    const today = isToday(day);
                    const working = isWorkingDay(day);
                    const free = working ? freeSlotCount(day) : -1;
                    const av = working ? getAvailability(free) : null;
                    const citasCount = activeCitasForDate(day).length;
                    const dayAnotaciones = anotacionesForDate(day);

                    if (isMobile) {
                      return (
                        <div key={i} onClick={() => working ? goToDay(day) : setAnotacionModal({ open: true, date: day })}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '8px 2px', borderRadius: 8, cursor: 'pointer', minHeight: 48,
                            background: today ? `${C.green}20` : 'transparent',
                            border: today ? `1.5px solid ${C.green}` : '1.5px solid transparent',
                            opacity: working ? 1 : 0.35,
                          }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: today ? C.green : C.text, lineHeight: 1 }}>{day.getDate()}</span>
                          <div style={{ display: 'flex', gap: 3, marginTop: 5, minHeight: 6 }}>
                            {working && citasCount > 0 && (
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: av?.color || C.green }} />
                            )}
                            {working && citasCount > 2 && (
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: av?.color || C.green, opacity: 0.5 }} />
                            )}
                            {!working && dayAnotaciones.length > 0 && (
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.yellow }} />
                            )}
                          </div>
                          {working && citasCount > 0 && (
                            <span style={{ fontSize: 8, color: C.textSec, marginTop: 2 }}>{citasCount}</span>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={i} onClick={() => working ? goToDay(day) : setAnotacionModal({ open: true, date: day })} className="cursor-pointer"
                        style={{ background: working ? C.surfaceAlt : 'rgba(15,23,42,0.5)', borderRadius: 10, padding: '8px', minHeight: 72, border: today ? `2px solid ${C.green}` : '2px solid transparent', opacity: working ? 1 : 0.5, display: 'flex', flexDirection: 'column' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = working ? '#2d3d54' : 'rgba(15,23,42,0.7)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = working ? C.surfaceAlt : 'rgba(15,23,42,0.5)'; }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: today ? C.green : working ? C.text : 'rgba(241,245,249,0.4)' }}>{day.getDate()}</span>
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
                        {!working && dayAnotaciones.length > 0 && (
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.yellow, display: 'inline-block' }} />
                            <span style={{ fontSize: 9, color: C.yellow }}>{dayAnotaciones.length} nota{dayAnotaciones.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {!working && dayAnotaciones.length === 0 && <span style={{ fontSize: 9, color: C.textSec, marginTop: 'auto' }}>—</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button onClick={() => openModal()} style={{ position: 'fixed', bottom: isMobile ? 72 : 32, right: isMobile ? 16 : 32, width: isMobile ? 50 : 56, height: isMobile ? 50 : 56, borderRadius: '50%', background: C.green, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px rgba(34,197,94,0.45)`, zIndex: 35 }}>
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>
          )}

          {/* ── MODAL DETALLE CITA ── */}
          {selectedCita && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedCita(null)}>
              <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 className="text-lg font-bold">Detalle de cita</h3>
                  <button onClick={() => setSelectedCita(null)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-2 text-sm mb-6">
                  <p><span style={{ color: C.textSec }}>Cliente: </span>{selectedCita.clientes?.nombre || selectedCita.cliente_nombre_libre || '—'}</p>
                  <p><span style={{ color: C.textSec }}>Teléfono: </span>{selectedCita.clientes?.telefono || '—'}</p>
                  <p><span style={{ color: C.textSec }}>Servicio: </span>{selectedCita.servicios?.nombre || selectedCita.servicio_nombre_libre || '—'}</p>
                  <p><span style={{ color: C.textSec }}>Fecha: </span>{rawDate(selectedCita.hora_inicio) || '—'}</p>
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
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10, color: clientRiskCache[selectedCita.cliente_id].color, background: clientRiskCache[selectedCita.cliente_id].color + '18' }}>
                        {clientRiskCache[selectedCita.cliente_id].icon} Cliente con riesgo
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openEdit(selectedCita)} className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2" style={{ background: C.surfaceAlt, color: C.text }}>
                    <Edit2 className="w-4 h-4" /> Editar
                  </button>
                  {(selectedCita.estado || '').toLowerCase() !== 'cancelada' && (
                    <button onClick={() => cancelarCita(selectedCita.id)} className="flex-1 py-2 rounded-xl text-sm text-white" style={{ background: C.red }}>Cancelar cita</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MODAL EDITAR CITA ── */}
          {editingCita && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setEditingCita(null)}>
              <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 className="text-lg font-bold">Editar cita</h3>
                    <p style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                      {editingCita.clientes?.nombre || editingCita.cliente_nombre_libre || 'Cliente'}
                    </p>
                  </div>
                  <button onClick={() => setEditingCita(null)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}><X className="w-5 h-5" /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Servicio</label>
                    <input value={editServicio} onChange={e => setEditServicio(e.target.value)}
                      style={{ width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      placeholder="Nombre del servicio" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Fecha</label>
                    <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)}
                      style={{ width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
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
                              style={{ background: selected ? estado.color + '33' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${selected ? estado.color : 'rgba(255,255,255,0.1)'}`, color: selected ? estado.color : C.textSec, borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: selected ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
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

          {/* ── MODAL ANOTACIÓN ── */}
          {anotacionModal.open && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => { setAnotacionModal({ open: false, date: null }); setAnotacionTexto(''); }}>
              <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Notas internas</h3>
                    <p style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                      {anotacionModal.date?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <button onClick={() => { setAnotacionModal({ open: false, date: null }); setAnotacionTexto(''); }} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {anotacionModal.date && anotacionesForDate(anotacionModal.date).length > 0 && (
                  <div style={{ overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, maxHeight: 240 }}>
                    {anotacionesForDate(anotacionModal.date).map((a: any) => (
                      <div key={a.id} style={{ background: C.surfaceAlt, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <p style={{ fontSize: 13, color: C.text, flex: 1, lineHeight: 1.5, margin: 0 }}>{a.texto}</p>
                        <button
                          onClick={async () => {
                            await supabase.from('anotaciones').delete().eq('id', a.id);
                            loadAllCitas();
                          }}
                          style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', flexShrink: 0, padding: 2, lineHeight: 1 }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {anotacionModal.date && anotacionesForDate(anotacionModal.date).length > 0 && (
                  <div style={{ height: 1, background: C.surfaceAlt, marginBottom: 16, flexShrink: 0 }} />
                )}
                <textarea
                  value={anotacionTexto}
                  onChange={e => setAnotacionTexto(e.target.value)}
                  rows={3}
                  autoFocus
                  style={{ width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' as const, flexShrink: 0 }}
                  placeholder="Escribe una nueva nota..."
                />
                <button
                  onClick={async () => {
                    if (!anotacionTexto.trim() || !anotacionModal.date) return;
                    setAnotacionLoading(true);
                    await supabase.from('anotaciones').insert({
                      empresa_id: empresaIdRef.current,
                      profesional_id: profesionalIdRef.current,
                      fecha: toDS(anotacionModal.date),
                      texto: anotacionTexto.trim(),
                    });
                    setAnotacionTexto('');
                    setAnotacionLoading(false);
                    loadAllCitas();
                  }}
                  disabled={anotacionLoading || !anotacionTexto.trim()}
                  style={{ marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 12, background: C.green, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: anotacionLoading || !anotacionTexto.trim() ? 0.5 : 1, flexShrink: 0 }}
                >
                  {anotacionLoading ? 'Guardando...' : 'Añadir nota'}
                </button>
              </div>
            </div>
          )}

          {/* ── CAMBIO 4: MODAL AVISO AUSENCIA ── */}
          {absenceWarning?.open && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
              style={{ background: 'rgba(0,0,0,0.7)' }}
              onClick={() => setAbsenceWarning(null)}>
              <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}
                onClick={e => e.stopPropagation()}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{absenceWarning.absInfo?.icon}</div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>
                    {absenceWarning.absInfo?.label}
                  </p>
                  <p style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>
                    {absenceWarning.absInfo?.range}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => {
                      setAbsenceWarning(null);
                      setActiveSection('configuracion');
                    }}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: C.surfaceAlt, border: 'none', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cambiar empleado
                  </button>
                  <button
                    onClick={() => {
                      if (absenceWarning.date) {
                        let nextDay = new Date(absenceWarning.date);
                        for (let i = 0; i < 30; i++) {
                          nextDay.setDate(nextDay.getDate() + 1);
                          const ds = toDS(nextDay);
                          const stillAbsent = absences.some(abs =>
                            abs.scope === 'employee' &&
                            abs.status !== 'rejected' &&
                            abs.start_dt <= `${ds}T23:59:59` &&
                            abs.end_dt >= `${ds}T00:00:00`
                          );
                          if (!stillAbsent && isWorkingDay(nextDay)) {
                            setAbsenceWarning(null);
                            setSelectedDate(nextDay);
                            setView('day');
                            return;
                          }
                        }
                      }
                      setAbsenceWarning(null);
                    }}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: C.surfaceAlt, border: 'none', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Buscar siguiente hueco
                  </button>
                  <button
                    onClick={() => {
                      setAbsenceWarning(null);
                      setPreselectedDate(absenceWarning.date);
                      setPreselectedTime(absenceWarning.time);
                      setModalOpen(true);
                    }}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Crear igualmente
                  </button>
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

      <BottomNav
        activeSection={activeSection}
        onNavigate={setActiveSection}
        isAdmin={isAdmin}
        permisos={permisos}
      />

      <style>{`
        @media (min-width: 768px) {
          .main-content-desktop {
            margin-left: ${sidebarCollapsed ? 56 : 240}px;
            transition: margin-left 0.2s cubic-bezier(0.4,0,0.2,1);
          }
          .show-mobile-flex { display: none !important; }
          .show-mobile-only { display: none !important; }
        }
        @media (max-width: 767px) {
          .main-content-desktop { margin-left: 0 !important; }
          .hidden-mobile { display: none !important; }
          .show-mobile-flex { display: flex !important; }
          .show-mobile-only { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
