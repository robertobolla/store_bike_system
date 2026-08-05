// Facturacion semanal automatica (apartado 6 de los requisitos).
//
// Corre a diario. Por cada alquiler semanal cuya fecha de cobro haya
// llegado, emite la factura de esa semana, genera su PDF y lo envia.
//
// FRENO: solo entran los alquileres en estado 'Activo'. Cuando alguien
// pulsa "Aviso Devolucion" el alquiler pasa a 'Devolucion en Proceso' y
// deja de facturarse en el acto; la ultima semana, si hay que cobrarla,
// se emite a mano. Al cancelar el aviso vuelve a 'Activo' y se reanuda.
//
// Se puede ejecutar dos veces el mismo dia sin duplicar nada: el indice
// unico (rental_id, billing_period_start) lo impide en la base.

import { createClient } from '@supabase/supabase-js';
import { splitVatInclusive } from '../../../src/invoicing/money.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const DAY = 86_400_000;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Tope de facturas por alquiler y ejecucion. Si el cron estuvo caido una
// temporada, se ponen al dia; el tope evita que un dato corrupto (una
// fecha de cobro de hace anios) genere cientos de facturas de golpe.
const MAX_CATCH_UP = 8;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Emite documentos fiscales y manda emails: no puede quedar abierta.
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return json({ error: 'No autorizado' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const emitidas: string[] = [];
  const fallos: { rental: string; error: string }[] = [];

  try {
    const { data: company } = await supabase
      .from('company_settings').select('*').eq('id', 1).single();

    const { data: rentals, error } = await supabase
      .from('rentals')
      .select('id, rental_code, customer_id, bike_id, rental_rate, next_invoice_date, auto_email')
      .eq('rate_type', 'semanal')
      .eq('auto_invoice', true)
      .eq('status', 'Activo')
      .not('next_invoice_date', 'is', null)
      .lte('next_invoice_date', today());
    if (error) return json({ error: error.message }, 500);

    for (const rental of rentals ?? []) {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('customer_code, first_name, last_name, email, phone, address')
          .eq('id', rental.customer_id)
          .single();

        const customerSnapshot = {
          name: `${customer?.first_name ?? ''} ${customer?.last_name ?? ''}`.trim(),
          email: customer?.email ?? '',
          address: customer?.address ?? '',
          phone: customer?.phone ?? '',
          customer_code: customer?.customer_code ?? '',
        };

        const descripcion = await buildDescription(supabase, rental.bike_id);

        let due: string = rental.next_invoice_date;
        let emitidasAqui = 0;

        while (due <= today() && emitidasAqui < MAX_CATCH_UP) {
          const breakdown = splitVatInclusive(Number(rental.rental_rate ?? 0));

          const { data: doc, error: issueErr } = await supabase.rpc('issue_document', {
            p: {
              doc_type: 'INV',
              issue_date: due,
              status: 'pending',
              rental_id: rental.id,
              customer_id: rental.customer_id,
              subtotal: breakdown.subtotal,
              vat_rate: breakdown.vat_rate,
              vat_amount: breakdown.vat_amount,
              total: breakdown.total,
              customer_snapshot: customerSnapshot,
              company_snapshot: company,
              billing_period_start: due,
              billing_period_end: addDays(due, 6),
              auto_generated: true,
              lines: [{
                description: descripcion,
                quantity: 1,
                unit_price: breakdown.total,
                line_total: breakdown.total,
                vat_rate: breakdown.vat_rate,
              }],
            },
          });

          if (issueErr) {
            // El indice unico salta si esta semana ya se facturo. No es
            // un fallo: se avanza la fecha y se sigue.
            if (!issueErr.message?.includes('duplicate key')) throw issueErr;
          } else if (doc) {
            emitidas.push(doc.number);
            // El PDF y el email van aparte: si el envio falla, la
            // factura ya existe y se reintenta sin renumerar nada. El
            // email solo sale si el alquiler tiene el envio activado; el
            // PDF se genera igual para que la factura quede completa.
            await generarPdf(doc.id, rental.auto_email !== false);
          }

          due = addDays(due, 7);
          emitidasAqui++;
        }

        await supabase.from('rentals').update({ next_invoice_date: due }).eq('id', rental.id);
      } catch (e) {
        // Un alquiler que falla no puede dejar sin facturar a los demas.
        fallos.push({ rental: rental.rental_code ?? rental.id, error: (e as Error).message });
        console.error(`Fallo facturando ${rental.rental_code}:`, e);
      }
    }

    console.log(`Facturacion semanal: ${emitidas.length} emitidas, ${fallos.length} fallos.`);
    return json({ emitidas, fallos });
  } catch (e) {
    console.error('run-weekly-billing:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function buildDescription(
  supabase: ReturnType<typeof createClient>,
  bikeId: string | null,
): Promise<string> {
  if (!bikeId) return 'E-bike weekly rental';
  const { data: bike } = await supabase
    .from('products').select('serial_number, model_id').eq('id', bikeId).single();
  if (!bike) return 'E-bike weekly rental';

  let modelo = '';
  if (bike.model_id) {
    const { data: m } = await supabase
      .from('product_models').select('brand, model_name').eq('id', bike.model_id).single();
    modelo = `${m?.brand ?? ''} ${m?.model_name ?? ''}`.trim();
  }
  const partes = [modelo, bike.serial_number].filter(Boolean).join(' ');
  return partes ? `E-bike weekly rental — ${partes}` : 'E-bike weekly rental';
}

async function generarPdf(documentId: string, sendEmail = true): Promise<void> {
  try {
    const res = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-document-pdf`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ document_id: documentId, send_email: sendEmail }),
      },
    );
    if (!res.ok) console.error(`PDF no generado para ${documentId}: ${await res.text()}`);
  } catch (e) {
    console.error(`PDF no generado para ${documentId}:`, e);
  }
}
