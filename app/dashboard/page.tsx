'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
  greenDone: '#4ADE80',
  yellow: '#F59E0B', orange: '#FB923C', red: '#EF4444',
  text: '#F1F5F9', textSec: '#94A3B8',
};

type ViewMode = 'day' | 'team' | 'week' | 'month';

interface DragState {
  active: boolean;
  dayIndex: number;
  startSlotIdx: number;
  currentSlotIdx: number;
  date: Date;
  hasConflict: boolean;
}

interface MoveDragState {
  active: boolean;
  cita: any;
  originDate: string;
  originSlotIdx: number;
  offsetSlots: number;
  targetDayIdx: number;
  targetDate: Date;
  targetSlotIdx: number;
  hasConflict: boolean;
  durSlots: number;
}

export default function Dashboard() {
  const [view, setView] = useState<ViewMode>('day');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allCitas, setAllCitas] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any>(null);
  const [profesional, setProfesional] = useState<any>(null);
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPin] = useState<string | null>(null);

  const [hoveredColIdx, setHoveredColIdx] = useState<number | null>(null);

  // ── BADGES HEADER ──
  const [notifsNoLeidas, setNotifsNoLeidas] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifsHoy, setNotifsHoy] = useState<any[]>([]);
  const [notifsHoyLoading, setNotifsHoyLoading] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  // Calculados desde allCitas (citas de hoy, excluyendo canceladas y completadas)
  const citasHoy = allCitas.filter(c => {
    const ds = (c.hora_inicio || '').substring(0, 10);
    const hoy = toDS(new Date());
    const estado = (c.estado || '').toLowerCase();
    return ds === hoy && estado !== 'cancelada' && estado !== 'completada';
  });
  const badgeConfirmadas = citasHoy.filter(c => (c.confirmacion_estado || '').toLowerCase() === 'confirmada').length;
  const badgePendientes  = citasHoy.filter(c => (c.confirmacion_estado || '').toLowerCase() === 'pendiente' || !c.confirmacion_estado).length;
  const badgeRiesgo      = citasHoy.filter(c => (c.confirmacion_estado || '').toLowerCase() === 'no_confirmada').length;

  function handleCambiarPerfil() {
    localStorage.removeItem('slotify_profesional_id');
    localStorage.removeItem('slotify_rol');
    localStorage.setItem('slotify_select_profile', '1');
    window.location.href = '/login?select_profile=1';
  }
  const [selectedCita, setSelectedCita] = useState<any>(null);
  const [editingCita, setEditingCita] = useState<any>(null);
  const [preselectedTime, setPreselectedTime] = useState('');
  const [preselectedEndTime, setPreselectedEndTime] = useState('');
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

  const [absenceWarning, setAbsenceWarning] = useState<{
    open: boolean;
    date: Date | null;
    time: string;
    absInfo: { icon: string; label: string; range: string } | null;
  } | null>(null);

  const [editServicio, setEditServicio] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editHoraInicio, setEditHoraInicio] = useState('');
  const [editHoraFin, setEditHoraFin] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [clientRiskCache, setClientRiskCache] = useState<Record<string, { show: boolean; color: string; icon: string | null }>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [navDir, setNavDir] = useState<'left' | 'right' | null>(null);
  const [animKey, setAnimKey] = useState(0);

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [moveDrag, setMoveDrag] = useState<MoveDragState | null>(null);
  const moveDragRef = useRef<MoveDragState | null>(null);
  const [moveConflictMsg, setMoveConflictMsg] = useState<string | null>(null);

  const [selectedProfId, setSelectedProfId] = useState<string | null>(null);
  const [profesionales, setProfesionales] = useState<any[]>([]);

  const dayScrollRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolled = useRef(false);

  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth < 768); }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const empresaIdRef = useRef<string | null>(null);
  const profesionalIdRef = useRef<string | null>(null);
  const isAdminRef = useRef(false);
  const visibleSlotsRef = useRef<string[]>([]);
  const allCitasRef = useRef<any[]>([]);
  const absencesRef = useRef<any[]>([]);
  const diasLaborablesRef = useRef<number[]>([1,2,3,4,5]);

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

        const rolLS = (localStorage.getItem('slotify_rol') || '').toLowerCase();
        const pidCheck = localStorage.getItem('slotify_profesional_id');
        const isAdm = !pidCheck || rolLS === 'admin' || rolLS === 'owner';
        setIsAdmin(isAdm);
        isAdminRef.current = isAdm;

        supabase.from('estados_cita').select('*').eq('empresa_id', emp.id).eq('activo', true).order('orden')
          .then(({ data }) => { if (data) setEstadosCita(data); });

        supabase.from('profesionales').select('id, nombre, color').eq('empresa_id', emp.id).eq('activo', true).order('nombre')
          .then(({ data }) => { if (data) setProfesionales(data); });

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
        } else {
          const { data: adminProf } = await supabase
            .from('profesionales')
            .select('*')
            .eq('empresa_id', emp.id)
            .eq('rol', 'admin')
            .eq('activo', true)
            .limit(1)
            .maybeSingle();
          if (adminProf) {
            setProfesional(adminProf);
            profesionalIdRef.current = adminProf.id;
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
        supabase.from('profesionales').select('pin').eq('empresa_id', prof.empresa_id).eq('rol', 'admin').eq('activo', true).limit(1).single()
          .then(({ data }) => { if (data?.pin) setAdminPin(data.pin); });
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

  useEffect(() => {
    if (view !== 'day' || currentMinutes < 0) return;
    const today = new Date();
    if (selectedDate.toDateString() !== today.toDateString()) return;

    const timer = setTimeout(() => {
      const container = dayScrollRef.current;
      if (!container) return;
      const nowLine = container.querySelector('[data-now-line]') as HTMLElement;
      if (nowLine) {
        const containerRect = container.getBoundingClientRect();
        const lineRect = nowLine.getBoundingClientRect();
        const scrollTarget = container.scrollTop + (lineRect.top - containerRect.top) - containerRect.height * 0.3;
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: hasAutoScrolled.current ? 'smooth' : 'auto' });
        hasAutoScrolled.current = true;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [view, currentMinutes, selectedDate]);

  useEffect(() => {
    function handleGlobalMouseUp() {
      if (dragRef.current?.active) {
        setDrag(null);
        dragRef.current = null;
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

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

  async function loadNotifsHoy() {
    const eid = empresaIdRef.current;
    if (!eid) return;
    setNotifsHoyLoading(true);
    const hoy = toDS(new Date());
    const { data } = await supabase
      .from('notificaciones')
      .select('*, clientes(nombre)')
      .eq('empresa_id', eid)
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifsHoy(data || []);
    setNotifsHoyLoading(false);
  }

  async function marcarTodasLeidasHeader() {
    const eid = empresaIdRef.current;
    if (!eid) return;
    await supabase.from('notificaciones').update({ leida: true })
      .eq('empresa_id', eid).eq('leida', false);
    setNotifsNoLeidas(0);
    setNotifsHoy(prev => prev.map(n => ({ ...n, leida: true })));
  }

  useEffect(() => {
    if (!notifPanelOpen) return;
    loadNotifsHoy();
    function handleClickOutside(e: MouseEvent) {
      const btn = notifBtnRef.current;
      const panel = document.getElementById('notif-panel');
      if (btn && !btn.contains(e.target as Node) && panel && !panel.contains(e.target as Node)) {
        setNotifPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifPanelOpen]);

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

    await autoCompletarCitasPasadas(eid, admin ? null : pid);

    // Badge notificaciones no leídas
    supabase.from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', eid)
      .eq('leida', false)
      .then(({ count }) => setNotifsNoLeidas(count || 0));
  }

  async function autoCompletarCitasPasadas(eid: string, pid: string | null) {
    const ahora = new Date().toISOString();
    const estadosProtegidos = ['cancelada', 'no-show', 'no_show', 'completada', 'no presentacion'];

    let q = supabase.from('citas')
      .select('id, estado')
      .eq('empresa_id', eid)
      .lt('hora_fin', ahora);
    if (pid) q = q.eq('profesional_id', pid);
    const { data: pasadas } = await q;
    if (!pasadas || pasadas.length === 0) return;

    const aCompletar = pasadas.filter(c =>
      !estadosProtegidos.includes((c.estado || '').toLowerCase())
    );
    if (aCompletar.length === 0) return;

    const ids = aCompletar.map(c => c.id);
    await supabase.from('citas')
      .update({ estado: 'Completada', blocks_time: false })
      .in('id', ids);
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

  visibleSlotsRef.current = visibleSlots;
  allCitasRef.current = allCitas;
  absencesRef.current = absences;
  diasLaborablesRef.current = diasLaborables;

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
      (c.estado || '').toLowerCase() !== 'cancelada' &&
      (selectedProfId === null || c.profesional_id === selectedProfId)
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
    if (estadoNombre === 'completada') return C.greenDone;
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

  function isCompletada(estado: string): boolean {
    return (estado || '').toLowerCase() === 'completada';
  }

  function renderConfirmacionDot(cita: any, size: number = 7): React.ReactNode {
    const conf = (cita.confirmacion_estado || 'pendiente').toLowerCase();
    const estadoBase = (cita.estado || '').toLowerCase();
    if (['completada', 'cancelada', 'no-show', 'no_show'].includes(estadoBase)) return null;

    const config: Record<string, { color: string; title: string }> = {
      pendiente:      { color: '#F59E0B', title: 'Pendiente de confirmar' },
      confirmada:     { color: '#22C55E', title: 'Confirmada por el cliente' },
      no_confirmada:  { color: '#EF4444', title: 'No confirmada — riesgo de no-show' },
      cancelada:      { color: '#94A3B8', title: 'Cancelada por el cliente' },
    };
    const cfg = config[conf] || config['pendiente'];
    return (
      <div
        title={cfg.title}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
          boxShadow: conf === 'no_confirmada' ? `0 0 5px ${cfg.color}99` : 'none',
          animation: conf === 'pendiente' ? 'confirmPulse 2s ease-in-out infinite' : 'none',
        }}
      />
    );
  }

  function isToday(d: Date) { return d.toDateString() === new Date().toDateString(); }
  function formatDate(d: Date) { return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function formatMonth(d: Date) { return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); }
  function changeDay(n: number) {
    if (!isMobile) { setNavDir(n > 0 ? 'left' : 'right'); setAnimKey(k => k + 1); }
    const d = new Date(selectedDate); d.setDate(d.getDate() + n); setSelectedDate(d);
  }
  function changeWeek(n: number) {
    if (!isMobile) { setNavDir(n > 0 ? 'left' : 'right'); setAnimKey(k => k + 1); }
    const d = new Date(selectedDate); d.setDate(d.getDate() + n * 7); setSelectedDate(d);
  }
  function changeMonth(n: number) { const d = new Date(selectedDate); d.setMonth(d.getMonth() + n); setSelectedDate(d); }
  function goToDay(d: Date) {
    if (!isMobile) { setNavDir('left'); setAnimKey(k => k + 1); }
    setSelectedDate(new Date(d)); setView('day');
  }

  function getWeekDays(): Date[] {
    const d = new Date(selectedDate);
    const dow = d.getDay() || 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - dow + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(mon); x.setDate(mon.getDate() + i); return x;
    });
  }

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

  function moveDragHasConflict(targetDate: Date, targetSlotIdx: number, durSlots: number, citaId: string): boolean {
    const startM = timeToMinutes(visibleSlots[targetSlotIdx] || '00:00');
    const endM = startM + durSlots * 30;
    const dayCitas = citasForDate(targetDate).filter(c => c.id !== citaId);
    return dayCitas.some(c => {
      if ((c.estado || '').toLowerCase() === 'cancelada') return false;
      const cs = rawTimeMin(c.hora_inicio);
      const ce = c.hora_fin ? rawTimeMin(c.hora_fin) : cs + 30;
      return startM < ce && endM > cs;
    });
  }

  const agendaRef = useRef<HTMLDivElement | null>(null);

  function handleCitaMouseDown(e: React.MouseEvent, cita: any, slotIdx: number, dayIdx: number, date: Date) {
    if (isMobile) return;
    if (isCompletada(cita.estado)) return;
    e.preventDefault();
    e.stopPropagation();
    const citaStartM = rawTimeMin(cita.hora_inicio);
    const citaEndM = cita.hora_fin ? rawTimeMin(cita.hora_fin) : citaStartM + 30;
    const durSlots = Math.max(1, Math.ceil((citaEndM - citaStartM) / 30));
    const originSlotIdx = visibleSlots.findIndex(s => timeToMinutes(s) === citaStartM);
    const state: MoveDragState = {
      active: true,
      cita,
      originDate: toDS(date),
      originSlotIdx: originSlotIdx >= 0 ? originSlotIdx : slotIdx,
      offsetSlots: 0,
      targetDayIdx: dayIdx,
      targetDate: new Date(date),
      targetSlotIdx: originSlotIdx >= 0 ? originSlotIdx : slotIdx,
      hasConflict: false,
      durSlots,
    };
    moveDragRef.current = state;
    setMoveDrag({ ...state });
  }

  const handleMoveDragMouseMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const handleMoveDragMouseUpRef = useRef<(e: MouseEvent) => void>(() => {});

  useEffect(() => {
    handleMoveDragMouseMoveRef.current = (e: MouseEvent) => {
      if (!moveDragRef.current?.active) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const slotEl = (el as HTMLElement).closest('[data-slot-idx]') as HTMLElement | null;
      if (!slotEl) return;
      const slotIdx = parseInt(slotEl.dataset.slotIdx || '-1');
      const dayIdx = parseInt(slotEl.dataset.dayIdx || '0');
      const dateStr = slotEl.dataset.date || '';
      if (slotIdx < 0 || !dateStr) return;
      const slots = visibleSlotsRef.current;
      const md = moveDragRef.current;
      const targetSlotIdx = Math.max(0, Math.min(slotIdx, slots.length - md.durSlots));

      const startM = timeToMinutes(slots[targetSlotIdx] || '00:00');
      const endM = startM + md.durSlots * 30;
      const [y, mo, d] = dateStr.split('-').map(Number);
      const targetDate = new Date(y, mo - 1, d);
      const dayCitas = allCitasRef.current.filter(c =>
        c.hora_inicio && c.hora_inicio.substring(0, 10) === dateStr && c.id !== md.cita.id &&
        (c.estado || '').toLowerCase() !== 'cancelada'
      );
      const hasConflict = dayCitas.some(c => {
        const cs = rawTimeMin(c.hora_inicio);
        const ce = c.hora_fin ? rawTimeMin(c.hora_fin) : cs + 30;
        return startM < ce && endM > cs;
      });

      const updated: MoveDragState = { ...md, targetDayIdx: dayIdx, targetDate, targetSlotIdx, hasConflict };
      moveDragRef.current = updated;
      setMoveDrag({ ...updated });
    };

    handleMoveDragMouseUpRef.current = async (e: MouseEvent) => {
      if (!moveDragRef.current?.active) return;
      e.preventDefault();
      const md = moveDragRef.current;
      setMoveDrag(null);
      moveDragRef.current = null;

      if (md.hasConflict) {
        setMoveConflictMsg('No se puede mover: horario ocupado');
        setTimeout(() => setMoveConflictMsg(null), 2500);
        return;
      }

      const slots = visibleSlotsRef.current;
      const targetSlot = slots[md.targetSlotIdx];
      if (!targetSlot) return;

      const dow = md.targetDate.getDay();
      const isoDay = dow === 0 ? 7 : dow;
      if (!diasLaborablesRef.current.includes(isoDay)) return;

      const dateStr = toDS(md.targetDate);
      const startM = timeToMinutes(targetSlot);
      const endM = startM + md.durSlots * 30;
      const newStart = `${dateStr}T${targetSlot}:00`;
      const newEnd = `${dateStr}T${minutesToTime(endM)}:00`;

      if (newStart === md.cita.hora_inicio && newEnd === md.cita.hora_fin) return;

      await supabase.from('citas').update({
        hora_inicio: newStart,
        hora_fin: newEnd,
      }).eq('id', md.cita.id);
      loadAllCitas();
    };
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleMoveDragMouseMoveRef.current(e);
    const onUp = (e: MouseEvent) => handleMoveDragMouseUpRef.current(e);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const [hoveredCitaId, setHoveredCitaId] = useState<string | null>(null);


  async function marcarNoShow(id: string) {
    const estadoNoShow = estadosCita.find(e => {
      const n = (e.nombre_defecto || '').toLowerCase();
      return n === 'no-show' || n === 'no_show' || n.includes('no-show') || n.includes('no_show');
    });
    const estadoFinal = estadoNoShow
      ? (estadoNoShow.nombre_personalizado || estadoNoShow.nombre_defecto)
      : 'no-show';
    await supabase.from('citas').update({ estado: estadoFinal, blocks_time: false }).eq('id', id);
    loadAllCitas();
  }

  function abrirWhatsApp(telefono: string) {
    const digits = telefono.replace(/\D/g, '');
    const num = digits.startsWith('34') ? digits : `34${digits}`;
    window.open(`https://wa.me/${num}`, '_blank');
  }

  function handleCitaMouseEnter(citaId: string) {
    if (isMobile) return;
    setHoveredCitaId(citaId);
  }

  function renderQuickActions(cita: any): React.ReactNode {
    if (hoveredCitaId !== cita.id) return null;
    if (isCompletada(cita.estado)) return null;
    const tel = cita.clientes?.telefono || '';
    const yaCancelada = (cita.estado || '').toLowerCase() === 'cancelada';
    const yaNoShow = ['no-show', 'no_show'].includes((cita.estado || '').toLowerCase());
    const btnBase: React.CSSProperties = {
      width: 24, height: 24,
      borderRadius: 6,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      flexShrink: 0,
      transition: 'opacity 0.1s',
    };
    return (
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          display: 'flex',
          flexDirection: 'row',
          gap: 3,
          zIndex: 10,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          title="Editar"
          onClick={e => { e.stopPropagation(); openEdit(cita); }}
          style={{ ...btnBase, background: 'rgba(148,163,184,0.18)', color: '#F1F5F9' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.32)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.18)'; }}
        >✏️</button>
        {!yaCancelada && !yaNoShow && (
          <button
            title="No-show"
            onClick={e => { e.stopPropagation(); marcarNoShow(cita.id); }}
            style={{ ...btnBase, background: 'rgba(251,146,60,0.18)', color: '#FB923C' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,146,60,0.32)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,146,60,0.18)'; }}
          >👻</button>
        )}
        {!yaCancelada && (
          <button
            title="Cancelar"
            onClick={e => { e.stopPropagation(); cancelarCita(cita.id); }}
            style={{ ...btnBase, background: 'rgba(239,68,68,0.18)', color: '#EF4444' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.32)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)'; }}
          >✕</button>
        )}
        {tel && (
          <button
            title="WhatsApp"
            onClick={e => { e.stopPropagation(); abrirWhatsApp(tel); }}
            style={{ ...btnBase, background: 'rgba(37,211,102,0.18)', color: '#25D366' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.32)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.18)'; }}
          >💬</button>
        )}
      </div>
    );
  }

  function openModal(date?: Date, time?: string, endTime?: string) {
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
    setPreselectedEndTime(endTime || '');
    setModalOpen(true);
  }

  function isInCurrentWeek(d: Date): boolean {
    return getWeekDays().some(wd => wd.toDateString() === d.toDateString());
  }

  function dragHasConflict(date: Date, startSlotIdx: number, endSlotIdx: number): boolean {
    const minIdx = Math.min(startSlotIdx, endSlotIdx);
    const maxIdx = Math.max(startSlotIdx, endSlotIdx);
    const startTime = visibleSlots[minIdx];
    const endSlot = visibleSlots[maxIdx];
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endSlot) + 30;

    const dayCitas = citasForDate(date);
    return dayCitas.some(cita => {
      if ((cita.estado || '').toLowerCase() === 'cancelada') return false;
      const citaStart = rawTimeMin(cita.hora_inicio);
      const citaEnd = cita.hora_fin ? rawTimeMin(cita.hora_fin) : citaStart + 30;
      return startM < citaEnd && endM > citaStart;
    });
  }

  function handleDragMouseDown(e: React.MouseEvent, slotIdx: number, dayIdx: number, date: Date) {
    if (isMobile) return;
    e.preventDefault();
    const newDrag: DragState = {
      active: true,
      dayIndex: dayIdx,
      startSlotIdx: slotIdx,
      currentSlotIdx: slotIdx,
      date,
      hasConflict: false,
    };
    dragRef.current = newDrag;
    setDrag(newDrag);
  }

  function handleDragMouseEnter(slotIdx: number, dayIdx: number, date: Date) {
    if (!dragRef.current?.active) return;
    if (dayIdx !== dragRef.current.dayIndex) return;
    const hasConflict = dragHasConflict(
      date,
      dragRef.current.startSlotIdx,
      slotIdx
    );
    const updated: DragState = {
      ...dragRef.current,
      currentSlotIdx: slotIdx,
      hasConflict,
    };
    dragRef.current = updated;
    setDrag({ ...updated });
  }

  function handleDragMouseUp(e: React.MouseEvent, date: Date) {
    if (!dragRef.current?.active) return;
    e.preventDefault();
    const d = dragRef.current;

    if (d.hasConflict) {
      setDrag(null);
      dragRef.current = null;
      return;
    }

    const minIdx = Math.min(d.startSlotIdx, d.currentSlotIdx);
    const maxIdx = Math.max(d.startSlotIdx, d.currentSlotIdx);
    const startTime = visibleSlots[minIdx];
    const endSlot = visibleSlots[maxIdx];
    const endM = timeToMinutes(endSlot) + 30;
    const endTime = minutesToTime(endM);

    setDrag(null);
    dragRef.current = null;

    openModal(date, startTime, endTime);
  }

  function getDragBlockStyle(slotIdx: number, dayIdx: number): React.CSSProperties | null {
    if (!drag?.active || drag.dayIndex !== dayIdx) return null;

    const minIdx = Math.min(drag.startSlotIdx, drag.currentSlotIdx);
    const maxIdx = Math.max(drag.startSlotIdx, drag.currentSlotIdx);

    if (slotIdx !== minIdx) return null;

    const spanSlots = maxIdx - minIdx + 1;

    return {
      position: 'absolute' as const,
      top: 0,
      left: 2,
      right: 2,
      height: spanSlots * WEEK_SLOT_H,
      background: drag.hasConflict ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
      border: `2px dashed ${drag.hasConflict ? C.red : C.green}`,
      borderRadius: 6,
      zIndex: 30,
      pointerEvents: 'none' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    };
  }

  const [dayDrag, setDayDrag] = useState<{
    active: boolean;
    startSlotIdx: number;
    currentSlotIdx: number;
    hasConflict: boolean;
  } | null>(null);
  const dayDragRef = useRef<typeof dayDrag>(null);

  useEffect(() => {
    function handleGlobalMouseUpDay() {
      if (dayDragRef.current?.active) {
        setDayDrag(null);
        dayDragRef.current = null;
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUpDay);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUpDay);
  }, []);

  function handleDayDragMouseDown(e: React.MouseEvent, slotIdx: number) {
    if (isMobile) return;
    e.preventDefault();
    const newDrag = { active: true, startSlotIdx: slotIdx, currentSlotIdx: slotIdx, hasConflict: false };
    dayDragRef.current = newDrag;
    setDayDrag(newDrag);
  }

  function handleDayDragMouseEnter(slotIdx: number) {
    if (!dayDragRef.current?.active) return;
    const hasConflict = dragHasConflict(selectedDate, dayDragRef.current.startSlotIdx, slotIdx);
    const updated = { ...dayDragRef.current, currentSlotIdx: slotIdx, hasConflict };
    dayDragRef.current = updated;
    setDayDrag({ ...updated });
  }

  function handleDayDragMouseUp(e: React.MouseEvent) {
    if (!dayDragRef.current?.active) return;
    e.preventDefault();
    const d = dayDragRef.current;

    if (d.hasConflict) {
      setDayDrag(null);
      dayDragRef.current = null;
      return;
    }

    const minIdx = Math.min(d.startSlotIdx, d.currentSlotIdx);
    const maxIdx = Math.max(d.startSlotIdx, d.currentSlotIdx);
    const startTime = visibleSlots[minIdx];
    const endM = timeToMinutes(visibleSlots[maxIdx]) + 30;
    const endTime = minutesToTime(endM);

    setDayDrag(null);
    dayDragRef.current = null;

    openModal(selectedDate, startTime, endTime);
  }

  const weekDayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const WEEK_SLOT_H = 44;
  const DAY_SLOT_H = 40;

  function colBg(baseBg: string, colIdx: number): string {
    if (isMobile || hoveredColIdx !== colIdx) return baseBg;
    return `color-mix(in srgb, ${baseBg} 94%, white 6%)`;
  }

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
    <div style={{ height: '100dvh', background: C.bg, color: C.text, display: 'flex', overflow: 'hidden', width: '100%' }}>

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
        adminPin={adminPin}
        onCambiarPerfil={handleCambiarPerfil}
        profesionalFoto={profesional?.foto_url || ''}
        profesionalColor={profesional?.color || ''}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }} className="main-content-desktop">

        {/* ── HEADER ── */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.surfaceAlt}`, flexShrink: 0 }}>
          {/* Fila principal */}
          <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
            <div className="show-mobile-flex" style={{ alignItems: 'center', gap: 8, marginRight: 4, flexShrink: 0 }}>
              {empresa?.logo_url ? (
                <img src={empresa.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: empresa?.color_primario || C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {empresa?.nombre?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{empresa?.nombre || 'Mi negocio'}</p>
            </div>

            {activeSection === 'agenda' && (
              <div style={{ display: 'flex', gap: 2, background: C.surfaceAlt, borderRadius: 8, padding: 2, flexShrink: 0 }}>
                {([
                  { v: 'day', label: 'Día' },
                  ...(isAdmin && profesionales.length > 1 ? [{ v: 'team', label: 'Equipo' }] : []),
                  { v: 'week', label: 'Sem' },
                  { v: 'month', label: 'Mes' },
                ] as { v: ViewMode; label: string }[]).map(({ v, label }) => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: view === v ? 600 : 400, background: view === v ? C.green : 'transparent', color: view === v ? '#fff' : C.textSec, transition: 'all 0.12s' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {activeSection === 'agenda' && (
              <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <button onClick={() => (view === 'day' || view === 'team') ? changeDay(-1) : view === 'week' ? changeWeek(-1) : changeMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, borderRadius: 6, display: 'flex' }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div style={{ textAlign: 'center', minWidth: 130 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
                    {(view === 'day' || view === 'team') ? formatDate(selectedDate) : view === 'week' ? (() => { const wd = getWeekDays(); return `${wd[0].getDate()} – ${wd[6].getDate()} ${wd[6].toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`; })() : formatMonth(selectedDate)}
                  </p>
                  {(view === 'day' || view === 'team') && isToday(selectedDate) && <p style={{ fontSize: 10, fontWeight: 700, color: C.green, lineHeight: 1 }}>HOY</p>}
                </div>
                <button onClick={() => (view === 'day' || view === 'team') ? changeDay(1) : view === 'week' ? changeWeek(1) : changeMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, borderRadius: 6, display: 'flex' }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {isAdmin && activeSection === 'agenda' && profesionales.length > 0 && (
              <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: 0, background: C.surfaceAlt, borderRadius: 8, padding: 2, flexShrink: 0, marginLeft: 4 }}>
                <button
                  onClick={() => setSelectedProfId(null)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: selectedProfId === null ? 600 : 400,
                    background: selectedProfId === null ? C.green : 'transparent',
                    color: selectedProfId === null ? '#fff' : C.textSec,
                    transition: 'all 0.12s', whiteSpace: 'nowrap' as const,
                  }}>
                  Todos
                </button>
                {profesionales.map(prof => (
                  <button
                    key={prof.id}
                    onClick={() => setSelectedProfId(selectedProfId === prof.id ? null : prof.id)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: selectedProfId === prof.id ? 600 : 400,
                      background: selectedProfId === prof.id ? (prof.color || C.green) : 'transparent',
                      color: selectedProfId === prof.id ? '#fff' : C.textSec,
                      transition: 'all 0.12s', whiteSpace: 'nowrap' as const,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: selectedProfId === prof.id ? 'rgba(255,255,255,0.8)' : (prof.color || C.green),
                      display: 'inline-block', flexShrink: 0,
                    }} />
                    {prof.nombre.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* ── DERECHA HEADER: alerta accionable + notificaciones ── */}
            <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {/* Alerta riesgo no-show — solo si hay citas sin confirmar y estamos en agenda */}
              {activeSection === 'agenda' && badgeRiesgo > 0 && (
                <div
                  title={`${badgeRiesgo} cita${badgeRiesgo > 1 ? 's' : ''} sin confirmar — riesgo de no-show`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8, padding: '4px 9px', cursor: 'default',
                  }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 4px rgba(239,68,68,0.55)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', letterSpacing: 0.1 }}>{badgeRiesgo} sin confirmar</span>
                </div>
              )}
              {/* Notificaciones */}
              <div style={{ position: 'relative' }}>
                <button
                  ref={notifBtnRef}
                  onClick={() => setNotifPanelOpen(o => !o)}
                  title="Notificaciones de hoy"
                  style={{
                    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: notifPanelOpen ? 'rgba(34,197,94,0.15)' : 'transparent',
                    color: notifPanelOpen ? '#22C55E' : '#94A3B8',
                    transition: 'all 0.12s', fontSize: 16,
                  }}>
                  🔔
                  {notifsNoLeidas > 0 && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 15, height: 15, borderRadius: '50%',
                      background: '#EF4444', color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${C.surface}`,
                    }}>
                      {notifsNoLeidas > 9 ? '9+' : notifsNoLeidas}
                    </span>
                  )}
                </button>

                {/* ── PANEL DESPLEGABLE ── */}
                {notifPanelOpen && (
                  <div
                    id="notif-panel"
                    style={{
                      position: 'absolute', top: 40, right: 0,
                      width: 320, maxHeight: 480,
                      background: C.surface,
                      border: '1px solid rgba(148,163,184,0.12)',
                      borderRadius: 14,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      zIndex: 200,
                      display: 'flex', flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Cabecera panel */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(148,163,184,0.08)',
                      flexShrink: 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Hoy</span>
                        {notifsNoLeidas > 0 && (
                          <span style={{
                            background: '#EF4444', color: '#fff',
                            fontSize: 10, fontWeight: 800,
                            padding: '1px 6px', borderRadius: 20,
                          }}>{notifsNoLeidas}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {notifsNoLeidas > 0 && (
                          <button
                            onClick={marcarTodasLeidasHeader}
                            style={{
                              fontSize: 11, fontWeight: 600, color: '#22C55E',
                              background: 'rgba(34,197,94,0.1)', border: 'none',
                              borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                              whiteSpace: 'nowrap' as const,
                            }}>
                            ✓ Leer todas
                          </button>
                        )}
                        <button
                          onClick={() => setNotifPanelOpen(false)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16, padding: 2, display: 'flex' }}>
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Lista */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {notifsHoyLoading ? (
                        <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Cargando…</div>
                      ) : notifsHoy.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center' }}>
                          <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                          <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sin notificaciones hoy</p>
                        </div>
                      ) : (
                        notifsHoy.map((n, i) => {
                          const conf = (n.estado || '').toLowerCase();
                          const cfgMap: Record<string, { emoji: string; color: string }> = {
                            aceptado:      { emoji: '✅', color: '#22C55E' },
                            pendiente:     { emoji: '📌', color: '#F59E0B' },
                            sin_respuesta: { emoji: '📌', color: '#F59E0B' },
                            no_confirmada: { emoji: '🚨', color: '#EF4444' },
                            cancelado:     { emoji: '❌', color: '#EF4444' },
                            enviado:       { emoji: '📤', color: '#3B82F6' },
                          };
                          const cfg = cfgMap[conf] || { emoji: '🔔', color: '#94A3B8' };
                          const hora = n.created_at
                            ? new Date(n.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                            : '';
                          return (
                            <div key={n.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 16px',
                              borderBottom: i < notifsHoy.length - 1 ? '1px solid rgba(148,163,184,0.06)' : 'none',
                              background: n.leida ? 'transparent' : 'rgba(34,197,94,0.03)',
                            }}>
                              <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.emoji}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  fontSize: 13, fontWeight: n.leida ? 400 : 700,
                                  color: C.text, margin: 0,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                                }}>
                                  {n.clientes?.nombre || 'Cliente'}
                                </p>
                                <p style={{ fontSize: 11, color: cfg.color, margin: '1px 0 0', fontWeight: 600 }}>
                                  {conf === 'aceptado' ? 'Confirmada' :
                                   conf === 'cancelado' ? 'Cancelada' :
                                   conf === 'sin_respuesta' ? 'Sin respuesta' :
                                   conf === 'no_confirmada' ? 'No confirmada' :
                                   conf === 'enviado' ? 'Enviado' : conf}
                                </p>
                              </div>
                              <span style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>{hora}</span>
                              {!n.leida && (
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{
                      padding: '10px 16px',
                      borderTop: '1px solid rgba(148,163,184,0.08)',
                      flexShrink: 0, textAlign: 'center',
                    }}>
                      <button
                        onClick={() => { setActiveSection('notificaciones'); setNotifPanelOpen(false); }}
                        style={{
                          fontSize: 12, fontWeight: 600, color: '#22C55E',
                          background: 'none', border: 'none', cursor: 'pointer',
                        }}>
                        Ver historial completo →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Barra móvil de navegación de fecha */}
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
        {/* ── FIN HEADER ── */}

        {/* ── BARRA KPIs ── todas las vistas de agenda, solo desktop ── */}
        {activeSection === 'agenda' && !isMobile && (() => {
          const hoy = toDS(new Date());
          const citasTotalesHoy = allCitas.filter(c => {
            const ds = (c.hora_inicio || '').substring(0, 10);
            return ds === hoy && (c.estado || '').toLowerCase() !== 'cancelada';
          });
          const totalHoy    = citasTotalesHoy.length;
          const confirmadas = citasTotalesHoy.filter(c => (c.confirmacion_estado || '').toLowerCase() === 'confirmada').length;
          const pendientes  = citasTotalesHoy.filter(c => {
            const ce = (c.confirmacion_estado || '').toLowerCase();
            return ce === 'pendiente' || !c.confirmacion_estado;
          }).length;
          const riesgo      = citasTotalesHoy.filter(c => (c.confirmacion_estado || '').toLowerCase() === 'no_confirmada').length;
          const canceladas  = allCitas.filter(c => (c.hora_inicio || '').substring(0, 10) === hoy && (c.estado || '').toLowerCase() === 'cancelada').length;
          const libresHoy   = freeSlotCount(new Date());

          // En vistas semana y mes: label contextual diferente
          const isWeekOrMonth = view === 'week' || view === 'month';

          const chips: { label: string; value: number | string; color: string; dot: string; show: boolean }[] = [
            { label: 'Citas hoy',     value: totalHoy,    color: '#94A3B8', dot: '#475569',  show: true },
            { label: 'Confirmadas',   value: confirmadas, color: '#22C55E', dot: '#22C55E',  show: true },
            { label: 'Pendientes',    value: pendientes,  color: '#F59E0B', dot: '#F59E0B',  show: pendientes > 0 },
            { label: 'Sin confirmar', value: riesgo,      color: '#EF4444', dot: '#EF4444',  show: riesgo > 0 },
            { label: 'Canceladas',    value: canceladas,  color: '#64748B', dot: '#475569',  show: canceladas > 0 },
            { label: isWeekOrMonth ? 'Libres hoy' : 'Huecos libres', value: libresHoy, color: '#38BDF8', dot: '#38BDF8', show: true },
          ];

          const visibleChips = chips.filter(c => c.show);
          return (
            <div style={{
              flexShrink: 0,
              background: '#0D1829',
              borderBottom: `1px solid rgba(148,163,184,0.09)`,
              padding: '0 20px',
              display: 'flex', alignItems: 'center', gap: 0,
              height: 38, overflowX: 'auto',
              scrollbarWidth: 'none' as any,
            }}>
              {/* Fecha de referencia */}
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#475569',
                letterSpacing: 0.8, whiteSpace: 'nowrap', flexShrink: 0,
                marginRight: 16, textTransform: 'uppercase' as const,
              }}>
                {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              {/* Divisor */}
              <div style={{ width: 1, height: 16, background: 'rgba(148,163,184,0.12)', flexShrink: 0, marginRight: 16 }} />
              {/* Métricas */}
              {visibleChips.map((chip, idx) => (
                <div key={chip.label} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 14px',
                  height: '100%',
                  borderRight: idx < visibleChips.length - 1
                    ? '1px solid rgba(148,163,184,0.08)'
                    : 'none',
                  flexShrink: 0,
                  cursor: 'default',
                }}>
                  <span style={{
                    fontSize: 15, fontWeight: 800,
                    color: chip.color,
                    lineHeight: 1, letterSpacing: -0.5,
                    fontVariantNumeric: 'tabular-nums' as any,
                  }}>{chip.value}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    color: '#546A82',
                    letterSpacing: 0.1, whiteSpace: 'nowrap',
                  }}>{chip.label}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {activeSection !== 'agenda' && (
          <div className="flex-1 overflow-y-auto" style={{ background: C.bg, paddingBottom: 80 }}>
            {activeSection === 'clientes' && <ClientesSection empresaId={empresa?.id || ''} />}
            {activeSection === 'servicios' && <ServiciosSection empresaId={empresa?.id || ''} {...({canEdit: isAdmin || !!permisos.editar_servicios} as any)} />}
            {activeSection === 'estadisticas' && <EstadisticasSection empresaId={empresa?.id || ''} />}
            {activeSection === 'ausencias' && <AusenciasSection empresaId={empresa?.id || ''} isAdmin={isAdmin} />}
            {activeSection === 'notificaciones' && <NotificacionesSection empresaId={empresa?.id || ''} onNavigate={setActiveSection} />}
            {activeSection === 'configuracion' && empresa && <ConfiguracionSection empresa={empresa} profesional={profesional} isAdmin={isAdmin} onEmpresaUpdated={(data: any) => setEmpresa((prev: any) => ({ ...prev, ...data }))} onProfesionalUpdated={(data: any) => setProfesional((prev: any) => ({ ...prev, ...data }))} />}
          </div>
        )}

        {activeSection === 'agenda' && (<>

          {/* ── VISTA DÍA ── */}
          {view === 'day' && (<>
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

            <div
              ref={dayScrollRef}
              key={!isMobile ? `day-${animKey}` : 'day-mobile'}
              className="flex-1 overflow-y-auto"
              style={{ paddingTop: 8, paddingBottom: 80, animation: !isMobile && navDir ? `agendaSlide${navDir === 'left' ? 'Left' : 'Right'} 160ms cubic-bezier(0.25,0.46,0.45,0.94) both` : undefined }}
            >
              <div style={{ paddingLeft: isMobile ? 8 : 16, paddingRight: isMobile ? 8 : 16, position: 'relative' }}>
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
                    if (!citaAtSlot[slotIdx]) {
                      citaAtSlot[slotIdx] = cita;
                      const spanSlots = isMobile ? 1 : Math.ceil(dur / 30);
                      citaSpans[slotIdx] = spanSlots;
                      for (let i = slotIdx; i < slotIdx + spanSlots; i++) coveredSlots.add(i);
                    }
                  });

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

                  const dayDragMinIdx = dayDrag ? Math.min(dayDrag.startSlotIdx, dayDrag.currentSlotIdx) : -1;
                  const dayDragMaxIdx = dayDrag ? Math.max(dayDrag.startSlotIdx, dayDrag.currentSlotIdx) : -1;

                  // ── Empty state: día sin citas ──
                  // Se muestra como franja sutil en la zona media del horario, no interrumpe el grid
                  const emptyStateMidSlot = !isMobile && dayCitas.length === 0
                    ? Math.floor(slotsToRender.length * 0.35)
                    : -1;

                  return slotsToRender.map((slot, si) => {
                    if (!isMobile && coveredSlots.has(si) && !citaAtSlot[si]) return null;
                    const isHour = slot.endsWith(':00');
                    const MIN_H = isMobile ? 56 : DAY_SLOT_H;
                    const slotCitas = isMobile ? (citasPerHourSlot[si] || []) : (citaAtSlot[si] ? [citaAtSlot[si]] : []);

                    const isInDayDragRange = !isMobile && dayDrag?.active && si >= dayDragMinIdx && si <= dayDragMaxIdx;
                    const isDayDragStart = !isMobile && dayDrag?.active && si === dayDragMinIdx;

                    return (
                      <div key={slot} style={{ display: 'flex', minHeight: slotCitas.length > 0 ? Math.max(MIN_H, slotCitas.length * 52) : MIN_H }}>
                        <div style={{ width: isMobile ? 44 : 64, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: isMobile ? 8 : 12, paddingTop: 4 }}>
                          <span style={{
                            fontSize: isMobile ? 12 : (isHour ? 11 : 10),
                            color: isHour ? '#64748B' : 'rgba(100,116,139,0.4)',
                            fontWeight: isHour ? 600 : 400,
                          }}>{isHour ? slot : (isMobile ? slot : '· · ·')}</span>
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
                            <div
                              data-slot-idx={si}
                              data-day-idx={0}
                              data-date={toDS(selectedDate)}
                              style={{ flex: 1, borderBottom: `1px solid ${isHour ? 'rgba(148,163,184,0.14)' : 'rgba(36,50,71,0.3)'}`, minHeight: MIN_H, position: 'relative', display: 'flex', flexDirection: 'column', gap: 3, padding: slotCitas.length > 0 ? '2px 0' : 0, ...(absOverlay ? { background: absOverlay.background, borderLeft: `${absOverlay.borderLeftWidth} ${absOverlay.borderLeftStyle} ${absOverlay.borderLeftColor}` } : {}), userSelect: 'none' }}
                            >
                              {moveDrag?.active && moveDrag.targetSlotIdx === si && (() => {
                                const ghostH = moveDrag.durSlots * MIN_H;
                                return (
                                  <div style={{
                                    position: 'absolute', top: 0, left: 4, right: 4,
                                    height: ghostH,
                                    background: moveDrag.hasConflict ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                                    border: `2px dashed ${moveDrag.hasConflict ? C.red : C.green}`,
                                    borderRadius: 8, zIndex: 25, pointerEvents: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: moveDrag.hasConflict ? C.red : C.green }}>
                                      {moveDrag.hasConflict ? 'Ocupado' : `${visibleSlots[moveDrag.targetSlotIdx]} – ${minutesToTime(timeToMinutes(visibleSlots[moveDrag.targetSlotIdx]) + moveDrag.durSlots * 30)}`}
                                    </span>
                                  </div>
                                );
                              })()}
                              {isDayDragStart && dayDrag && (() => {
                                const spanSlots = dayDragMaxIdx - dayDragMinIdx + 1;
                                const startLabel = visibleSlots[dayDragMinIdx];
                                const endM = timeToMinutes(visibleSlots[dayDragMaxIdx]) + 30;
                                const endLabel = minutesToTime(endM);
                                return (
                                  <div style={{
                                    position: 'absolute', top: 0, left: 4, right: 4,
                                    height: spanSlots * MIN_H,
                                    background: dayDrag.hasConflict ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                                    border: `2px dashed ${dayDrag.hasConflict ? C.red : C.green}`,
                                    borderRadius: 8, zIndex: 25, pointerEvents: 'none',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                  }}>
                                    {spanSlots >= 2 && (
                                      <span style={{ fontSize: 12, fontWeight: 700, color: dayDrag.hasConflict ? C.red : C.green }}>
                                        {startLabel} – {endLabel}
                                      </span>
                                    )}
                                    {dayDrag.hasConflict && (
                                      <span style={{ fontSize: 10, color: C.red }}>Ocupado</span>
                                    )}
                                  </div>
                                );
                              })()}

                              {slotCitas.length > 0 ? (
                                slotCitas.map(cita => (
                                  <div key={cita.id}
                                    onClick={() => { if (!moveDrag) setSelectedCita(cita); }}
                                    onMouseDown={e => handleCitaMouseDown(e, cita, si, 0, selectedDate)}
                                    onMouseEnter={() => handleCitaMouseEnter(cita.id)}
                                    onMouseLeave={() => { setHoveredCitaId(null); }}
                                    style={{
                                      background: isCompletada(cita.estado) ? 'rgba(74,222,128,0.12)' : `${citaColor(cita.estado)}22`,
                                      borderLeft: `3px solid ${citaColor(cita.estado)}`,
                                      borderRadius: isMobile ? 8 : 10,
                                      padding: isMobile ? '8px 10px' : '10px 14px',
                                      margin: isMobile ? '1px 4px' : '3px 8px',
                                      cursor: isCompletada(cita.estado) ? 'pointer' : (isMobile ? 'pointer' : 'grab'),
                                      boxSizing: 'border-box' as const,
                                      position: 'relative' as const,
                                      opacity: moveDrag?.cita?.id === cita.id ? 0.3 : 1,
                                      transition: 'opacity 0.15s',
                                    }}>
                                    {isCompletada(cita.estado) && (
                                      <div style={{ position: 'absolute', top: 5, right: 8, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(74,222,128,0.22)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 7, padding: '3px 8px' }}>
                                        <span style={{ fontSize: 11, color: '#4ADE80', fontWeight: 800 }}>✓</span>
                                        <span style={{ fontSize: 10, color: '#4ADE80', fontWeight: 700, letterSpacing: 0.2 }}>Completada</span>
                                      </div>
                                    )}
                                    {!isMobile && renderQuickActions(cita)}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <p style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, letterSpacing: 0.2, textTransform: 'uppercase' as const, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                        {cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente'}
                                        {cita.cliente_id && clientRiskCache[cita.cliente_id]?.show && <span style={{ marginLeft: 4, fontSize: 11 }}>{clientRiskCache[cita.cliente_id].icon}</span>}
                                      </p>
                                      {/* Vista día desktop: badge estado texto + dot */}
                                      {!isMobile && !isCompletada(cita.estado) && (() => {
                                        const conf = (cita.confirmacion_estado || 'pendiente').toLowerCase();
                                        const estadoBase = (cita.estado || '').toLowerCase();
                                        if (['completada','cancelada','no-show','no_show'].includes(estadoBase)) return null;
                                        const map: Record<string, { label: string; color: string }> = {
                                          pendiente:     { label: 'Pendiente',      color: '#F59E0B' },
                                          confirmada:    { label: 'Confirmada',     color: '#22C55E' },
                                          no_confirmada: { label: 'Sin confirmar',  color: '#EF4444' },
                                          cancelada:     { label: 'Cancelada',      color: '#94A3B8' },
                                        };
                                        const cfg = map[conf] || map['pendiente'];
                                        return (
                                          <div style={{
                                            display: 'flex', alignItems: 'center', gap: 3,
                                            padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                                            background: cfg.color + '20',
                                            border: `1px solid ${cfg.color}40`,
                                          }}>
                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, letterSpacing: 0.2, whiteSpace: 'nowrap' as const }}>{cfg.label}</span>
                                          </div>
                                        );
                                      })()}
                                      {/* Mobile: solo dot + hora */}
                                      {isMobile && renderConfirmacionDot(cita, 6)}
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
                                !isMobile ? (
                                  <div
                                    style={{ position: 'absolute', inset: 0, cursor: isInDayDragRange ? 'ns-resize' : 'pointer' }}
                                    onMouseDown={e => handleDayDragMouseDown(e, si)}
                                    onMouseEnter={e => {
                                      handleDayDragMouseEnter(si);
                                      if (!dayDragRef.current?.active) (e.currentTarget as HTMLElement).style.background = C.greenBg;
                                    }}
                                    onMouseLeave={e => {
                                      if (!dayDragRef.current?.active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }}
                                    onMouseUp={e => handleDayDragMouseUp(e)}
                                    onClick={() => {
                                      if (!dayDrag) openModal(selectedDate, slot);
                                    }}
                                  >
                                    {/* Indicador sutil cuando el día está vacío — solo en slot 12:00 */}
                                    {dayCitas.length === 0 && slot === '12:00' && (
                                      <span style={{
                                        position: 'absolute',
                                        left: 16, top: '50%', transform: 'translateY(-50%)',
                                        fontSize: 10, fontWeight: 500,
                                        color: 'rgba(100,116,139,0.3)',
                                        letterSpacing: 0.3,
                                        pointerEvents: 'none',
                                        userSelect: 'none',
                                      }}>
                                        {isWorkingDay(selectedDate) ? 'Día libre · Haz clic para añadir una cita' : 'Día no laborable'}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div onClick={() => openModal(selectedDate, slot)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.greenBg; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }} />
                                )
                              )}
                              {nowSlotIdx === si && (
                                <div data-now-line style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, paddingRight: 4 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F87171', boxShadow: '0 0 6px rgba(248,113,113,0.7)' }} />
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#F87171', letterSpacing: 0.4, lineHeight: 1 }}>AHORA</span>
                                  </div>
                                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #F87171 0%, rgba(248,113,113,0.15) 100%)', opacity: 0.9 }} />
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


          {/* ── VISTA EQUIPO ── */}
          {view === 'team' && (() => {
            const profsVisibles = selectedProfId
              ? profesionales.filter(p => p.id === selectedProfId)
              : profesionales;

            const TEAM_SLOT_H = 48;
            const COL_MIN_W = 160;
            const COL_MAX_W = 220;

            return (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `56px repeat(${profsVisibles.length}, minmax(${COL_MIN_W}px, ${COL_MAX_W}px))`,
                  flexShrink: 0,
                  background: C.surface,
                  borderBottom: `2px solid ${C.surfaceAlt}`,
                  position: 'sticky', top: 0, zIndex: 10,
                  width: 'fit-content',
                  minWidth: '100%',
                }}>
                  <div style={{ borderRight: `1px solid ${C.surfaceAlt}` }} />
                  {profsVisibles.map((prof, di) => {
                    const profCitas = allCitas.filter(c =>
                      c.profesional_id === prof.id &&
                      rawDate(c.hora_inicio) === toDS(selectedDate) &&
                      (c.estado || '').toLowerCase() !== 'cancelada'
                    );
                    const libre = visibleSlots.filter(s => {
                      const slotM = timeToMinutes(s);
                      return !profCitas.some(c => {
                        const cs = rawTimeMin(c.hora_inicio);
                        const ce = c.hora_fin ? rawTimeMin(c.hora_fin) : cs + 30;
                        return slotM >= cs && slotM < ce;
                      });
                    }).length;
                    const av = getAvailability(libre);
                    return (
                      <div key={prof.id}
                        onMouseEnter={() => !isMobile && setHoveredColIdx(di)}
                        onMouseLeave={() => setHoveredColIdx(null)}
                        style={{
                          padding: '8px 10px',
                          borderRight: `1px solid ${C.surfaceAlt}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                          background: hoveredColIdx === di && !isMobile
                            ? 'rgba(255,255,255,0.04)'
                            : selectedProfId === prof.id ? `${prof.color || C.green}18` : 'transparent',
                          transition: 'background 0.15s',
                        }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: prof.color || C.green,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
                        }}>
                          {prof.nombre?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' as const }}>
                          {prof.nombre.split(' ')[0]}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: av.color, whiteSpace: 'nowrap' as const }}>
                          {profCitas.length === 0 ? 'Libre' : av.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `56px repeat(${profsVisibles.length}, minmax(${COL_MIN_W}px, ${COL_MAX_W}px))`,
                    width: 'fit-content',
                    minWidth: '100%',
                  }}>
                    {visibleSlots.map((slot, si) => {
                      const isHour = slot.endsWith(':00');
                      const isNow = isToday(selectedDate) && (() => {
                        const m = timeToMinutes(slot);
                        return currentMinutes >= m && currentMinutes < m + 30;
                      })();

                      return [
                        <div key={`time-${si}`} style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                          paddingRight: 6, paddingTop: 6,
                          height: TEAM_SLOT_H,
                          borderBottom: `1px solid ${isHour ? C.surfaceAlt : 'rgba(36,50,71,0.3)'}`,
                          background: C.bg, flexShrink: 0,
                        }}>
                          <span style={{ fontSize: isHour ? 10 : 9, color: isHour ? '#64748B' : 'rgba(100,116,139,0.35)', fontWeight: isHour ? 600 : 400, opacity: 1, lineHeight: 1 }}>{isHour ? slot : '·'}</span>
                        </div>,

                        ...profsVisibles.map((prof, di) => {
                          const profCitas = allCitas.filter(c =>
                            c.profesional_id === prof.id &&
                            rawDate(c.hora_inicio) === toDS(selectedDate) &&
                            (c.estado || '').toLowerCase() !== 'cancelada'
                          );

                          const coveredByCita = profCitas.find(c => {
                            const cs = rawTimeMin(c.hora_inicio);
                            const ce = c.hora_fin ? rawTimeMin(c.hora_fin) : cs + 30;
                            const slotM = timeToMinutes(slot);
                            return slotM > cs && slotM < ce;
                          });
                          if (coveredByCita) return null;

                          const citaHere = profCitas.find(c => {
                            const cs = rawTimeMin(c.hora_inicio);
                            return cs === timeToMinutes(slot);
                          });

                          const durSlots = citaHere ? (() => {
                            const cs = rawTimeMin(citaHere.hora_inicio);
                            const ce = citaHere.hora_fin ? rawTimeMin(citaHere.hora_fin) : cs + 30;
                            return Math.max(1, Math.ceil((ce - cs) / 30));
                          })() : 1;

                          const slotAbsProf = isSlotInAbsence(slot, selectedDate);
                          const baseCellBg = slotAbsProf?.scope === 'company'
                            ? 'rgba(239,68,68,0.05)'
                            : C.surface;
                          const cellBg = colBg(baseCellBg, di);

                          return (
                            <div
                              key={`cell-${si}-${di}`}
                              data-slot-idx={si}
                              data-day-idx={di}
                              data-date={toDS(selectedDate)}
                              onMouseEnter={() => !isMobile && setHoveredColIdx(di)}
                              onMouseLeave={() => setHoveredColIdx(null)}
                              style={{
                                height: citaHere ? durSlots * TEAM_SLOT_H : TEAM_SLOT_H,
                                gridRow: citaHere && durSlots > 1 ? `span ${durSlots}` : undefined,
                                borderBottom: `1px solid ${isHour ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.06)'}`,
                                borderRight: `1px solid rgba(148,163,184,0.08)`,
                                borderLeft: `1px solid rgba(148,163,184,0.06)`,
                                background: cellBg,
                                transition: 'background 0.15s',
                                position: 'relative',
                                userSelect: 'none' as const,
                              }}
                            >
                              {isNow && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, paddingRight: 3 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F87171', boxShadow: '0 0 5px rgba(248,113,113,0.7)' }} />
                                    <span style={{ fontSize: 8, fontWeight: 700, color: '#F87171', letterSpacing: 0.3 }}>AHORA</span>
                                  </div>
                                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #F87171 0%, rgba(248,113,113,0.1) 100%)', opacity: 0.9 }} />
                                </div>
                              )}

                              {citaHere ? (
                                <div
                                  onClick={() => setSelectedCita(citaHere)}
                                  onMouseDown={e => handleCitaMouseDown(e, citaHere, si, di, selectedDate)}
                                  onMouseEnter={() => handleCitaMouseEnter(citaHere.id)}
                                  onMouseLeave={() => { setHoveredCitaId(null); }}
                                  style={{
                                    position: 'absolute', inset: 2,
                                    background: isCompletada(citaHere.estado) ? 'rgba(74,222,128,0.12)' : `${citaColor(citaHere.estado)}22`,
                                    borderLeft: `3px solid ${citaColor(citaHere.estado)}`,
                                    borderRadius: 8,
                                    padding: '4px 6px',
                                    cursor: isCompletada(citaHere.estado) ? 'pointer' : 'grab',
                                    boxSizing: 'border-box' as const,
                                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                                    overflow: 'hidden',
                                    opacity: moveDrag?.cita?.id === citaHere.id ? 0.3 : 1,
                                    transition: 'opacity 0.15s',
                                  }}
                                >
                                  {isCompletada(citaHere.estado) && (
                                    <div style={{ position: 'absolute', top: 3, right: 4, background: 'rgba(74,222,128,0.22)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 5, padding: '2px 6px' }}>
                                      <span style={{ fontSize: 9, color: '#4ADE80', fontWeight: 800 }}>✓</span>
                                    </div>
                                  )}
                                  {renderQuickActions(citaHere)}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                                    <p style={{
                                      fontSize: 10, fontWeight: 700, color: '#fff',
                                      lineHeight: 1.3, textTransform: 'uppercase' as const,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                                      flex: 1, minWidth: 0,
                                    }}>
                                      {citaHere.clientes?.nombre || citaHere.cliente_nombre_libre || 'Cliente'}
                                      {citaHere.cliente_id && clientRiskCache[citaHere.cliente_id]?.show &&
                                        <span style={{ marginLeft: 3, fontSize: 8 }}>{clientRiskCache[citaHere.cliente_id].icon}</span>
                                      }
                                    </p>
                                    {renderConfirmacionDot(citaHere, 6)}
                                  </div>
                                  {durSlots >= 2 && (() => {
                                    const svc = citaHere.servicios?.nombre || citaHere.servicio_nombre_libre || '';
                                    return svc ? (
                                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                        {svc}
                                      </p>
                                    ) : null;
                                  })()}
                                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.2, marginTop: 'auto' as const }}>
                                    {citaHere.hora_inicio?.substring(11, 16)}
                                    {citaHere.hora_fin ? ` – ${citaHere.hora_fin?.substring(11, 16)}` : ''}
                                  </p>
                                </div>
                              ) : (
                                <div
                                  style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
                                  onClick={() => openModal(selectedDate, slot)}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.greenBg; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                />
                              )}

                              {moveDrag?.active && moveDrag.targetDayIdx === di && moveDrag.targetSlotIdx === si && (() => {
                                const ghostH = moveDrag.durSlots * TEAM_SLOT_H;
                                return (
                                  <div style={{
                                    position: 'absolute', top: 0, left: 2, right: 2,
                                    height: ghostH,
                                    background: moveDrag.hasConflict ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                                    border: `2px dashed ${moveDrag.hasConflict ? C.red : C.green}`,
                                    borderRadius: 6, zIndex: 25, pointerEvents: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: moveDrag.hasConflict ? C.red : C.green }}>
                                      {moveDrag.hasConflict ? 'Ocupado' : slot}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        }).filter(Boolean),
                      ];
                    })}
                  </div>
                </div>

                <button onClick={() => openModal(selectedDate)} style={{ position: 'fixed', bottom: 32, right: 32, width: 56, height: 56, borderRadius: '50%', background: C.green, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px rgba(34,197,94,0.45)`, zIndex: 35 }}>
                  <Plus className="w-6 h-6 text-white" />
                </button>
              </div>
            );
          })()}

          {/* ── VISTA SEMANA ── */}
          {view === 'week' && (
            <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
              {/* ── Mini calendario lateral — discreto, auxiliar ── */}
              {!isMobile && (
                <div style={{
                  width: 168, flexShrink: 0,
                  borderRight: `1px solid rgba(148,163,184,0.07)`,
                  background: '#0B1422',
                  padding: '14px 10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 0,
                  overflowY: 'auto',
                }}>
                  {/* Navegación mes del minical */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <button
                      onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x; })}
                      style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: '2px 3px', lineHeight: 1, display: 'flex' }}>
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'capitalize' as const, letterSpacing: 0.4 }}>
                      {miniCalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setMiniCalMonth(d => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; })}
                      style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: '2px 3px', lineHeight: 1, display: 'flex' }}>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Headers días */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 3 }}>
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: 8, color: '#334155', fontWeight: 700, padding: '1px 0', letterSpacing: 0.4 }}>{d}</div>
                    ))}
                  </div>
                  {/* Días */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                    {getMonthDays(miniCalMonth).map((day, i) => {
                      if (!day) return <div key={`e${i}`} style={{ height: 20 }} />;
                      const today = isToday(day);
                      const inWeek = isInCurrentWeek(day);
                      const hasCitas = allCitas.some(c => rawDate(c.hora_inicio) === toDS(day) && (c.estado || '').toLowerCase() !== 'cancelada');
                      return (
                        <div key={i}
                          onClick={() => setSelectedDate(new Date(day))}
                          style={{
                            textAlign: 'center', fontSize: 9,
                            lineHeight: '20px', height: 20, borderRadius: 4,
                            cursor: 'pointer',
                            background: today ? C.green : inWeek ? `rgba(34,197,94,0.15)` : 'transparent',
                            color: today ? '#fff' : inWeek ? C.green : '#475569',
                            fontWeight: today || inWeek ? 700 : 400,
                            position: 'relative',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { if (!today && !inWeek) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; }}
                          onMouseLeave={e => { if (!today && !inWeek) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                          {day.getDate()}
                          {hasCitas && !today && (
                            <div style={{
                              position: 'absolute', bottom: 1, left: '50%',
                              transform: 'translateX(-50%)',
                              width: 2, height: 2, borderRadius: '50%',
                              background: inWeek ? C.green : '#334155',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Botón Hoy */}
                  <button
                    onClick={() => { const t = new Date(); setSelectedDate(t); setMiniCalMonth(t); }}
                    style={{
                      marginTop: 12, padding: '5px 0',
                      borderRadius: 6, border: `1px solid rgba(148,163,184,0.1)`,
                      background: 'transparent', color: '#475569',
                      fontSize: 10, cursor: 'pointer', fontWeight: 600, letterSpacing: 0.3,
                    }}>Hoy</button>
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: isMobile ? '0' : '10px 12px 0' }}>

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

                {!isMobile && (
                  <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 8 }}>
                    <button onClick={() => changeWeek(-1)} className="p-2" style={{ color: C.textSec }}><ChevronLeft className="w-5 h-5" /></button>
                    <span className="text-sm font-semibold">{(() => { const d = getWeekDays(); return `${d[0].getDate()} – ${d[6].getDate()} ${d[6].toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`; })()}</span>
                    <button onClick={() => changeWeek(1)} className="p-2" style={{ color: C.textSec }}><ChevronRight className="w-5 h-5" /></button>
                  </div>
                )}

                <div
                  key={!isMobile ? `week-${animKey}` : 'week-mobile'}
                  style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 80, animation: !isMobile && navDir ? `agendaSlide${navDir === 'left' ? 'Left' : 'Right'} 160ms cubic-bezier(0.25,0.46,0.45,0.94) both` : undefined }}
                >
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
                      const isHovered = !isMobile && hoveredColIdx === di;

                      const headerBg = isSel ? 'rgba(34,197,94,0.25)'
                        : today ? 'rgba(34,197,94,0.2)'
                        : dayCompanyClosures.length > 0 ? 'rgba(239,68,68,0.1)'
                        : working
                          ? (isHovered ? 'rgba(255,255,255,0.06)' : C.surfaceAlt)
                          : (isHovered ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.4)');

                      cells.push(
                        <div key={`th-${di}`}
                          onMouseEnter={() => !isMobile && setHoveredColIdx(di)}
                          onMouseLeave={() => setHoveredColIdx(null)}
                          onClick={() => {
                            const hasEmpAbsence = !isAdmin && absenceBlocksForDate(day).length > 0;
                            if (hasEmpAbsence) { openModal(day); }
                            else if (working) { goToDay(day); }
                            else { setAnotacionModal({ open: true, date: day }); }
                          }}
                          style={{ gridColumn: di + 2, gridRow: 1, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: headerBg, transition: 'background 0.15s', borderRadius: '10px 10px 0 0', borderTop: isSel || today ? `1px solid ${C.green}55` : dayCompanyClosures.length > 0 ? '1px solid rgba(239,68,68,0.25)' : `1px solid rgba(148,163,184,0.12)`, borderLeft: isSel || today ? `1px solid ${C.green}55` : `1px solid rgba(148,163,184,0.12)`, borderRight: isSel || today ? `1px solid ${C.green}55` : `1px solid rgba(148,163,184,0.12)`, borderBottom: `1px solid rgba(148,163,184,0.08)`, cursor: 'pointer', padding: '4px 2px' }}>
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
                          {(() => {
                            const empAbs = absenceBlocksForDate(day);
                            if (!empAbs.length) return null;
                            return (
                              <div style={{
                                marginTop: 3, padding: '2px 5px', borderRadius: 5,
                                background: 'rgba(245,158,11,0.15)', borderLeft: '2px solid rgba(245,158,11,0.6)',
                                display: 'flex', alignItems: 'center', gap: 3, maxWidth: '92%',
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
                          <span style={{ fontSize: isHour ? 10 : 9, color: isHour ? '#64748B' : 'rgba(100,116,139,0.35)', fontWeight: isHour ? 600 : 400, opacity: 1, lineHeight: 1, whiteSpace: 'nowrap' }}>{isHour ? slot : '·'}</span>
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

                        const baseWeekCellBg = isCompanyClosure
                          ? 'rgba(239,68,68,0.05)'
                          : (working ? C.surface : 'rgba(15,23,42,0.35)');
                        const weekCellBg = colBg(baseWeekCellBg, di);

                        const dragBlockStyle = !isMobile ? getDragBlockStyle(si, di) : null;
                        const isDragActive = drag?.active && drag.dayIndex === di;
                        const dragMinIdx = drag ? Math.min(drag.startSlotIdx, drag.currentSlotIdx) : -1;
                        const dragMaxIdx = drag ? Math.max(drag.startSlotIdx, drag.currentSlotIdx) : -1;
                        const isInDragRange = isDragActive && si >= dragMinIdx && si <= dragMaxIdx;

                        cells.push(
                          <div
                            key={`cell-${si}-${di}`}
                            data-slot-idx={si}
                            data-day-idx={di}
                            data-date={toDS(day)}
                            onMouseEnter={() => !isMobile && setHoveredColIdx(di)}
                            onMouseLeave={() => setHoveredColIdx(null)}
                            style={{ gridColumn: di + 2, gridRow: spanSlots > 1 ? `${rowIdx} / span ${spanSlots}` : `${rowIdx}`, background: weekCellBg, transition: 'background 0.15s', borderBottom: `1px solid ${isHour ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.06)'}`, borderLeft: `1px solid ${today ? C.green + '55' : isCompanyClosure ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.12)'}`, borderRight: `1px solid ${today ? C.green + '55' : 'rgba(148,163,184,0.12)'}`, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: cita ? 'center' : 'flex-start', boxSizing: 'border-box' as const, overflow: 'visible', userSelect: 'none' }}
                          >
                            {moveDrag?.active && moveDrag.targetDayIdx === di && moveDrag.targetSlotIdx === si && (() => {
                              const ghostH = moveDrag.durSlots * WEEK_SLOT_H;
                              return (
                                <div style={{
                                  position: 'absolute', top: 0, left: 2, right: 2,
                                  height: ghostH,
                                  background: moveDrag.hasConflict ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                                  border: `2px dashed ${moveDrag.hasConflict ? C.red : C.green}`,
                                  borderRadius: 6, zIndex: 25, pointerEvents: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {moveDrag.durSlots >= 2 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: moveDrag.hasConflict ? C.red : C.green }}>
                                      {moveDrag.hasConflict ? 'Ocupado' : `${visibleSlots[moveDrag.targetSlotIdx]} – ${minutesToTime(timeToMinutes(visibleSlots[moveDrag.targetSlotIdx]) + moveDrag.durSlots * 30)}`}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {cita && (
                              <div
                                onClick={() => { if (!moveDrag) setSelectedCita(cita); }}
                                onMouseDown={e => handleCitaMouseDown(e, cita, si, di, day)}
                                onMouseEnter={() => handleCitaMouseEnter(cita.id)}
                                onMouseLeave={() => { setHoveredCitaId(null); }}
                                style={{ position: 'absolute', inset: 0, background: isCompletada(cita.estado) ? 'rgba(74,222,128,0.12)' : `${citaColor(cita.estado)}22`, borderLeft: `3px solid ${citaColor(cita.estado)}`, borderRadius: 8, padding: isMobile ? '4px 6px' : '6px 8px', cursor: isCompletada(cita.estado) ? 'pointer' : (isMobile ? 'pointer' : 'grab'), boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflow: 'hidden', opacity: moveDrag?.cita?.id === cita.id ? 0.3 : 1, transition: 'opacity 0.15s' }}>
                                {isCompletada(cita.estado) && (
                                  <div style={{ position: 'absolute', top: 3, right: 4, background: 'rgba(74,222,128,0.22)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 5, padding: '2px 6px' }}>
                                    <span style={{ fontSize: 9, color: '#4ADE80', fontWeight: 800 }}>✓</span>
                                  </div>
                                )}
                                {!isMobile && renderQuickActions(cita)}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                                  <p style={{ fontSize: isMobile ? 12 : 11, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, textTransform: 'uppercase' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, minWidth: 0 }}>
                                    {cita.clientes?.nombre || cita.cliente_nombre_libre || 'Cliente'}
                                    {cita.cliente_id && clientRiskCache[cita.cliente_id]?.show && <span style={{ marginLeft: 3, fontSize: 9 }}>{clientRiskCache[cita.cliente_id].icon}</span>}
                                  </p>
                                  {renderConfirmacionDot(cita, 6)}
                                </div>
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

                            {dragBlockStyle && (() => {
                              const spanCount = dragMaxIdx - dragMinIdx + 1;
                              const startLabel = visibleSlots[dragMinIdx];
                              const endM = timeToMinutes(visibleSlots[dragMaxIdx]) + 30;
                              const endLabel = minutesToTime(endM);
                              return (
                                <div style={dragBlockStyle}>
                                  {spanCount >= 2 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: drag?.hasConflict ? C.red : C.green }}>
                                      {startLabel} – {endLabel}
                                    </span>
                                  )}
                                  {drag?.hasConflict && (
                                    <span style={{ fontSize: 10, color: C.red }}>Ocupado</span>
                                  )}
                                </div>
                              );
                            })()}

                            {!cita && (
                              <div
                                style={{ position: 'absolute', inset: 0, cursor: working && !isMobile ? (isInDragRange ? 'ns-resize' : 'pointer') : 'default' }}
                                onMouseDown={e => { if (working && !isMobile) handleDragMouseDown(e, si, di, day); }}
                                onMouseEnter={e => {
                                  if (drag?.active) {
                                    handleDragMouseEnter(si, di, day);
                                  } else if (working && !isMobile) {
                                    (e.currentTarget as HTMLElement).style.background = C.greenBg;
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (!drag?.active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                }}
                                onMouseUp={e => { if (working && !isMobile) handleDragMouseUp(e, day); }}
                                onClick={() => {
                                  if (!drag && working) openModal(day, slot);
                                  else if (!working) setAnotacionModal({ open: true, date: day });
                                }}
                              />
                            )}
                            {isNowSlot && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}><div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, paddingRight: 3 }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F87171', boxShadow: '0 0 5px rgba(248,113,113,0.7)' }} /><span style={{ fontSize: 8, fontWeight: 700, color: '#F87171', letterSpacing: 0.3 }}>AHORA</span></div><div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #F87171 0%, rgba(248,113,113,0.1) 100%)', opacity: 0.9 }} /></div>}
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
            <div className="flex-1 overflow-y-auto" style={{ padding: isMobile ? '0 0 80px' : '0 0 80px', background: C.bg }}>
              {/* Cabecera navegación mes — solo desktop */}
              {!isMobile && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px 8px',
                  borderBottom: `1px solid rgba(148,163,184,0.07)`,
                  flexShrink: 0,
                }}>
                  <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text, textTransform: 'capitalize' as const, letterSpacing: 0.1 }}>
                    {formatMonth(selectedDate)}
                  </span>
                  <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Grid mes */}
              <div style={{ padding: isMobile ? '8px 6px' : '14px 20px', maxWidth: 1200, margin: '0 auto' }}>
                {/* Headers días semana */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 0 : 4, marginBottom: isMobile ? 4 : 8 }}>
                  {(isMobile ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : weekDayNames).map(d => (
                    <div key={d} style={{
                      textAlign: 'center',
                      fontSize: isMobile ? 10 : 10,
                      color: '#3D5068',
                      fontWeight: 700,
                      padding: isMobile ? '4px 0 8px' : '4px 0 10px',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase' as const,
                    }}>{d}</div>
                  ))}
                </div>
                {/* Celdas días */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 5 }}>
                  {getMonthDays().map((day, i) => {
                    if (!day) return <div key={`e${i}`} style={{ minHeight: isMobile ? 44 : 84 }} />;
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
                            padding: '7px 2px', borderRadius: 8, cursor: 'pointer', minHeight: 48,
                            background: today ? `${C.green}18` : 'transparent',
                            border: today ? `1.5px solid ${C.green}55` : '1.5px solid transparent',
                            opacity: working ? 1 : 0.3,
                          }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: today ? C.green : C.text, lineHeight: 1 }}>{day.getDate()}</span>
                          <div style={{ display: 'flex', gap: 3, marginTop: 5, minHeight: 5 }}>
                            {working && citasCount > 0 && <div style={{ width: 4, height: 4, borderRadius: '50%', background: av?.color || C.green }} />}
                            {working && citasCount > 2 && <div style={{ width: 4, height: 4, borderRadius: '50%', background: av?.color || C.green, opacity: 0.4 }} />}
                            {!working && dayAnotaciones.length > 0 && <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.yellow }} />}
                          </div>
                          {working && citasCount > 0 && <span style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{citasCount}</span>}
                        </div>
                      );
                    }

                    return (
                      <div key={i}
                        onClick={() => working ? goToDay(day) : setAnotacionModal({ open: true, date: day })}
                        style={{
                          background: today
                            ? 'rgba(34,197,94,0.08)'
                            : working
                            ? 'rgba(20,31,48,0.9)'
                            : 'rgba(11,16,26,0.5)',
                          borderRadius: 9,
                          padding: '10px 11px 9px',
                          minHeight: 84,
                          border: today
                            ? `1px solid rgba(34,197,94,0.4)`
                            : working
                            ? `1px solid rgba(148,163,184,0.12)`
                            : `1px solid rgba(148,163,184,0.05)`,
                          opacity: working ? 1 : 0.38,
                          display: 'flex', flexDirection: 'column',
                          cursor: 'pointer',
                          transition: 'background 0.12s, border-color 0.12s',
                        }}
                        onMouseEnter={e => {
                          if (working) (e.currentTarget as HTMLElement).style.background = today ? 'rgba(34,197,94,0.13)' : 'rgba(28,43,66,0.95)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = today ? 'rgba(34,197,94,0.08)' : working ? 'rgba(20,31,48,0.9)' : 'rgba(11,16,26,0.5)';
                        }}>
                        {/* Número del día */}
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: today ? C.green : working ? '#E2E8F0' : 'rgba(241,245,249,0.2)',
                          lineHeight: 1,
                        }}>{day.getDate()}</span>
                        {/* Métricas del día */}
                        {working && av && (
                          <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {/* Barra ocupación */}
                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(148,163,184,0.08)', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${totalSlots > 0 ? ((totalSlots - free) / totalSlots) * 100 : 0}%`,
                                borderRadius: 2, background: av.color,
                                transition: 'width 0.3s ease',
                              }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: av.color, display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ fontSize: 10, color: av.color, fontWeight: 600 }}>{av.label}</span>
                              </div>
                              {citasCount > 0 && (
                                <span style={{ fontSize: 10, color: '#4A5E74', fontWeight: 600 }}>
                                  {citasCount}c
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {!working && dayAnotaciones.length > 0 && (
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.yellow, display: 'inline-block' }} />
                            <span style={{ fontSize: 9, color: C.yellow }}>{dayAnotaciones.length}</span>
                          </div>
                        )}
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
          {selectedCita && (() => {
            // ── datos derivados para detalle ──
            const sc         = selectedCita;
            const nombreCl   = sc.clientes?.nombre || sc.cliente_nombre_libre || '—';
            const telCl      = sc.clientes?.telefono;
            const svcNombre  = sc.servicios?.nombre || sc.servicio_nombre_libre;
            const fechaObj   = sc.hora_inicio ? new Date(sc.hora_inicio) : null;
            const fechaFmt   = fechaObj
              ? fechaObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              : '—';
            const horaI      = sc.hora_inicio?.substring(11, 16) || '—';
            const horaF      = sc.hora_fin?.substring(11, 16)    || '—';
            const stColor    = citaColor(sc.estado);
            const stNombre   = citaEstadoNombre(sc.estado);
            const conf       = (sc.confirmacion_estado || 'pendiente').toLowerCase();
            const confMap: Record<string, { label: string; color: string; icon: string }> = {
              pendiente:     { label: 'Sin respuesta',    color: '#F59E0B', icon: '⏳' },
              confirmada:    { label: 'Confirmó asistencia', color: '#22C55E', icon: '✓' },
              no_confirmada: { label: 'No respondió',     color: '#EF4444', icon: '✗' },
              cancelada:     { label: 'Canceló por mensaje', color: '#94A3B8', icon: '–' },
            };
            const confCfg    = confMap[conf] || confMap['pendiente'];
            const risk       = sc.cliente_id ? clientRiskCache[sc.cliente_id] : null;
            const isCancelada = (sc.estado || '').toLowerCase() === 'cancelada';
            const divider    = <div style={{ height: 1, background: 'rgba(148,163,184,0.07)', margin: '2px 0' }} />;

            return (
              <div
                style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, background: 'rgba(0,0,0,0.72)' }}
                onClick={() => setSelectedCita(null)}
              >
                <div
                  style={{ background: C.surface, borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.55)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Cabecera */}
                  <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Nombre cliente */}
                        <p style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {nombreCl}
                        </p>
                        {telCl && (
                          <p style={{ fontSize: 12, color: C.textSec, margin: '2px 0 0' }}>{telCl}</p>
                        )}
                        {/* Fecha + franja */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>{fechaFmt}</span>
                          <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.3)' }}>·</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(148,163,184,0.07)', borderRadius: 6, padding: '2px 8px' }}>
                            <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{horaI}</span>
                            <span style={{ fontSize: 11, color: C.textSec }}>–</span>
                            <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>{horaF}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCita(null)}
                        style={{ background: 'rgba(148,163,184,0.07)', border: 'none', borderRadius: 8, cursor: 'pointer', color: C.textSec, padding: 7, display: 'flex', flexShrink: 0, marginLeft: 10 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.13)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.07)'; }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Servicio */}
                    {svcNombre && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const, flexShrink: 0, width: 64 }}>Servicio</span>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{svcNombre}</span>
                      </div>
                    )}

                    {divider}

                    {/* CAPA 1: Estado operativo */}
                    <div>
                      <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' as const, margin: '0 0 7px' }}>Estado de la cita</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: stColor + '18', border: `1px solid ${stColor}30`, borderRadius: 8, padding: '5px 11px' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: stColor, flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: stColor }}>{stNombre}</span>
                        </span>
                      </div>
                    </div>

                    {divider}

                    {/* CAPA 2: Respuesta del cliente por mensaje */}
                    <div>
                      <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' as const, margin: '0 0 7px' }}>Respuesta del cliente</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 13, color: confCfg.color, fontWeight: 600 }}>{confCfg.icon}</span>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{confCfg.label}</span>
                      </div>
                    </div>

                    {/* CAPA 3: Historial / comportamiento */}
                    {risk?.show && (
                      <>
                        {divider}
                        <div>
                          <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' as const, margin: '0 0 7px' }}>Historial</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: risk.color + '0D', border: `1px solid ${risk.color}28`, borderRadius: 8, padding: '7px 11px' }}>
                            {risk.icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{risk.icon}</span>}
                            <span style={{ fontSize: 12, fontWeight: 600, color: risk.color }}>Cliente con incidencias previas</span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Notas */}
                    {sc.notas && (
                      <>
                        {divider}
                        <div style={{ background: 'rgba(148,163,184,0.04)', borderRadius: 8, padding: '8px 11px', borderLeft: '2px solid rgba(148,163,184,0.15)' }}>
                          <p style={{ fontSize: 11, color: C.textSec, fontWeight: 600, margin: '0 0 3px', textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>Notas</p>
                          <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>{sc.notas}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer acciones */}
                  <div style={{ padding: '12px 20px 18px', borderTop: '1px solid rgba(148,163,184,0.07)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* CTA principal */}
                    <button
                      onClick={() => openEdit(selectedCita)}
                      style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: C.surfaceAlt, color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2D3F57'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
                    >
                      <Edit2 size={14} /> Editar cita
                    </button>
                    {/* Acción destructiva: menor peso */}
                    {!isCancelada && (
                      <button
                        onClick={() => cancelarCita(sc.id)}
                        style={{ width: '100%', padding: '9px', borderRadius: 10, border: `1px solid rgba(239,68,68,0.25)`, background: 'rgba(239,68,68,0.06)', color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
                      >
                        Cancelar cita
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── MODAL EDITAR CITA ── */}
          {editingCita && (() => {
            const ec        = editingCita;
            const nombreCl  = ec.clientes?.nombre || ec.cliente_nombre_libre || 'Cliente';
            const telCl     = ec.clientes?.telefono;
            const fechaObj  = ec.hora_inicio ? new Date(ec.hora_inicio) : null;
            const fechaFmt  = fechaObj
              ? fechaObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
              : null;

            // duracion calculada
            const durMin = (() => {
              if (!editHoraInicio || !editHoraFin || editHoraFin <= editHoraInicio) return null;
              const [h1, m1] = editHoraInicio.split(':').map(Number);
              const [h2, m2] = editHoraFin.split(':').map(Number);
              const d = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (d <= 0) return null;
              if (d < 60) return `${d}min`;
              const h = Math.floor(d / 60), m = d % 60;
              return m === 0 ? `${h}h` : `${h}h ${m}min`;
            })();

            const labelStyle: React.CSSProperties = {
              fontSize: 11, color: C.textSec, fontWeight: 700,
              letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 5,
            };
            const inputStyle: React.CSSProperties = {
              width: '100%', padding: '11px 14px',
              background: C.surfaceAlt, border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 10, color: C.text, fontSize: 14, outline: 'none',
              boxSizing: 'border-box', transition: 'border-color 0.15s', colorScheme: 'dark' as any,
            };

            return (
              <div
                style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, background: 'rgba(0,0,0,0.72)' }}
                onClick={() => setEditingCita(null)}
              >
                <div
                  style={{ background: C.surface, borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Cabecera */}
                  <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(148,163,184,0.07)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2 }}>Editar cita</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>{nombreCl}</span>
                          {telCl && <><span style={{ fontSize: 11, color: 'rgba(148,163,184,0.25)' }}>·</span><span style={{ fontSize: 12, color: C.textSec }}>{telCl}</span></>}
                          {fechaFmt && <><span style={{ fontSize: 11, color: 'rgba(148,163,184,0.25)' }}>·</span><span style={{ fontSize: 12, color: C.textSec }}>{fechaFmt}</span></>}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingCita(null)}
                        style={{ background: 'rgba(148,163,184,0.07)', border: 'none', borderRadius: 8, cursor: 'pointer', color: C.textSec, padding: 7, display: 'flex', flexShrink: 0, marginLeft: 10 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.13)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.07)'; }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo scrollable */}
                  <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Servicio */}
                    <div>
                      <label style={labelStyle}>Servicio</label>
                      <input
                        value={editServicio}
                        onChange={e => setEditServicio(e.target.value)}
                        placeholder="Nombre del servicio"
                        style={inputStyle}
                        onFocus={e => { e.currentTarget.style.borderColor = C.green; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
                      />
                    </div>

                    {/* Fecha */}
                    <div>
                      <label style={labelStyle}>Fecha</label>
                      <input
                        type="date"
                        value={editFecha}
                        onChange={e => setEditFecha(e.target.value)}
                        style={inputStyle}
                        onFocus={e => { e.currentTarget.style.borderColor = C.green; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
                      />
                    </div>

                    {/* Hora inicio + fin + duración */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Inicio</label>
                        <input
                          type="time"
                          value={editHoraInicio}
                          onChange={e => setEditHoraInicio(e.target.value)}
                          style={inputStyle}
                          onFocus={e => { e.currentTarget.style.borderColor = C.green; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
                        />
                      </div>
                      <div style={{ paddingBottom: 11, color: C.textSec, fontSize: 14, flexShrink: 0 }}>–</div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Fin</label>
                        <input
                          type="time"
                          value={editHoraFin}
                          onChange={e => setEditHoraFin(e.target.value)}
                          style={inputStyle}
                          onFocus={e => { e.currentTarget.style.borderColor = C.green; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
                        />
                      </div>
                      {durMin && (
                        <div style={{ paddingBottom: 10, flexShrink: 0 }}>
                          <div style={{ background: 'rgba(148,163,184,0.06)', borderRadius: 7, padding: '5px 9px' }}>
                            <span style={{ fontSize: 11, color: C.textSec, fontWeight: 500 }}>{durMin}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Separador */}
                    <div style={{ height: 1, background: 'rgba(148,163,184,0.07)' }} />

                    {/* Estado operativo — compacto */}
                    {estadosCita.length > 0 && (
                      <div>
                        <label style={{ ...labelStyle, marginBottom: 8 }}>Estado de la cita</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                          {estadosCita.map(estado => {
                            const nombre    = estado.nombre_personalizado || estado.nombre_defecto;
                            const nombreNorm = nombre.toLowerCase();
                            const sel       = editEstado.toLowerCase() === nombreNorm;
                            const col       = estado.color || C.textSec;
                            // Diferencia visual clara entre confirmada y completada
                            return (
                              <button
                                key={estado.id}
                                onClick={() => setEditEstado(nombreNorm)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '5px 11px',
                                  borderRadius: 8,
                                  border: sel ? `1px solid ${col}40` : '1px solid rgba(148,163,184,0.09)',
                                  background: sel ? col + '14' : 'rgba(148,163,184,0.04)',
                                  color: sel ? col : C.textSec,
                                  fontSize: 12, fontWeight: sel ? 700 : 400,
                                  cursor: 'pointer', transition: 'all 0.1s',
                                }}
                                onMouseEnter={e => { if (!sel) { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.18)'; } }}
                                onMouseLeave={e => { if (!sel) { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.09)'; } }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0, display: 'inline-block' }} />
                                {nombre}
                              </button>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', margin: '6px 0 0' }}>
                          No confundir con la respuesta al recordatorio
                        </p>
                      </div>
                    )}

                    {/* Notas */}
                    <div>
                      <label style={labelStyle}>Notas</label>
                      <textarea
                        value={editNotas}
                        onChange={e => setEditNotas(e.target.value)}
                        rows={2}
                        placeholder="Observaciones, preferencias..."
                        style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.5 }}
                        onFocus={e => { e.currentTarget.style.borderColor = C.green; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; }}
                      />
                    </div>

                  </div>

                  {/* Footer fijo */}
                  <div style={{ padding: '12px 20px 18px', borderTop: '1px solid rgba(148,163,184,0.07)', flexShrink: 0, background: C.surface, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={guardarEdicion}
                      disabled={editLoading}
                      style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: editLoading ? '#15803D' : C.green, color: '#fff', fontSize: 14, fontWeight: 700, cursor: editLoading ? 'not-allowed' : 'pointer', opacity: editLoading ? 0.75 : 1, transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (!editLoading) (e.currentTarget as HTMLElement).style.background = '#16A34A'; }}
                      onMouseLeave={e => { if (!editLoading) (e.currentTarget as HTMLElement).style.background = C.green; }}
                    >
                      {editLoading ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    {(ec.estado || '').toLowerCase() !== 'cancelada' && (
                      <button
                        onClick={() => cancelarCita(ec.id)}
                        style={{ width: '100%', padding: '9px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
                      >
                        Cancelar cita
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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

          {/* ── MODAL AVISO AUSENCIA ── */}
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

        {moveConflictMsg && (
          <div style={{
            position: 'fixed', bottom: isMobile ? 90 : 40, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(239,68,68,0.95)', color: '#fff', padding: '10px 20px',
            borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            ⚠️ {moveConflictMsg}
          </div>
        )}

        <NuevaCitaModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); loadAllCitas(); }}
          profesionalId={profesional?.id || ''}
          empresaId={empresa?.id || ''}
          selectedDate={preselectedDate || selectedDate}
          preselectedTime={preselectedTime}
          preselectedEndTime={preselectedEndTime}
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
          .main-content-desktop { margin-left: 0 !important; width: 100% !important; }
          .hidden-mobile { display: none !important; }
          .show-mobile-flex { display: flex !important; }
          .show-mobile-only { display: flex !important; }
        }
        ${moveDrag?.active ? 'body { cursor: grabbing !important; }' : ''}
        @keyframes agendaSlideLeft {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes agendaSlideRight {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes confirmPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
