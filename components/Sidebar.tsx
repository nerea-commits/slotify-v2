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
  const sysItems = SYSTEM_ITEMS.filter(() => isAdmin);

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

  function renderItem(id: string, label: string, Icon: any) {
    const active = activeSection === id;
    return (
      <button key={id}
        onClick={() => onNavigate(id)}
        title={collapsed ? label : undefined}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 12,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '11px 0' : '10px 12px',
          borderRadius: 8, border: 'none', cursor: 'pointer',
          background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
          color: active ? accent : '#94A3B8',
          fontWeight: active ? 600 : 400, fontSize: 13.5,
          textAlign: 'left' as const, transition: 'all 0.12s',
          borderLeft: active ? '3px solid #22C55E' : '3px solid transparent',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <Icon size={17} style={{ flexShrink: 0, color: active ? accent : '#64748B', strokeWidth: active ? 2.5 : 1.8 }} />
        {!collapsed && <span style={{ letterSpacing: 0.1 }}>{label}</span>}
      </button>
    );
  }

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: collapsed ? 56 : 240,
      background: '#0F172A',
      borderRight: '1px solid rgba(148,163,184,0.07)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* ── EMPRESA ── */}
      <div style={{
        padding: collapsed ? '20px 0 16px' : '20px 16px 16px',
        borderBottom: '1px solid rgba(148,163,184,0.07)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: empresaLogo ? 'transparent' : `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
            boxShadow: `0 2px 8px ${accent}55`,
            overflow: 'hidden',
          }}>
            {empresaLogo
              ? <img src={empresaLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
              : (empresaNombre?.[0]?.toUpperCase() || 'S')
            }
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                {empresaNombre || 'Mi negocio'}
              </p>
              <p style={{ fontSize: 11, color: accent, fontWeight: 600, letterSpacing: 0.4, marginTop: 1 }}>
                {profesionalNombre || 'Slotify'}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={onToggleCollapse} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 4, borderRadius: 5, display: 'flex', flexShrink: 0 }}>
            <ChevronLeft size={15} />
          </button>
        )}
        {collapsed && (
          <button onClick={onToggleCollapse} style={{ position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)', background: '#1E293B', border: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer', color: '#475569', padding: '2px 6px', borderRadius: '0 0 6px 6px', display: 'flex', zIndex: 1 }}>
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* ── NAV ── */}
      <nav style={{ flex: 1, padding: collapsed ? '12px 4px' : '12px 10px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {!collapsed && <p style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: 1.2, padding: '4px 12px 6px', textTransform: 'uppercase' }}>Navegación</p>}
        {navItems.map(i => renderItem(i.id, i.label, i.icon))}

        {sysItems.length > 0 && (
          <>
            <div style={{ height: 1, background: 'rgba(148,163,184,0.07)', margin: collapsed ? '8px 4px' : '8px 0' }} />
            {!collapsed && <p style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: 1.2, padding: '4px 12px 6px', textTransform: 'uppercase' }}>Sistema</p>}
            {sysItems.map(i => renderItem(i.id, i.label, i.icon))}
          </>
        )}
      </nav>

      {/* ── BOTTOM ── */}
      <div style={{ padding: collapsed ? '10px 4px' : '10px 10px', borderTop: '1px solid rgba(148,163,184,0.07)', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button onClick={changeProfile} title={collapsed ? 'Cambiar perfil' : undefined}
          style={{ width:'100%', display:'flex', alignItems:'center', gap: collapsed ? 0 : 12, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '11px 0' : '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748B', fontSize: 13, fontWeight: 400, borderLeft: '3px solid transparent' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <UserCircle size={16} style={{ flexShrink: 0, color: '#475569' }} />
          {!collapsed && <span>Cambiar perfil</span>}
        </button>
        <button onClick={logout} title={collapsed ? 'Cerrar sesión' : undefined}
          style={{ width:'100%', display:'flex', alignItems:'center', gap: collapsed ? 0 : 12, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '11px 0' : '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 13, fontWeight: 400, borderLeft: '3px solid transparent' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
