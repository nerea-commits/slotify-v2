'use client';
import { Calendar, Users, Scissors, BarChart3, Settings, Bell, ChevronLeft, ChevronRight, UserCircle, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  empresaNombre: string;
  profesionalNombre?: string;
  isAdmin: boolean;
  onNavigate: (section: string) => void;
  activeSection: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_ITEMS = [
  { id: 'agenda', label: 'Agenda', icon: Calendar, section: 'nav', adminOnly: false },
  { id: 'clientes', label: 'Clientes', icon: Users, section: 'nav', adminOnly: true },
  { id: 'servicios', label: 'Servicios', icon: Scissors, section: 'nav', adminOnly: true },
  { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3, section: 'nav', adminOnly: true },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, section: 'sys', adminOnly: true },
  { id: 'configuracion', label: 'Configuración', icon: Settings, section: 'sys', adminOnly: true },
];

export default function Sidebar({ empresaNombre, profesionalNombre, isAdmin, onNavigate, activeSection, collapsed, onToggleCollapse }: SidebarProps) {
  const visible = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin);
  const navItems = visible.filter(i => i.section === 'nav');
  const sysItems = visible.filter(i => i.section === 'sys');

  function handleLogout() {
    supabase.auth.signOut().then(() => {
      localStorage.removeItem('slotify_profesional_id');
      localStorage.removeItem('slotify_empresa_id');
      localStorage.removeItem('slotify_rol');
      window.location.href = '/login';
    });
  }

  function handleChangeProfile() {
    localStorage.removeItem('slotify_profesional_id');
    localStorage.removeItem('slotify_rol');
    window.location.href = '/login';
  }

  const W = collapsed ? 56 : 240;

  return (
    <aside
      style={{
        width: W,
        minWidth: W,
        height: '100vh',
        background: '#0F172A',
        borderRight: '1px solid rgba(148,163,184,0.1)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      {/* Logo + empresa */}
      <div style={{ padding: collapsed ? '20px 8px' : '24px 20px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#10B981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: 14, flexShrink: 0,
          }}>
            {empresaNombre?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>{empresaNombre}</div>
              {profesionalNombre && <div style={{ color: '#64748B', fontSize: 12, whiteSpace: 'nowrap' }}>{profesionalNombre}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        style={{
          position: 'absolute', top: 28, right: -12,
          width: 24, height: 24, borderRadius: 12,
          background: '#1E293B', border: '1px solid rgba(148,163,184,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 50, color: '#94A3B8',
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation items */}
      <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto', paddingBottom: 120 }}>
        {!collapsed && (
          <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B', letterSpacing: 1.2, padding: '0 12px 8px', textTransform: 'uppercase' }}>
            Navegación
          </div>
        )}
        {navItems.map(item => {
          const active = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 2,
                background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
                borderLeft: active ? '3px solid #10B981' : '3px solid transparent',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.08)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon size={18} color={active ? '#10B981' : '#94A3B8'} strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed && (
                <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#10B981' : '#CBD5E1', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}

        {sysItems.length > 0 && (
          <>
            <div style={{ height: 16 }} />
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B', letterSpacing: 1.2, padding: '0 12px 8px', textTransform: 'uppercase' }}>
                Sistema
              </div>
            )}
            {sysItems.map(item => {
              const active = activeSection === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: collapsed ? '10px 0' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: 2,
                    background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
                    borderLeft: active ? '3px solid #10B981' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.08)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Icon size={18} color={active ? '#10B981' : '#94A3B8'} strokeWidth={active ? 2.2 : 1.8} />
                  {!collapsed && (
                    <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#10B981' : '#CBD5E1', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom section - Cambiar perfil + Cerrar sesión */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid rgba(148,163,184,0.08)',
        marginBottom: 80,
      }}>
        <button
          onClick={handleChangeProfile}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: collapsed ? '10px 0' : '10px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <UserCircle size={18} color="#94A3B8" />
          {!collapsed && <span style={{ fontSize: 14, color: '#CBD5E1', whiteSpace: 'nowrap' }}>Cambiar perfil</span>}
        </button>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: collapsed ? '10px 0' : '10px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <LogOut size={18} color="#EF4444" />
          {!collapsed && <span style={{ fontSize: 14, color: '#EF4444', whiteSpace: 'nowrap' }}>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
