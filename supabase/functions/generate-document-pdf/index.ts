// Genera el PDF de uno o varios documentos, los archiva en Storage y los
// envia por email al cliente con copia a facturacion.
//
// Es el apartado 8 del documento de requisitos: al marcar una factura
// como pagada se guarda fecha y metodo, se genera el PDF, se manda al
// cliente y queda una copia. Corre en el servidor porque tambien lo
// dispara la facturacion semanal automatica, cuando no hay nadie
// conectado que pueda imprimir desde el navegador.
//
// Cuando se pasan varios documentos a la vez (p.ej. el deposito y la
// factura de la primera semana, al dar de alta un alquiler) se manda UN
// solo email con los dos PDF adjuntos, para no saturar al cliente con
// varios correos por el mismo alta.
//
// Entrada:  { document_id: uuid, send_email?: boolean }
//        o  { document_ids: uuid[], send_email?: boolean }
// Salida:   { pdf_url, emailed }               (un solo documento)
//        o  { results: [{document_id, pdf_url}], emailed } (varios)

import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { DocumentPdf } from '../../../src/invoicing/pdfDocument.tsx';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// El logo se empotra en el PDF en vez de dejar que react-pdf lo descargue
// al renderizar. Dos motivos: se descarga una sola vez, y si el dominio
// no responde el documento se genera igual sin logo. Con la descarga
// dentro del render, un fallo de red aborta la factura entera — y la
// facturacion automatica corre de madrugada, sin nadie mirando.
async function fetchLogoAsDataUri(url: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn(`Logo no descargado (HTTP ${res.status}); el PDF sale sin logo.`);
      return '';
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const mime = res.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${btoa(binary)}`;
  } catch (e) {
    console.warn(`Logo no descargado (${(e as Error).message}); el PDF sale sin logo.`);
    return '';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  // En trozos, porque String.fromCharCode(...array) revienta la pila con
  // arrays grandes y un PDF son decenas de miles de bytes.
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const EMAIL_SUBJECTS: Record<string, string> = {
  INV: 'Invoice',
  DEP: 'Deposit receipt',
  REF: 'Deposit refund',
  CN:  'Credit note',
  RCP: 'Payment receipt',
};

type SupabaseClient = ReturnType<typeof createClient>;

interface RenderedDoc {
  doc: Record<string, any>;
  // Datos de la empresa ya resueltos: el snapshot del documento, o
  // company_settings si se emitio sin snapshot. Se devuelve porque el
  // email tambien los necesita (copia a facturacion, pie, razon social)
  // y no puede volver a mirar el snapshot crudo, que puede venir vacio.
  company: Record<string, any>;
  path: string;
  pdfBytes: Uint8Array;
}

// Renderiza el PDF de un documento y lo archiva. No envia nada: eso lo
// decide el llamador una vez tiene todos los documentos del lote listos.
async function renderAndArchive(supabase: SupabaseClient, documentId: string): Promise<RenderedDoc> {
  const { data: doc, error: docErr } = await supabase
    .from('documents').select('*').eq('id', documentId).single();
  if (docErr) throw new Error(`Documento no encontrado: ${docErr.message}`);

  const { data: lines, error: linesErr } = await supabase
    .from('document_lines').select('*')
    .eq('document_id', documentId)
    .order('sort_order', { ascending: true });
  if (linesErr) throw new Error(linesErr.message);

  // Se imprime desde los snapshots congelados en el documento, no de las
  // tablas vivas: reimprimir una factura de hace seis meses tiene que dar
  // exactamente el mismo papel. Solo se recurre a company_settings si el
  // documento se emitio sin snapshot.
  let company = doc.company_snapshot;
  if (!company || Object.keys(company).length === 0) {
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    company = data;
  }
  const customer = doc.customer_snapshot ?? {};

  // El RNT es lo que enlaza todos los documentos de un alquiler.
  let rentalCode: string | null = null;
  if (doc.rental_id) {
    const { data } = await supabase
      .from('rentals').select('rental_code').eq('id', doc.rental_id).single();
    rentalCode = data?.rental_code ?? null;
  }

  let relatedNumber: string | null = null;
  if (doc.related_document_id) {
    const { data } = await supabase
      .from('documents').select('number').eq('id', doc.related_document_id).single();
    relatedNumber = data?.number ?? null;
  }

  const logoDataUri = await fetchLogoAsDataUri(company?.logo_url ?? '');

  const pdf = await renderToBuffer(
    createElement(DocumentPdf, {
      doc,
      lines: lines ?? [],
      company: { ...company, logo_url: logoDataUri },
      customer,
      rentalCode,
      relatedNumber,
    }),
  );
  const pdfBytes = new Uint8Array(pdf);

  // Ruta estable y unica: el numero de documento no se repite jamas.
  const path = `${doc.year}/${doc.number}.pdf`;
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`No se pudo archivar el PDF: ${upErr.message}`);

  await supabase.from('documents')
    .update({ pdf_url: path, pdf_generated_at: new Date().toISOString() })
    .eq('id', documentId);

  return { doc, company: company ?? {}, path, pdfBytes };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const send_email = body.send_email ?? true;
    const ids: string[] = Array.isArray(body.document_ids)
      ? body.document_ids
      : (body.document_id ? [body.document_id] : []);
    if (ids.length === 0) return json({ error: 'Falta document_id o document_ids' }, 400);

    // Service role: la funcion tiene que leer cualquier documento y
    // escribir en el bucket privado, tambien cuando la dispara el cron y
    // no hay usuario detras.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const rendered: RenderedDoc[] = [];
    for (const id of ids) {
      rendered.push(await renderAndArchive(supabase, id));
    }

    let emailed = false;
    if (send_email) {
      // Un solo email para todo el lote: el cliente y la copia de
      // facturacion salen del primer documento, que es el mismo alquiler
      // o venta en todos los casos en que se factura en lote.
      const first = rendered[0].doc;
      const customer = first.customer_snapshot ?? {};
      const company = rendered[0].company;
      const to = customer?.email;
      const accounting = company?.accounting_email;

      if (!to) {
        console.warn(`${first.number}: el cliente no tiene email, no se envia.`);
      } else {
        const labels = rendered.map(r => EMAIL_SUBJECTS[r.doc.doc_type] ?? 'Document');
        const subject = rendered.length > 1
          ? `${labels.join(' & ')} — ${rendered.map(r => r.doc.number).join(', ')} — ${company?.legal_name ?? 'The Fast Sheep'}`
          : `${labels[0]} ${rendered[0].doc.number} — ${company?.legal_name ?? 'The Fast Sheep'}`;

        const emailRes = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              to,
              // La copia para The Fast Sheep va en cc, ademas de quedar
              // archivada en Storage.
              cc: accounting ? [accounting] : undefined,
              subject,
              html: buildEmailHtml(rendered, company),
              attachments: rendered.map(r => ({
                filename: `${r.doc.number}.pdf`,
                content: bytesToBase64(r.pdfBytes),
              })),
            }),
          },
        );

        if (emailRes.ok) {
          emailed = true;
          const now = new Date().toISOString();
          for (const r of rendered) {
            await supabase.from('documents')
              .update({ sent_to_customer_at: now, sent_to_accounting_at: accounting ? now : null })
              .eq('id', r.doc.id);
          }
        } else {
          // Los PDF ya estan archivados: el envio se puede reintentar sin
          // volver a generar ni renumerar nada.
          console.error(`${rendered.map(r => r.doc.number).join(', ')}: fallo el envio — ${await emailRes.text()}`);
        }
      }
    }

    if (rendered.length === 1 && !Array.isArray(body.document_ids)) {
      // Forma de respuesta compatible con los llamadores existentes que
      // piden un solo documento.
      return json({ pdf_url: rendered[0].path, emailed });
    }
    return json({
      results: rendered.map(r => ({ document_id: r.doc.id, pdf_url: r.path })),
      emailed,
    });
  } catch (error) {
    console.error('generate-document-pdf:', error);
    return json({ error: (error as Error).message ?? 'Error interno' }, 500);
  }
});

function buildEmailHtml(
  rendered: RenderedDoc[],
  company: Record<string, unknown> | null,
): string {
  const fmtMoney = (v: unknown) => typeof v === 'number'
    ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(v)
    : String(v);

  const intro = rendered.length > 1
    ? `<p>Please find attached your documents:</p>
       <ul style="padding-left:18px;margin:8px 0">
         ${rendered.map(r => `<li><strong>${EMAIL_SUBJECTS[r.doc.doc_type] ?? 'Document'} ${r.doc.number}</strong> — ${fmtMoney(r.doc.total)}</li>`).join('')}
       </ul>`
    : `<p>Please find attached your ${(EMAIL_SUBJECTS[rendered[0].doc.doc_type] ?? 'document').toLowerCase()}
        <strong>${rendered[0].doc.number}</strong> for <strong>${fmtMoney(rendered[0].doc.total)}</strong>.</p>`;

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
            font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p>Hi,</p>
  ${intro}
  <p style="color:#555">Any questions, just reply to this email.</p>
  <p style="margin-top:28px;padding-top:14px;border-top:1px solid #e4e4e4;
            font-size:12px;color:#777">
    ${company?.invoice_footer ?? company?.legal_name ?? 'The Fast Sheep Limited'}
  </p>
</div>`;
}
