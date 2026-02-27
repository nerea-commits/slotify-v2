'use client';

import { Calendar, Users, BarChart3, MoreHorizontal, Scissors, Bell, Settings, X } from 'lucide-react';
import { useState } from 'react';

interface BottomNavProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isAdmin: boolean;
}

const PRIMARY = [
  { id: 'agenda',       label: 'Agenda',      icon: Calendar  },
  { id: 'clientes',     label: 'Clientes',    icon: Users     },
  { id: 'estadisticas', label: 'Stats',       icon: BarChart3 },
  { id: 'mas',          label: 'Más',         icon: MoreHorizontal },
];

const MAS_ITEMS = [
  { id: 'servicios',      label: 'Servicios',      icon: Scissors },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell     },
  { id: 'configuracion',  label: 'Configuración',  icon: Settings },
];

export default function BottomNav({ activeSection, onNavigate, isAdmin }: BottomNavProps) {
  const [masOpen, setMasOpen] = useState(false);

  const isMasActive = MAS_ITEMS.some(i => i.id === activeSection);

  function handleTap(id: string) {
    if (id === 'mas') { setMasOpen(true); return; }
    setMasOpen(false);
    onNavigate(id);
  }

  return (
    <>
      {/* Más sheet */}
      {masOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49 }}
            onClick={() => setMasOpen(false)}
          />
          <div style={{
            position: 'fixed', bottom: 64, left: 0, right: 0,
            background: '#1E293B',
            borderRadius: '20px 20px 0 0',
            padding: '16px 16px 8px',
            zIndex: 50,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: 0.5 }}>MÁS OPCIONES</p>
              <button onClick={() => setMasOpen(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MAS_ITEMS.map(item => {
                const active = activeSection === item.id;
                return (
                  <button key={item.id} onClick={() => { onNavigate(item.id); setMasOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                      color: active ? '#22C55E' : '#94A3B8', fontWeight: active ? 700 : 500, fontSize: 14,
                    }}>
                    <item.icon size={18} style={{ color: active ? '#22C55E' : '#64748B' }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 64,
        background: '#111827',
        borderTop: '1px solid rgba(148,163,184,0.08)',
        display: 'flex', alignItems: 'center',
        zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
        className="show-mobile"
      >
        {PRIMARY.filter(item => item.id !== 'clientes' || isAdmin).map(item => {
          const active = item.id === 'mas' ? isMasActive || masOpen : activeSection === item.id;
          return (
            <button key={item.id} onClick={() => handleTap(item.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, height: '100%', border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: active ? '#22C55E' : '#4B5563',
              }}>
              <item.icon size={20} style={{ color: active ? '#22C55E' : '#4B5563' }} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <style>{`
        .show-mobile { display: none; }
        @media (max-width: 767px) {
          .show-mobile { display: flex !important; }
        }
      `}</style>
    </>
  );
}
