'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Check } from 'lucide-react';

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!;
const YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY!;

export default function PricingPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubscribe() {
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const priceId = billing === 'monthly' ? MONTHLY_PRICE_ID : YEARLY_PRICE_ID;

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Error al procesar el pago');
      return;
    }

    window.location.href = data.url;
  }

  const features = [
    'Panel de administración completo',
    'Gestión de citas y agenda',
    'Invitación de empleados',
    'Gestión de clientes',
    'Servicios personalizados',
    'Estadísticas del negocio',
    'Soporte por email',
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Slotify Pro</h1>
          <p className="text-gray-400 mt-2">Todo lo que necesitas para gestionar tu negocio</p>
        </div>

        {/* Toggle mensual/anual */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${billing === 'monthly' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            Mensual
          </button>
          <button onClick={() => setBilling('yearly')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${billing === 'yearly' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            Anual
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">-17%</span>
          </button>
        </div>

        {/* Card de precio */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="text-center mb-6">
            <div className="flex items-end justify-center gap-1">
              <span className="text-5xl font-bold">
                {billing === 'monthly' ? '29' : '290'}
              </span>
              <span className="text-gray-400 mb-2">€/{billing === 'monthly' ? 'mes' : 'año'}</span>
            </div>
            {billing === 'yearly' && (
              <p className="text-green-400 text-sm mt-1">Equivale a 24,17€/mes · 2 meses gratis</p>
            )}
          </div>

          <ul className="space-y-3 mb-6">
            {features.map(f => (
              <li key={f} className="flex items-center gap-3">
                <Check size={16} className="text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">{f}</span>
              </li>
            ))}
          </ul>

          {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

          <button onClick={handleSubscribe} disabled={loading}
            className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors">
            {loading ? 'Redirigiendo...' : 'Empezar ahora'}
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            Pago seguro con Stripe · Cancela cuando quieras
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => router.push('/login')} className="text-green-400 hover:underline">
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
