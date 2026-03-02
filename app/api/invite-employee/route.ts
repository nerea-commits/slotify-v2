import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, nombre, rol, empresa_id } = body

    if (!email || !nombre || !empresa_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Cliente con SERVICE ROLE (solo backend)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1️⃣ Crear usuario en Auth
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
      })

    if (userError || !userData.user) {
      return NextResponse.json({ error: userError?.message }, { status: 400 })
    }

    const userId = userData.user.id

    // 2️⃣ Crear registro en profesionales
    const { error: profError } = await supabaseAdmin
      .from('profesionales')
      .insert([
        {
          nombre,
          rol: rol || 'empleado',
          empresa_id,
          user_id: userId,
        },
      ])

    if (profError) {
      return NextResponse.json({ error: profError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
