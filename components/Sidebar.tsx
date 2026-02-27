'use client';

import { Calendar, Users, Scissors, BarChart3, Settings, LogOut, UserCircle, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const MENU_ITEMS = [
  { id: 'agenda',         label: 'Agenda',        icon: Calendar,  adminOnly: false },
  { id: 'clientes',       label: 'Clientes',       icon: Users,     adminOnly: true  },
  { id: 'servicios',      label: 'Servicios',      icon: Scissors,  adminOnly: true  },
  { id: 'estadisticas',   label: 'Estadísticas',   icon: BarChart3, adminOnly: true  },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell,      adminOnly: true  },
  { id: 'configuracion',  label: 'Configuración',  icon: Settings,  adminOnly: true  },
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

  return (
    <>
      <aside style={{
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
      }}>

        {/* Logo */}
        <div style={{
          padding: collapsed ? '16px 0' : '16px 14px',
          borderBottom: '1px solid rgba(148,163,184,0.08)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: collapsed ? 'unset' as any : 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {empresaNombre?.[0]?.toUpperCase() || 'S'}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {empresaNombre || 'Mi negocio'}
                </p>
                <p style={{ fontSize: 10, color: '#22C55E', fontWeight: 600, letterSpacing: 0.5 }}>SLOTIFY</p>
              </div>
            )}
          </div>
          <button onClick={onToggleCollapse} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#4B5563', padding: 4, display: 'flex', flexShrink: 0, borderRadius: 6,
          }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: collapsed ? '10px 4px' : '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {items.map(item => {
            const active = activeSection === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id}
                onClick={() => { onNavigate(item.id); onClose(); }}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '10px 0' : '10px 14px',
                  borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                  color: active ? '#22C55E' : '#94A3B8',
                  fontWeight: active ? 700 : 500, fontSize: 13,
                  whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.07)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon size={16} style={{ flexShrink: 0, color: active ? '#22C55E' : '#64748B' }} />
                {!collapsed && <span>{item.label}</span>}
                {active && !collapsed && (
                  <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: collapsed ? '10px 4px' : '10px 8px', borderTop: '1px solid rgba(148,163,184,0.08)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { label: 'Cambiar perfil', icon: UserCircle, onClick: handleChangeProfile, color: '#94A3B8', hover: 'rgba(148,163,184,0.07)' },
            { label: 'Cerrar sesión',  icon: LogOut,     onClick: handleLogout,         color: '#EF4444', hover: 'rgba(239,68,68,0.08)' },
          ].map(btn => {
            const Icon = btn.icon;
            return (
              <button key={btn.label} onClick={btn.onClick} title={collapsed ? btn.label : undefined}
                style={{ width:'100%', display:'flex', alignItems:'center', gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: btn.color, fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = btn.hover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{btn.label}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      <style>{`
        @media (max-width: 767px) {
          aside { display: none !important; }
        }
      `}</style>
    </>
  );
}
