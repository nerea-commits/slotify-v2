export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, nombre, rol, empresa_id } = body

    if (!email || !nombre || !empresa_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const supabaseAdmin = getAdmin()

    // Comprobar si el profesional ya existe en esta empresa
    const { data: existingProf } = await supabaseAdmin
      .from('profesionales')
      .select('id, auth_user_id, email')
      .eq('email', email)
      .eq('empresa_id', empresa_id)
      .maybeSingle()

    if (existingProf) {
      // Ya existe — solo reenviar email sin crear nada nuevo
      const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://slotify-v2-vxnx.vercel.app'}/auth/callback`,
        }
      })

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Invitación reenviada por email',
      })
    }

    // No existe — crear usuario y profesional
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          nombre,
          rol: rol || 'empleado',
          empresa_id,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://slotify-v2-vxnx.vercel.app'}/auth/callback`,
      })

    if (userError || !userData.user) {
      return NextResponse.json({ error: userError?.message }, { status: 400 })
    }

    const userId = userData.user.id

    const { error: profError } = await supabaseAdmin
      .from('profesionales')
      .insert({
        nombre,
        rol: rol || 'empleado',
        empresa_id,
        auth_user_id: userId,
        activo: true,
        email,
      })

    if (profError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Invitación enviada por email',
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
