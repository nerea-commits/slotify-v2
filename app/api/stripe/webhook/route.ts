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
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const supabaseAdmin = getAdmin()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const empresa_id = session.metadata?.empresa_id
    if (empresa_id) {
      await supabaseAdmin
        .from('empresas')
        .update({
          activo: true,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: session.customer as string,
        })
        .eq('id', empresa_id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await supabaseAdmin
      .from('empresas')
      .update({ activo: false })
      .eq('stripe_subscription_id', subscription.id)
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    await supabaseAdmin
      .from('empresas')
      .update({ activo: false })
      .eq('stripe_customer_id', invoice.customer as string)
  }

  return NextResponse.json({ received: true })
}
