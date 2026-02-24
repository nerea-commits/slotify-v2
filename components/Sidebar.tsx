'use client';

import { X, Calendar, Users, Scissors, BarChart3, Settings, LogOut, UserCircle, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  empresaNombre: string;
  isAdmin: boolean;
  onNavigate: (section: string) => void;
  activeSection: string;
}

export default function Sidebar({ open, onClose, empresaNombre, isAdmin, onNavigate, activeSection }: SidebarProps) {
  const menuItems = [
    { id: 'agenda', label: 'Agenda', icon: Calendar, adminOnly: false },
    { id: 'clientes', label: 'Clientes', icon: Users, adminOnly: true },
    { id: 'servicios', label: 'Servicios', icon: Scissors, adminOnly: true },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3, adminOnly: true },
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell, adminOnly: true },
    { id: 'configuracion', label: 'Configuración', icon: Settings, adminOnly: true },
  ];

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  function handleLogout() {
    if (typeof window !== 'undefined') {
      supabase.auth.signOut().then(() => {
        localStorage.removeItem('slotify_profesional_id');
        localStorage.removeItem('slotify_empresa_id');
        localStorage.removeItem('slotify_rol');
        window.location.href = '/login';
      });
    }
  }

  function handleChangeProfile() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('slotify_profesional_id');
      localStorage.removeItem('slotify_rol');
      window.location.href = '/login';
    }
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-72 z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: '#1E293B' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <p className="font-semibold text-white text-sm">{empresaNombre}</p>
            <p className="text-xs text-gray-400">{isAdmin ? 'Administrador' : 'Empleado'}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                activeSection === item.id
                  ? 'bg-green-500/15 text-green-400'
                  : 'text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1 border-t border-gray-700">
          <button onClick={handleChangeProfile}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-300 hover:bg-gray-700/50">
            <UserCircle className="w-4 h-4" />
            Cambiar perfil
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}
