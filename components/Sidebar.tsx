'use client';

import { useState } from 'react';
import {
  Calendar, Users, Scissors, BarChart3, Bell, Settings,
  LogOut, UserCircle, ChevronLeft, ChevronRight, Palmtree, Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  empresaNombre: string;
  profesionalNombre: string;
  empresaLogo?: string;
  colorPrimario?: string;
  isAdmin: boolean;
  permisos?: Record<string, boolean>;
  onNavigate: (section: string) => void;
  activeSection: string;
  adminPin?: string | null;
  onCambiarPerfil?: () => void;
  profesionalFoto?: string;
  profesionalColor?: string;
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  empresaNombre,
  profesionalNombre,
  empresaLogo,
  colorPrimario,
  isAdmin,
  permisos = {},
  onNavigate,
  activeSection,
  adminPin,
  onCambiarPerfil,
  profesionalFoto,
  profesionalColor,
}: SidebarProps) {
  const accent = colorPrimario || '#22C55E';

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const navItems = [
    { id: 'agenda',     label: 'Agenda',      icon: Calendar  },
    { id: 'clientes',   label: 'Clientes',    icon: Users     },
    { id: 'servicios',  label: 'Servicios',   icon: Scissors  },
    { id: 'ausencias',  label: 'Ausencias',   icon: Palmtree  },
    ...(isAdmin || permisos.ver_estadisticas
      ? [{ id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 }]
      : []),
  ];

  const sysItems = [
    ...(isAdmin ? [{ id: 'notificaciones', label: 'Notificaciones', icon: Bell }] : []),
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  function logout() {
    supabase.auth.signOut().then(() => {
      localStorage.removeItem('slotify_profesional_id');
      localStorage.removeItem('slotify_empresa_id');
      localStorage.removeItem('slotify_rol');
      window.location.href = '/login';
    });
  }

  function doChangeProfile() {
    if (onCambiarPerfil) onCambiarPerfil();
  }

  function handleChangeProfile() {
    if (isAdmin) { doChangeProfile(); return; }
    if (adminPin) {
      setPinInput(''); setPinError(''); setShowPinModal(true); return;
    }
    doChangeProfile();
  }

  function handlePinSubmit() {
    if (pinInput === adminPin) {
      setShowPinModal(false);
      doChangeProfile();
    } else {
      setPinError('PIN incorrecto');
      setPinInput('');
    }
  }

  function renderNav(id: string, label: string, Icon: any) {
    const active = activeSection === id;
    return (
      <button
        key={id}
        onClick={() => onNavigate(id)}
        title={collapsed ? label : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '10px 0' : '9px 12px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          background: active ? (accent + '18') : 'transparent',
          color: active ? accent : '#94A3B8',
          fontWeight: active ? 600 : 400,
          fontSize: 13.5,
          textAlign: 'left' as const,
          transition: 'all 0.12s',
          borderLeft: active ? ('3px solid ' + accent) : '3px solid transparent',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)';
        }}
        onMouseLeave={e => {
          if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <Icon
          size={17}
          style={{
            flexShrink: 0,
            color: active ? accent : '#64748B',
            strokeWidth: active ? 2.5 : 1.8,
          }}
        />
        {/* Label con fade-in al expandir */}
        <span
          style={{
            opacity: collapsed ? 0 : 1,
            maxWidth: collapsed ? 0 : 200,
            overflow: 'hidden',
            whiteSpace: 'nowrap' as const,
            transition: 'opacity 0.2s ease, max-width 0.2s ease',
            letterSpacing: 0.1,
            display: 'block',
          }}
        >
          {label}
        </span>
      </button>
    );
  }

  // Avatar del profesional
  const avatarBg = profesionalColor || accent;
  const avatarInitial = profesionalNombre?.[0]?.toUpperCase() || '?';

  return (
    <>
      <aside
        className="hidden-mobile"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: collapsed ? 56 : 240,
          background: '#0F172A',
          borderRight: '1px solid rgba(148,163,184,0.07)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
      >

        {/* ── ZONA SUPERIOR: Logo + nombre empresa ── */}
        <div
          style={{
            flexShrink: 0,
            padding: collapsed ? '20px 0 16px' : '28px 16px 20px',
            borderBottom: '1px solid rgba(148,163,184,0.07)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            transition: 'padding 0.3s ease',
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: collapsed ? 34 : 88,
              height: collapsed ? 34 : 88,
              borderRadius: collapsed ? 10 : 20,
              flexShrink: 0,
              background: empresaLogo
                ? '#0F172A'
                : `linear-gradient(135deg, ${accent} 0%, ${accent}bb 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: collapsed ? 14 : 36,
              fontWeight: 800,
              color: '#fff',
              overflow: 'hidden',
              boxShadow: `0 2px 16px ${accent}44`,
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {empresaLogo ? (
              <img
                src={empresaLogo}
                alt="logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              empresaNombre?.[0]?.toUpperCase() || 'S'
            )}
          </div>

          {/* Nombre empresa — desaparece al colapsar */}
          <div
            style={{
              overflow: 'hidden',
              maxHeight: collapsed ? 0 : 48,
              opacity: collapsed ? 0 : 1,
              transition: 'max-height 0.3s ease, opacity 0.25s ease',
              textAlign: 'center',
              width: '100%',
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#F1F5F9',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
                paddingBottom: 2,
              }}
            >
              {empresaNombre || 'Mi negocio'}
            </p>
          </div>
        </div>

        {/* ── ZONA MEDIA: Navegación ── */}
        <nav
          style={{
            flex: 1,
            minHeight: 0,
            padding: collapsed ? '10px 4px' : '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            overflowY: 'auto',
          }}
        >
          {navItems.map(i => renderNav(i.id, i.label, i.icon))}

          {sysItems.length > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(148,163,184,0.07)', margin: '8px 0' }} />
              {sysItems.map(i => renderNav(i.id, i.label, i.icon))}
            </>
          )}
        </nav>

        {/* ── ZONA INFERIOR: Perfil + acciones + colapsar ── */}
        <div
          style={{
            borderTop: '1px solid rgba(148,163,184,0.08)',
            flexShrink: 0,
            background: '#0B1120',
            padding: collapsed ? '12px 0 8px' : '12px 12px 8px',
          }}
        >
          {/* Perfil del usuario — expandido */}
          {!collapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
                padding: '2px 0',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: profesionalFoto ? 'transparent' : avatarBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#fff',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: `0 0 0 2px ${accent}33`,
                }}
              >
                {profesionalFoto ? (
                  <img
                    src={profesionalFoto}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  avatarInitial
                )}
              </div>

              {/* Nombre + rol */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#CBD5E1',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {profesionalNombre || 'Usuario'}
                </p>
                <p
                  style={{
                    fontSize: 10,
                    color: accent,
                    fontWeight: 600,
                    letterSpacing: 0.2,
                    marginTop: 2,
                    opacity: 0.9,
                    margin: '2px 0 0',
                  }}
                >
                  {isAdmin ? 'Admin' : 'Empleado'}
                </p>
              </div>
            </div>
          )}

          {/* Avatar solo — colapsado */}
          {collapsed && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: profesionalFoto ? 'transparent' : avatarBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#fff',
                  overflow: 'hidden',
                  boxShadow: `0 0 0 2px ${accent}33`,
                }}
              >
                {profesionalFoto ? (
                  <img
                    src={profesionalFoto}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  avatarInitial
                )}
              </div>
            </div>
          )}

          {/* Botón: Cambiar perfil */}
          <button
            onClick={handleChangeProfile}
            title="Cambiar perfil"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px 0' : '7px 8px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: '#64748B',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 7,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B'; }}
          >
            <UserCircle size={15} style={{ flexShrink: 0 }} />
            <span
              style={{
                opacity: collapsed ? 0 : 1,
                maxWidth: collapsed ? 0 : 200,
                overflow: 'hidden',
                whiteSpace: 'nowrap' as const,
                transition: 'opacity 0.2s ease, max-width 0.2s ease',
                display: 'block',
              }}
            >
              Cambiar perfil
            </span>
          </button>

          {/* Botón: Cerrar sesión */}
          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px 0' : '7px 8px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: '#475569',
              fontSize: 12,
              fontWeight: 400,
              borderRadius: 7,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#475569'; }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            <span
              style={{
                opacity: collapsed ? 0 : 1,
                maxWidth: collapsed ? 0 : 200,
                overflow: 'hidden',
                whiteSpace: 'nowrap' as const,
                transition: 'opacity 0.2s ease, max-width 0.2s ease',
                display: 'block',
              }}
            >
              Cerrar sesión
            </span>
          </button>

          {/* Separador */}
          <div style={{ height: 1, background: 'rgba(148,163,184,0.07)', margin: '6px 0' }} />

          {/* Botón: Colapsar / Expandir */}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir' : 'Contraer'}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 0',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: '#475569',
              fontSize: 13,
              borderRadius: 7,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)';
              (e.currentTarget as HTMLElement).style.color = '#94A3B8';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#475569';
            }}
          >
            {collapsed
              ? <ChevronRight size={16} style={{ flexShrink: 0 }} />
              : <ChevronLeft size={16} style={{ flexShrink: 0 }} />
            }
          </button>
        </div>
      </aside>

      {/* ── MODAL PIN ADMIN ── */}
      {showPinModal && (
        <div
          onClick={() => setShowPinModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111827',
              borderRadius: 16,
              padding: '28px 24px',
              width: 320,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              border: '1px solid rgba(148,163,184,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(245,158,11,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lock size={20} style={{ color: '#F59E0B' }} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
                Acceso restringido
              </p>
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                Introduce el PIN del administrador para cambiar de perfil
              </p>
            </div>

            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
              autoFocus
              placeholder="····"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#1A2332',
                border: `1px solid ${pinError ? '#EF4444' : 'rgba(148,163,184,0.12)'}`,
                borderRadius: 10,
                color: '#F1F5F9',
                fontSize: 22,
                textAlign: 'center',
                letterSpacing: 8,
                outline: 'none',
                boxSizing: 'border-box' as const,
                transition: 'border-color 0.15s',
              }}
            />
            {pinError && (
              <p style={{ fontSize: 12, color: '#EF4444', margin: '-8px 0 0', fontWeight: 600 }}>
                {pinError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button
                onClick={() => setShowPinModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.12)',
                  background: 'transparent',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handlePinSubmit}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: accent,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
