'use client';

import { Calendar, Users, Scissors, BarChart3, Bell, Settings, LogOut, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const NAV_ITEMS = [
  { id: 'agenda',       label: 'Agenda',        icon: Calendar  },
  { id: 'clientes',     label: 'Clientes',       icon: Users     },
  { id: 'servicios',    label: 'Servicios',      icon: Scissors  },
  { id: 'estadisticas', label: 'Estadísticas',   icon: BarChart3 },
];

const SYSTEM_ITEMS = [
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell     },
  { id: 'configuracion',  label: 'Configuración',  icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  empresaNombre: string;
  profesionalNombre: string;
  empresaLogo?: string;
  colorPrimario?: string;
  isAdmin: boolean;
  onNavigate: (section: string) => void;
  activeSection: string;
}

export default function Sidebar({
  collapsed, onToggleCollapse,
  empresaNombre, profesionalNombre, empresaLogo, colorPrimario,
  isAdmin, onNavigate, activeSection,
}: SidebarProps) {
  const accent = colorPrimario || '#22C55E';

  const navItems = NAV_ITEMS.filter(i => i.id === 'agenda' || isAdmin);
  const sysItems = isAdmin ? SYSTEM_ITEMS : [];

  function logout() {
    supabase.auth.signOut().then(() => {
      localStorage.removeItem('slotify_profesional_id');
      localStorage.removeItem('slotify_empresa_id');
      localStorage.removeItem('slotify_rol');
      window.location.href = '/login';
    });
  }

  function changeProfile() {
    localStorage.removeItem('slotify_profesional_id');
    localStorage.removeItem('slotify_rol');
    window.location.href = '/login';
  }

  function renderNav(id: string, label: string, Icon: any) {
    const active = activeSection === id;
    return (
      <button key={id} onClick={() => onNavigate(id)} title={label}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 10, justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '10px 0' : '9px 12px',
          borderRadius: 8, border: 'none', cursor: 'pointer',
          background: active ? (accent + '18') : 'transparent',
          color: active ? accent : '#94A3B8',
          fontWeight: active ? 600 : 400, fontSize: 13.5,
          textAlign: 'left' as const, transition: 'all 0.12s',
          borderLeft: active ? ('3px solid ' + accent) : '3px solid transparent',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <Icon size={17} style={{ flexShrink: 0, color: active ? accent : '#64748B', strokeWidth: active ? 2.5 : 1.8 }} />
        {!collapsed && <span style={{ letterSpacing: 0.1 }}>{label}</span>}
      </button>
    );
  }

  const sidebarW = collapsed ? 56 : 240;

  return (
    <>
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: sidebarW,
      background: '#0F172A',
      borderRight: '1px solid rgba(148,163,184,0.07)',
      display: 'flex', flexDirection: 'column',
      zIndex: 40,
      transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* HEADER */}
      <div style={{
        height: 72, padding: '0 12px', flexShrink: 0,
        borderBottom: '1px solid rgba(148,163,184,0.07)',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: empresaLogo ? '#0F172A' : ('linear-gradient(135deg, ' + accent + ' 0%, ' + accent + 'bb 100%)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: '#fff',
            overflow: 'hidden', boxShadow: '0 2px 12px ' + accent + '55',
          }}>
            {empresaLogo
              ? <img src={empresaLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : (empresaNombre?.[0]?.toUpperCase() || 'S')
            }
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                {empresaNombre || 'Mi negocio'}
              </p>
              <p style={{ fontSize: 11, color: accent, fontWeight: 600, letterSpacing: 0.3, marginTop: 2 }}>
                {profesionalNombre || ''}
              </p>
            </div>
          )}
        </div>


      </div>

      {/* NAV */}
      <nav style={{ flex: 1, minHeight: 0, padding: collapsed ? '10px 4px' : '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {!collapsed && <p style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: 1.2, padding: '4px 12px 6px', textTransform: 'uppercase' as const }}>Navegación</p>}
        {navItems.map(i => renderNav(i.id, i.label, i.icon))}
        {sysItems.length > 0 && <>
          <div style={{ height: 1, background: 'rgba(148,163,184,0.07)', margin: '8px 0' }} />
          {!collapsed && <p style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: 1.2, padding: '4px 12px 6px', textTransform: 'uppercase' as const }}>Sistema</p>}
          {sysItems.map(i => renderNav(i.id, i.label, i.icon))}
        </>}
      </nav>

      {/* BOTTOM — siempre visible */}
      <div style={{ padding: collapsed ? '8px 4px 16px' : '8px 8px 16px', borderTop: '1px solid rgba(148,163,184,0.07)', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0, background: '#0F172A' }}>
        <button onClick={changeProfile} title="Cambiar perfil"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748B', fontSize: 13 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <UserCircle size={16} style={{ flexShrink: 0, color: '#64748B' }} />
          {!collapsed && <span>Cambiar perfil</span>}
        </button>
        <button onClick={logout} title="Cerrar sesión"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 13 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <LogOut size={16} style={{ flexShrink: 0, color: '#EF4444' }} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

    </aside>

    {/* Toggle button — outside aside so it protrudes */}
    <button onClick={onToggleCollapse}
      style={{
        position: 'fixed',
        top: 36,
        left: sidebarW - 12,
        width: 24, height: 24,
        borderRadius: '50%',
        background: '#1E293B',
        border: '2px solid rgba(148,163,184,0.2)',
        cursor: 'pointer',
        color: '#64748B',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 41,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; (e.currentTarget as HTMLElement).style.background = '#334155'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748B'; (e.currentTarget as HTMLElement).style.background = '#1E293B'; }}
    >
      {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
    </button>
    </>
  );
}
