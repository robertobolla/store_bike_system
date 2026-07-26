// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 'to' acepta una cadena (como hasta ahora) o una lista. 'cc' y
    // 'attachments' son opcionales: las llamadas que ya existen en la app
    // siguen funcionando sin tocarlas.
    //
    // attachments: [{ filename: 'INV-2026-1001.pdf', content: '<base64>' }]
    // Es el formato que espera Resend. El contenido va en base64 sin el
    // prefijo 'data:application/pdf;base64,'.
    const { to, cc, subject, html, attachments } = await req.json()

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY is not set in Supabase Secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean)
    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipient supplied in "to"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'The Fast Sheep <no-reply@thefastsheep.com>'

    const payload: Record<string, unknown> = {
      from: senderEmail,
      to: recipients,
      subject: subject,
      html: html,
    }
    if (cc) payload.cc = Array.isArray(cc) ? cc.filter(Boolean) : [cc].filter(Boolean)
    if (Array.isArray(attachments) && attachments.length > 0) payload.attachments = attachments

    console.log(
      `Sending email to ${recipients.join(', ')} with subject "${subject}" from "${senderEmail}"` +
      `${payload.attachments ? ` (${(payload.attachments as unknown[]).length} attachment(s))` : ''}...`
    )

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const resData = await res.json()
    if (!res.ok) {
      console.error('Error response from Resend API:', resData)
      return new Response(
        JSON.stringify({ error: resData.message || 'Resend API error', details: resData }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Email sent successfully to ${recipients.join(', ')}. Resend ID: ${resData.id}`)
    return new Response(
      JSON.stringify({ success: true, id: resData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Edge Function Exception:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
