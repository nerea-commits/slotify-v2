export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabaseAdmin = getAdmin()

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { priceId } = await req.json()
  if (!priceId) return NextResponse.json({ error: 'Falta priceId' }, { status: 400 })

  const { data: empresa } = await supabaseAdmin
    .from('empresas')
    .select('id, nombre, email, stripe_customer_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  // Crear o reutilizar customer de Stripe
  let customerId = empresa.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: empresa.email || user.email,
      name: empresa.nombre,
      metadata: { empresa_id: empresa.id },
    })
    customerId = customer.id
    await supabaseAdmin
      .from('empresas')
      .update({ stripe_customer_id: customerId })
      .eq('id', empresa.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://slotify-v2-vxnx.vercel.app'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://slotify-v2-vxnx.vercel.app'}/pricing`,
    metadata: { empresa_id: empresa.id },
  })

  return NextResponse.json({ url: session.url })
}
