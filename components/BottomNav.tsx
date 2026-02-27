'use client';

import { useState } from 'react';
import { Calendar, Users, BarChart3, MoreHorizontal, Scissors, Bell, Settings, X, LogOut, UserCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface BottomNavProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isAdmin: boolean;
}

const MAS_ITEMS = [
  { id: 'servicios',      label: 'Servicios',      icon: Scissors  },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell      },
  { id: 'configuracion',  label: 'Configuración',  icon: Settings  },
];

export default function BottomNav({ activeSection, onNavigate, isAdmin }: BottomNavProps) {
  const [masOpen, setMasOpen] = useState(false);
  const isMasSection = MAS_ITEMS.some(i => i.id === activeSection);

  function logout() {
    supabase.auth.signOut().then(() => {
      localStorage.removeItem('slotify_profesional_id');
      localStorage.removeItem('slotify_empresa_id');
      localStorage.removeItem('slotify_rol');
      window.location.href = '/login';
    });
  }

  const PRIMARY = [
    { id: 'agenda',       label: 'Agenda',    icon: Calendar  },
    { id: 'clientes',     label: 'Clientes',  icon: Users,    adminOnly: true },
    { id: 'estadisticas', label: 'Stats',     icon: BarChart3, adminOnly: true },
    { id: 'mas',          label: 'Más',       icon: MoreHorizontal },
  ].filter((i: any) => !i.adminOnly || isAdmin);

  return (
    <>
      {/* Sheet overlay */}
      {masOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 48 }}
          onClick={() => setMasOpen(false)}
        />
      )}

      {/* Bottom sheet "Más" */}
      <div style={{
        position: 'fixed',
        bottom: masOpen ? 64 : '-100%',
        left: 0, right: 0,
        background: '#1E293B',
        borderRadius: '20px 20px 0 0',
        padding: '0 0 8px',
        zIndex: 49,
        transition: 'bottom 0.28s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.2)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase' }}>Más opciones</p>
          <button onClick={() => setMasOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {MAS_ITEMS.filter(() => isAdmin).map(item => {
          const active = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => { onNavigate(item.id); setMasOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 20px', border: 'none', cursor: 'pointer',
                background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
                borderLeft: active ? '3px solid #22C55E' : '3px solid transparent',
                color: active ? '#22C55E' : '#94A3B8', fontSize: 15, fontWeight: active ? 600 : 400,
              }}>
              <Icon size={19} style={{ color: active ? '#22C55E' : '#64748B' }} />
              {item.label}
            </button>
          );
        })}

        <div style={{ height: 1, background: 'rgba(148,163,184,0.07)', margin: '8px 0' }} />

        <button onClick={logout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 15, fontWeight: 400, borderLeft: '3px solid transparent' }}>
          <LogOut size={19} />
          Cerrar sesión
        </button>
      </div>

      {/* Bottom bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 64,
        background: '#0F172A',
        borderTop: '1px solid rgba(148,163,184,0.08)',
        display: 'flex', alignItems: 'stretch',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {PRIMARY.map(item => {
          const active = item.id === 'mas' ? (isMasSection || masOpen) : activeSection === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id}
              onClick={() => item.id === 'mas' ? setMasOpen(o => !o) : (onNavigate(item.id), setMasOpen(false))}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, border: 'none', cursor: 'pointer', background: 'transparent',
                color: active ? '#22C55E' : '#475569',
                borderTop: active ? '2px solid #22C55E' : '2px solid transparent',
                transition: 'all 0.12s',
              }}>
              <Icon size={21} style={{ color: active ? '#22C55E' : '#475569', strokeWidth: active ? 2.5 : 1.8 }} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
