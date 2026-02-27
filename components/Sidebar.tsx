'use client';

import { Calendar, Users, Scissors, BarChart3, Settings, LogOut, UserCircle, Bell, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const MENU_ITEMS = [
  { id: 'agenda',         label: 'Agenda',          icon: Calendar,   adminOnly: false },
  { id: 'clientes',       label: 'Clientes',         icon: Users,      adminOnly: true  },
  { id: 'servicios',      label: 'Servicios',        icon: Scissors,   adminOnly: true  },
  { id: 'estadisticas',   label: 'Estadísticas',     icon: BarChart3,  adminOnly: true  },
  { id: 'notificaciones', label: 'Notificaciones',   icon: Bell,       adminOnly: true  },
  { id: 'configuracion',  label: 'Configuración',    icon: Settings,   adminOnly: true  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  empresaNombre: string;
  isAdmin: boolean;
  onNavigate: (section: string) => void;
  activeSection: string;
}

export default function Sidebar({
  open, onClose, collapsed, onToggleCollapse,
  empresaNombre, isAdmin, onNavigate, activeSection,
}: SidebarProps) {

  const items = MENU_ITEMS.filter(item => !item.adminOnly || isAdmin);

  function handleLogout() {
    if (typeof window === 'undefined') return;
    supabase.auth.signOut().then(() => {
      localStorage.removeItem('slotify_profesional_id');
      localStorage.removeItem('slotify_empresa_id');
      localStorage.removeItem('slotify_rol');
      window.location.href = '/login';
    });
  }

  function handleChangeProfile() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('slotify_profesional_id');
    localStorage.removeItem('slotify_rol');
    window.location.href = '/login';
  }

  // ── shared nav item ──
  function NavItem({ id, label, Icon }: { id: string; label: string; Icon: any }) {
    const active = activeSection === id;
    return (
      <button
        onClick={() => { onNavigate(id); onClose(); }}
        title={collapsed ? label : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '10px 0' : '10px 14px',
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
          color: active ? '#22C55E' : '#94A3B8',
          fontWeight: active ? 700 : 500,
          fontSize: 13,
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.07)'; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <Icon size={16} style={{ flexShrink: 0, color: active ? '#22C55E' : '#64748B' }} />
        {!collapsed && <span>{label}</span>}
        {active && !collapsed && (
          <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
        )}
      </button>
    );
  }

  // ── MOBILE OVERLAY DRAWER (legacy, still used on very small screens) ──
  // On mobile we rely on BottomNav; this drawer is only for edge cases
  const drawerVisible = open; // keep for potential usage

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: collapsed ? 56 : 220,
          background: '#111827',
          borderRight: '1px solid rgba(148,163,184,0.08)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 30,
          transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
        className="hidden-mobile" // hide on mobile via CSS
      >
        {/* Logo / empresa */}
        <div style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          borderBottom: '1px solid rgba(148,163,184,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10,
          flexShrink: 0,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {empresaNombre?.[0]?.toUpperCase() || 'S'}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {empresaNombre || 'Mi negocio'}
                </p>
                <p style={{ fontSize: 10, color: '#22C55E', fontWeight: 600, letterSpacing: 0.5 }}>SLOTIFY</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 800, color: '#fff',
            }}>
              {empresaNombre?.[0]?.toUpperCase() || 'S'}
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4B5563', padding: 4, display: 'flex', flexShrink: 0,
              borderRadius: 6,
            }}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: collapsed ? '12px 4px' : '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {items.map(item => (
            <NavItem key={item.id} id={item.id} label={item.label} Icon={item.icon} />
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{
          padding: collapsed ? '12px 4px' : '12px 10px',
          borderTop: '1px solid rgba(148,163,184,0.08)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <button
            onClick={handleChangeProfile}
            title={collapsed ? 'Cambiar perfil' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '10px 0' : '10px 14px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#94A3B8', fontSize: 13, fontWeight: 500,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.07)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <UserCircle size={16} style={{ flexShrink: 0, color: '#64748B' }} />
            {!collapsed && <span>Cambiar perfil</span>}
          </button>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '10px 0' : '10px 14px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#EF4444', fontSize: 13, fontWeight: 500,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── CSS for show/hide ── */}
      <style>{`
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}
