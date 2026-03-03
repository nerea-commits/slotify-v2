'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, Building2, Users, CheckCircle, XCircle, ChevronRight, ArrowLeft, Calendar, Phone, Mail } from 'lucide-react';

interface Empresa {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  created_at: string;
  activo: boolean;
  is_superadmin: boolean;
  profesionales: { count: number }[];
}

interface Detalle {
  empresa: any;
  profesionales: any[];
  citas: any[];
  totalCitas: number;
}

export default function SuperadminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtered, setFiltered] = useState<Empresa[]>([]);
  const [search, setSearch] = useState('');
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: emp } = await supabase
        .from('empresas')
        .select('is_superadmin')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (!emp?.is_superadmin) {
        router.push('/dashboard');
        return;
      }

      setToken(session.access_token);
      await loadEmpresas(session.access_token);
    }
    init();
  }, []);

  async function loadEmpresas(t: string) {
    setLoading(true);
    const res = await fetch('/api/superadmin/empresas', {
      headers: { Authorization: `Bearer ${t}` }
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setLoading(false); return; }
    setEmpresas(data.empresas || []);
    setFiltered(data.empresas || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!search.trim()) { setFiltered(empresas); return; }
    const q = search.toLowerCase();
    setFiltered(empresas.filter(e =>
      e.nombre?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    ));
  }, [search, empresas]);

  async function loadDetalle(empresa_id: string) {
    setDetalleLoading(true);
    const res = await fetch(`/api/superadmin/empresa-detalle?empresa_id=${empresa_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setDetalle(data);
    setDetalleLoading(false);
  }

  async function toggleActivo(empresa: Empresa) {
    setToggling(empresa.id);
    const res = await fetch('/api/superadmin/empresas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ empresa_id: empresa.id, activo: !empresa.activo })
    });
    if (res.ok) {
      setEmpresas(prev => prev.map(e => e.id === empresa.id ? { ...e, activo: !e.activo } : e));
      if (detalle?.empresa?.id === empresa.id) {
        setDetalle(prev => prev ? { ...prev, empresa: { ...prev.empresa, activo: !prev.empresa.activo } } : null);
      }
    }
    setToggling(null);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Cargando panel...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-red-400">{error}</p>
    </div>
  );

  // Vista detalle
  if (detalle) {
    const emp = detalle.empresa;
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-3xl mx-auto p-4">
          <button onClick={() => setDetalle(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 mt-4">
            <ArrowLeft size={16} /> Volver
          </button>

          <div className="bg-gray-900 rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{emp.nombre}</h1>
                <p className="text-gray-400 text-sm mt-1">{emp.email}</p>
                {emp.telefono && <p className="text-gray-400 text-sm">{emp.telefono}</p>}
                <p className="text-gray-500 text-xs mt-2">
                  Registrado: {new Date(emp.created_at).toLocaleDateString('es-ES')}
                </p>
              </div>
              <button onClick={() => toggleActivo(emp)}
                disabled={toggling === emp.id}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${emp.activo ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                {toggling === emp.id ? '...' : emp.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="bg-gray-800 rounded-xl px-4 py-3 flex-1 text-center">
                <p className="text-2xl font-bold">{detalle.profesionales?.length || 0}</p>
                <p className="text-gray-400 text-xs mt-1">Empleados</p>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-3 flex-1 text-center">
                <p className="text-2xl font-bold">{detalle.totalCitas || 0}</p>
                <p className="text-gray-400 text-xs mt-1">Citas totales</p>
              </div>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Empleados</h2>
          <div className="space-y-2 mb-6">
            {detalle.profesionales?.length === 0 && (
              <p className="text-gray-500 text-sm">Sin empleados</p>
            )}
            {detalle.profesionales?.map(p => (
              <div key={p.id} className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.nombre}</p>
                  <p className="text-gray-500 text-xs capitalize">{p.rol}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.auth_user_id
                    ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Activo</span>
                    : <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full">Sin cuenta</span>
                  }
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Últimas citas</h2>
          <div className="space-y-2">
            {detalle.citas?.length === 0 && (
              <p className="text-gray-500 text-sm">Sin citas</p>
            )}
            {detalle.citas?.map(c => (
              <div key={c.id} className="bg-gray-900 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{c.clientes?.nombre || 'Cliente'}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(c.hora_inicio).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {c.servicios?.nombre} · {c.profesionales?.nombre}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vista lista
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mt-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Panel Superadmin</h1>
            <p className="text-gray-400 text-sm mt-1">{empresas.length} negocios registrados</p>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-400 hover:text-white">
            Mi dashboard →
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="w-full bg-gray-900 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          {filtered.map(emp => (
            <div key={emp.id}
              className="bg-gray-900 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={() => loadDetalle(emp.id)}>
              <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{emp.nombre}</p>
                  {emp.activo
                    ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex-shrink-0">Activo</span>
                    : <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full flex-shrink-0">Inactivo</span>
                  }
                </div>
                <p className="text-gray-500 text-xs truncate mt-0.5">{emp.email || 'Sin email'}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users size={11} />
                    {emp.profesionales?.[0]?.count || 0} empleados
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(emp.created_at).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-12">No hay negocios</p>
          )}
        </div>
      </div>
    </div>
  );
}
