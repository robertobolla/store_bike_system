### 1. Import of downloadBackupXlsx
```typescript
import { downloadBackupXlsx } from './backup';
```

### 2. DELIVERY_CHECKLIST_GROUPS Definition
```typescript
const DELIVERY_CHECKLIST_GROUPS: {
  key: string;
  title: string;
  kind: 'checkbox' | 'declaration';
  items: { key: string; text: string }[];
}[] = [
  {
    key: 'condition',
    title: 'Condition & Equipment',
    kind: 'checkbox',
    items: [
      {
        key: 'working_condition',
        text: 'I confirm that the e-bike has been inspected and delivered in good working condition, including brakes, tyres, wheels, steering, drivetrain, saddle, lights, electrical system, battery security and safety equipment.',
      },
      {
        key: 'accessories',
        text: 'I confirm that I have received all accessories provided with the rental, including any keys, lock, charger and other listed equipment, and that their condition is satisfactory.',
      },
      {
        key: 'defects_recorded',
        text: 'I confirm that any existing scratches, damage or cosmetic defects have been identified, recorded and explained to me. Photographs of the e-bike have been taken and attached to the rental record.',
      },
      {
        key: 'instructions',
        text: 'I confirm that I have received instructions regarding the safe operation of the e-bike, including braking, gear shifting, electric assistance, battery use, lock operation, estimated range, road safety and applicable traffic regulations.',
      },
    ],
  },
  {
    key: 'declaration',
    title: 'Customer Declaration',
    kind: 'declaration',
    items: [
      {
        key: 'accept_condition',
        text: 'I acknowledge that I have inspected the e-bike and accept its condition at the time of delivery.',
      },
      {
        key: 'safety_instructions',
        text: 'I acknowledge that I have received safety instructions, including recommendations regarding helmet use, visibility and compliance with local traffic regulations.',
      },
      {
        key: 'responsible_use',
        text: 'I accept responsibility for operating the e-bike in a safe and lawful manner during the rental period.',
      },
      {
        key: 'return_condition',
        text: 'I agree to return the e-bike and all accessories in the same condition as received, excluding normal wear and tear. I understand that I may be charged for loss, theft, damage or missing accessories in accordance with the Rental Agreement.',
      },
    ],
  },
];

// Only the 'checkbox' groups are individually ticked by the customer; the
// 'declaration' groups are statements accepted via the signature.
const DELIVERY_CHECKLIST_CHECKBOX_KEYS = DELIVERY_CHECKLIST_GROUPS
  .filter(g => g.kind === 'checkbox')
  .flatMap(g => g.items.map(i => i.key));

// ----------------------------------------------------
```

### 3. InternalChecklistEditor Component
```typescript
function InternalChecklistEditor({ value, onChange }: {
  value: InternalChecklistValue;
  onChange: (v: InternalChecklistValue) => void;
}) {
  const allChecked = INTERNAL_CHECKLIST_ITEM_KEYS.every(k => value.items[k]);
  const toggleAll = () => {
    const next = !allChecked;
    const items: Record<string, boolean> = {};
    INTERNAL_CHECKLIST_ITEM_KEYS.forEach(k => { items[k] = next; });
    onChange({ ...value, items });
  };
  const toggleItem = (k: string) => onChange({ ...value, items: { ...value.items, [k]: !value.items[k] } });
  const setNote = (field: string, val: string) => onChange({ ...value, notes: { ...value.notes, [field]: val } });
  const checkedCount = INTERNAL_CHECKLIST_ITEM_KEYS.filter(k => value.items[k]).length;

  // Inspector signature (finger / mouse). The drawn image is kept on the canvas
  // and pushed to the value as a data URL; the save handler uploads it.
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [sigDrawing, setSigDrawing] = useState(false);
  const [reSign, setReSign] = useState(false);
  const sigPoint = (canvas: HTMLCanvasElement, e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  };
  const sigStart = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const c = sigCanvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    setSigDrawing(true);
    const { x, y } = sigPoint(c, e); ctx.beginPath(); ctx.moveTo(x, y);
  };
  const sigMove = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!sigDrawing) return;
    const c = sigCanvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const { x, y } = sigPoint(c, e);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#10b981'; ctx.lineTo(x, y); ctx.stroke();
  };
  const sigEnd = () => {
    setSigDrawing(false);
    const c = sigCanvasRef.current; if (!c) return;
    onChange({ ...value, signatureDataUrl: c.toDataURL('image/png') });
  };
  const sigClear = () => {
    const c = sigCanvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    onChange({ ...value, signatureDataUrl: null });
  };

  return (
    <div className="checklist-scope">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div className="checklist-field" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
          <label>Ã°ÂÂÂ Battery Charge Level</label>
          <input type="text" inputMode="numeric" placeholder="e.g. 100%" value={value.battery_level} onChange={(e) => onChange({ ...value, battery_level: e.target.value })} />
        </div>
        <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap', alignSelf: 'flex-end' }} onClick={toggleAll}>
          {allChecked ? 'Ã¢ÂÂ Uncheck all' : 'Ã¢ÂÂ Check all'}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
        {checkedCount}/{INTERNAL_CHECKLIST_ITEM_KEYS.length} checked
      </p>

      {INTERNAL_CHECKLIST_GROUPS.map(group => (
        <div key={group.key} className="checklist-group">
          <p className="checklist-group-title">{group.title}</p>
          {group.items.map(item => (
            <div key={item.key}>
              <label className={`checklist-item ${value.items[item.key] ? 'checked' : ''}`}>
                <input type="checkbox" checked={!!value.items[item.key]} onChange={() => toggleItem(item.key)} />
                <span>{item.text}</span>
              </label>
              {item.input && (
                <input
                  type="text"
                  value={value.notes[item.input] ?? ''}
                  onChange={(e) => setNote(item.input!, e.target.value)}
                  placeholder="Detail..."
                  style={{ width: '100%', padding: '8px 10px', margin: '2px 0 8px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'inherit', fontSize: '13px' }}
                />
              )}
            </div>
          ))}
          {group.key === 'final' && (
            <>
              <div className="checklist-field" style={{ marginTop: '8px' }}>
                <label>Inspected By</label>
                <input type="text" value={value.notes.inspected_by ?? ''} onChange={(e) => setNote('inspected_by', e.target.value)} placeholder="Name" />
              </div>
              <div className="checklist-field">
                <label>Ã¢ÂÂÃ¯Â¸Â Signature</label>
                {value.signatureUrl && !reSign ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                    <img src={value.signatureUrl} alt="signature" style={{ maxWidth: '280px', width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#fff' }} />
                    <button type="button" className="btn-secondary btn-xs" onClick={() => setReSign(true)}>Ã¢ÂÂÃ¯Â¸Â Re-sign</button>
                  </div>
                ) : (
                  <>
                    <canvas
                      ref={sigCanvasRef}
                      width={480}
                      height={150}
                      style={{ width: '100%', height: '150px', border: '2px dashed var(--border-color)', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', cursor: 'crosshair', touchAction: 'none' }}
                      onMouseDown={sigStart}
                      onMouseMove={sigMove}
                      onMouseUp={sigEnd}
                      onMouseLeave={() => sigDrawing && sigEnd()}
                      onTouchStart={sigStart}
                      onTouchMove={sigMove}
                      onTouchEnd={sigEnd}
                    />
                    <button type="button" className="btn-secondary btn-xs" style={{ marginTop: '6px' }} onClick={sigClear}>Ã°ÂÂÂÃ¯Â¸Â Clear signature</button>
                  </>
                )}
              </div>
              <div className="checklist-field">
                <label>Date</label>
                <input
                  type="text"
                  readOnly
                  value={value.notes.inspected_date || new Date().toISOString().split('T')[0]}
                  style={{ opacity: 0.7, cursor: 'default' }}
                />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Localized framing strings for the checklist emails. The checklist DOCUMENT
// itself (titles, field labels, acknowledgement items, signature) is always in
// English; only the surrounding email copy follows the configured language.
const CHECKLIST_EMAIL_T = {
  es: {
    inviteSubject: 'Checklist de entrega de tu e-bike - The Fast Sheep',
    greeting: (n: string) => `Hola ${n},`,
    intro: (m: string, s: string) => `Antes de retirar tu e-bike <strong>${m}</strong> (${s}), por favor revisÃÂ¡ y confirmÃÂ¡ el checklist de entrega.`,
    button: 'Abrir checklist y firmar',
    fallback: 'Si el botÃÂ³n no funciona, copiÃÂ¡ y pegÃÂ¡ este enlace en tu navegador:',
    copySubject: 'Copia de tu checklist de entrega aceptado - The Fast Sheep',
    copyIntro: (n: string) => `Hola ${n}, a continuaciÃÂ³n encontrarÃÂ¡s una copia del checklist de entrega que aceptaste y firmaste.`,
  },
  en: {
    inviteSubject: 'E-Bike Delivery Checklist - The Fast Sheep',
    greeting: (n: string) => `Hi ${n},`,
    intro: (m: string, s: string) => `Before taking your e-bike <strong>${m}</strong> (${s}), please review and confirm the delivery checklist.`,
    button: 'Open checklist &amp; sign',
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    copySubject: 'Copy of your accepted delivery checklist - The Fast Sheep',
    copyIntro: (n: string) => `Hi ${n}, below is a copy of the delivery checklist you accepted and signed.`,
  },
  pt: {
    inviteSubject: 'Checklist de entrega da tua e-bike - The Fast Sheep',
    greeting: (n: string) => `OlÃÂ¡ ${n},`,
    intro: (m: string, s: string) => `Antes de levantar a tua e-bike <strong>${m}</strong> (${s}), por favor revÃÂª e confirma o checklist de entrega.`,
    button: 'Abrir checklist e assinar',
    fallback: 'Se o botÃÂ£o nÃÂ£o funcionar, copia e cola este link no teu navegador:',
    copySubject: 'CÃÂ³pia do teu checklist de entrega aceite - The Fast Sheep',
    copyIntro: (n: string) => `OlÃÂ¡ ${n}, em baixo encontras uma cÃÂ³pia do checklist de entrega que aceitaste e assinaste.`,
```

### 4. Email template functions (sendDeliveryChecklistInviteEmail / sendDeliveryChecklistCopyEmail)
```typescript
  },
} as const;

// Email 1: invitation with link to the public checklist page (localized cover note)
function sendDeliveryChecklistInviteEmail(checklist: DeliveryChecklist, url: string, lang: 'es' | 'en' | 'pt') {
  const t = CHECKLIST_EMAIL_T[lang] ?? CHECKLIST_EMAIL_T.en;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <div style="text-align:center; padding: 16px 0;">
        <div style="font-size: 28px;">Ã°ÂÂÂ</div>
        <h2 style="margin: 4px 0;">The Fast Sheep</h2>
      </div>
      <p>${t.greeting(checklist.customer_name)}</p>
      <p>${t.intro(checklist.bike_model, checklist.bike_serial)}</p>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${url}" style="background:#10b981; color:#fff; text-decoration:none; padding: 14px 28px; border-radius: 10px; font-weight: 600; display:inline-block;">
          ${t.button}
        </a>
      </div>
      <p style="font-size: 12px; color:#6b7280;">${t.fallback}<br>
        <a href="${url}" style="color:#10b981;">${url}</a></p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 11px; color:#9ca3af; text-align:center;">THE FAST SHEEP LIMITED Ã¢ÂÂ 802654<br>www.thefastsheep.com ÃÂ· +353 83 042 9732</p>
    </div>`;
  executeEmailSend(checklist.customer_email, t.inviteSubject, html);
}

// Email 2: accepted copy of the document. Subject + intro follow the configured
// language; the reproduced document below stays in English (matches the PDF).
function sendDeliveryChecklistCopyEmail(
  checklist: DeliveryChecklist,
  payload: { items: Record<string, boolean>; battery_level: string; signature_url: string },
  lang: 'es' | 'en' | 'pt'
) {
  const t = CHECKLIST_EMAIL_T[lang] ?? CHECKLIST_EMAIL_T.en;
  const subject = t.copySubject;

  const groupsHtml = DELIVERY_CHECKLIST_GROUPS.map(g => `
    <h3 style="font-size:14px; margin: 18px 0 6px;">${g.title}</h3>
    ${g.items.map(it => g.kind === 'checkbox'
      ? `<p style="margin: 4px 0; font-size: 12px; line-height: 1.5;"><span style="color:#10b981; font-weight:700;">Ã¢ÂÂ</span> ${it.text}</p>`
      : `<p style="margin: 4px 0; font-size: 12px; line-height: 1.5;">${it.text}</p>`).join('')}
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <div style="text-align:center; padding: 16px 0;">
        <div style="font-size: 28px;">Ã°ÂÂÂ</div>
        <h2 style="margin: 4px 0;">The Fast Sheep</h2>
        <p style="margin:0; font-size: 13px; color:#6b7280;">E-Bike Delivery Checklist</p>
        <p style="margin:0; font-size: 12px; color:#9ca3af;">Customer Acknowledgement &amp; Liability Waiver</p>
      </div>
      <p style="font-size: 13px;">${t.copyIntro(checklist.customer_name)}</p>
      <table style="width:100%; font-size: 13px; border-collapse: collapse; margin-bottom: 8px;">
        <tr><td style="padding:4px 0; color:#6b7280;">E-Bike Model</td><td style="padding:4px 0; text-align:right; font-weight:600;">${checklist.bike_model}</td></tr>
        <tr><td style="padding:4px 0; color:#6b7280;">E-Bike Serial Number</td><td style="padding:4px 0; text-align:right; font-weight:600;">${checklist.bike_serial}</td></tr>
        <tr><td style="padding:4px 0; color:#6b7280;">Date</td><td style="padding:4px 0; text-align:right; font-weight:600;">${checklist.delivery_date}</td></tr>
        <tr><td style="padding:4px 0; color:#6b7280;">Battery Charge Level</td><td style="padding:4px 0; text-align:right; font-weight:600;">${payload.battery_level || 'Ã¢ÂÂ'}</td></tr>
        <tr><td style="padding:4px 0; color:#6b7280;">Customer Name</td><td style="padding:4px 0; text-align:right; font-weight:600;">${checklist.customer_name}</td></tr>
      </table>
      ${groupsHtml}
      <p style="font-size: 12px; line-height: 1.5; margin: 14px 0;">By signing below, the customer confirms acceptance of all the aforementioned conditions and declarations.</p>
      <h3 style="font-size:14px; margin: 18px 0 6px;">Customer Signature</h3>
      <img src="${payload.signature_url}" alt="signature" style="max-width: 320px; border:1px solid #e5e7eb; border-radius: 8px; background:#fff;" />
      <p style="font-size: 12px; color:#6b7280; margin-top: 8px;">Accepted on ${checklist.delivery_date} by ${checklist.customer_name}.</p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 11px; color:#9ca3af; text-align:center;">THE FAST SHEEP LIMITED Ã¢ÂÂ 802654<br>Explore the world and enjoy cycling<br>www.thefastsheep.com ÃÂ· +353 83 042 9732 ÃÂ· T23 AT2P</p>
    </div>`;
  executeEmailSend(checklist.customer_email, subject, html);
}

// ----------------------------------------------------
```

### 5. Wizard Submission integration (create & send delivery checklist / internal checklist)
```typescript

      // Create & send the customer delivery checklist (link emailed to the rider)
      if (wizSendDeliveryChecklist && wizEmail) {
        try {
          const checklist = await createDeliveryChecklist({
            rental_id: newRentId,
            audience: 'customer',
            customer_name: `${rider.first_name} ${rider.last_name}`.trim(),
            customer_email: wizEmail,
            email_lang: wizEmailLang,
            bike_model: bikeProduct?.name ?? '',
            bike_serial: bikeProduct?.serial_number ?? '',
            delivery_date: new Date().toISOString().split('T')[0],
          });
          const checklistUrl = `${window.location.origin}${window.location.pathname}?checklist=${checklist.id}`;
          sendDeliveryChecklistInviteEmail(checklist, checklistUrl, wizEmailLang);
          showToast(`Ã¢ÂÂ ${language === 'es' ? 'Checklist enviada' : 'Checklist sent'}: ${checklistUrl}`, 'success');
          try { await navigator.clipboard.writeText(checklistUrl); } catch { /* ignore */ }
        } catch (err) {
          console.error('Failed to create/send delivery checklist:', err);
          showToast(language === 'es' ? 'No se pudo enviar la checklist de entrega.' : 'Could not send the delivery checklist.', 'error');
        }
      }

      // Create the internal technical inspection checklist (operator-filled).
      // Always created so it is available in the rider profile, even if completed later.
      try {
        await persistInternalChecklist({
          existingId: null,
          rentalId: newRentId,
          customerName: `${rider.first_name} ${rider.last_name}`.trim(),
          bikeModel: bikeProduct?.name ?? '',
          bikeSerial: bikeProduct?.serial_number ?? '',
          deliveryDate: new Date().toISOString().split('T')[0],
          value: wizInternalChecklist,
        });
      } catch (err) {
        console.error('Failed to create internal checklist:', err);
      }

      // Reset wizard
      setWizBikeId(''); setWizBatteryIds([]); setWizLockId(''); setWizGigAccountId(null);
      setWizFirstName(''); setWizLastName(''); setWizEmail('');
      setWizPhone(''); setWizRiderEmail(''); setSignatureData(null);
      setWizKitProductIds([]); setWizHasKit(true); setWizKitDetails('');
      setWizCustomerCode(''); setWizStartDate(new Date().toISOString().split('T')[0]);
      // Reset Step 7 evidence states
      setWizConditionFiles([]); setWizConditionPreviews([]);
      setWizInstagramFiles([]); setWizInstagramPreviews([]);
      setWizIdDocFile(null); setWizIdDocPreview('');
      setWizContractMode(null); setWizPhysicalContractFiles([]); setWizPhysicalContractPreviews([]);
```

### 6. Public Delivery Checklist Page (?checklist=)
```typescript
    setSignSubmitting(false);
  };

  // ============================================================
  // PUBLIC DELIVERY CHECKLIST PAGE (detect ?checklist=CHECKLIST_ID)
  // ============================================================
  const checklistId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('checklist');
  }, []);

  const checklistCanvasRef = useRef<HTMLCanvasElement>(null);
  const [checklistIsDrawing, setChecklistIsDrawing] = useState(false);
  const [checklistHasSignature, setChecklistHasSignature] = useState(false);
  const [checklistData, setChecklistData] = useState<DeliveryChecklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [checklistSuccess, setChecklistSuccess] = useState(false);
  const [checklistSubmitting, setChecklistSubmitting] = useState(false);
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({});
  const [checklistBattery, setChecklistBattery] = useState('');

  useEffect(() => {
    if (!checklistId) return;
    (async () => {
      try {
        const cl = await getDeliveryChecklist(checklistId);
        setChecklistData(cl);
      } catch { /* ignore */ }
      setChecklistLoading(false);
    })();
  }, [checklistId]);

  const startChecklistSign = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = checklistCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setChecklistIsDrawing(true);
    setChecklistHasSignature(true);
    const { x, y } = getCanvasPoint(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawChecklistSign = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!checklistIsDrawing) return;
    const canvas = checklistCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#10b981';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopChecklistSign = () => setChecklistIsDrawing(false);

  const clearChecklistSign = () => {
    const canvas = checklistCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setChecklistHasSignature(false);
  };

  const allChecklistItemsChecked = DELIVERY_CHECKLIST_CHECKBOX_KEYS.every(k => checklistItems[k]);

  const submitChecklist = async () => {
    const canvas = checklistCanvasRef.current;
    if (!canvas || !checklistData) return;
    if (!allChecklistItemsChecked) {
      alert('Please tick every box to confirm your acceptance.');
      return;
    }
    if (!checklistHasSignature) {
      alert('Please sign before submitting.');
      return;
    }
    setChecklistSubmitting(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const signatureUrl = await uploadChecklistSignature(checklistData.id, dataUrl);
      const payload = { items: checklistItems, battery_level: checklistBattery, signature_url: signatureUrl };
      const ok = await submitDeliveryChecklist(checklistData.id, payload);
      if (!ok) {
        // Row was no longer 'pending' (already submitted) Ã¢ÂÂ do not re-send.
        setChecklistData({ ...checklistData, status: 'completed' });
        setChecklistSubmitting(false);
        return;
      }
      sendDeliveryChecklistCopyEmail(checklistData, payload, checklistData.email_lang);
      setChecklistSuccess(true);
    } catch (err) {
      console.error('Checklist submit failed:', err);
      alert('Error submitting the checklist. Please try again.');
    }
    setChecklistSubmitting(false);
  };

  // Render delivery checklist page if ?checklist= is present (no auth required).
  // The checklist document is always in English (matches the PDF model).
  if (checklistId) {
    return (
      <div className="sign-page">
        <div className="sign-page-card">
          <div className="sign-logo">
            <p style={{ fontSize: '28px', marginBottom: '4px' }}>Ã°ÂÂÂ</p>
            <h2>The Fast Sheep</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>E-Bike Delivery Checklist</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customer Acknowledgement &amp; Liability Waiver</p>
          </div>

          {checklistLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>Ã¢ÂÂ³ Loading checklist...</p>
            </div>
          ) : !checklistData ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: '48px', marginBottom: '12px' }}>Ã¢ÂÂ</p>
              <h3 style={{ marginBottom: '8px' }}>Checklist not found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>This link is invalid or has expired.</p>
            </div>
          ) : checklistSuccess || checklistData.status === 'completed' ? (
            <div className="sign-success">
              <span className="check-icon">Ã¢ÂÂ</span>
              <h3>Checklist submitted successfully!</h3>
              <p>Thank you, {checklistData.customer_name}. Your acceptance has been registered and a copy has been emailed to you.</p>
              <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>This form can no longer be submitted. You can close this window.</p>
            </div>
          ) : (
            <>
              <div className="contract-details">
                {[
                  ['E-Bike Model', checklistData.bike_model || 'Ã¢ÂÂ'],
                  ['E-Bike Serial Number', checklistData.bike_serial || 'Ã¢ÂÂ'],
                  ['Date', checklistData.delivery_date],
                  ['Customer Name', checklistData.customer_name],
                ].map(([label, val]) => (
                  <div key={label} className="detail-row">
                    <span className="detail-label">{label}</span>
                    <span className="detail-value">{val}</span>
                  </div>
                ))}
              </div>

              <div className="checklist-field">
                <label htmlFor="battery-level">Ã°ÂÂÂ Battery Charge Level</label>
                <input
                  id="battery-level"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 100%"
                  value={checklistBattery}
                  onChange={(e) => setChecklistBattery(e.target.value)}
                />
              </div>

              {DELIVERY_CHECKLIST_GROUPS.map(group => (
                <div key={group.key} className="checklist-group">
                  <p className="checklist-group-title">{group.title}</p>
                  {group.kind === 'checkbox'
                    ? group.items.map(item => (
                        <label key={item.key} className={`checklist-item ${checklistItems[item.key] ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!!checklistItems[item.key]}
                            onChange={(e) => setChecklistItems(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          />
                          <span>{item.text}</span>
                        </label>
                      ))
                    : group.items.map(item => (
                        <p key={item.key} className="checklist-declaration">{item.text}</p>
                      ))}
                </div>
              ))}

```

### 7. Excel Backup execution block (downloadBackupXlsx)
```typescript
                      onClick={async () => {
                        setShowSettingsDropdown(false);
                        setBackupRunning(true);
                        showToast(language === 'es' ? 'Ã¢ÂÂ³ Generando backup...' : 'Ã¢ÂÂ³ Generating backup...');
                        try {
                          const bikeMods = await getAllBikeModifications();
                          const filename = downloadBackupXlsx({
                            categories, products, productModels, customers, rentals, rentalItems,
                            payments, sales, saleItems, financingPlans, financingPayments: financingPaymentsData,
                            expenses, records, bikeModifications: bikeMods, leads, leadCategories: leadCats,
                            suppliers, supplierProducts, appAccounts, accountNotes, accountEarnings,
                            platforms, vehicles, transactions: balanceData.txs,
                          });
                          showToast((language === 'es' ? 'Ã¢ÂÂ Backup descargado: ' : 'Ã¢ÂÂ Backup downloaded: ') + filename, 'success');
                        } catch (err) {
                          console.error('Backup failed:', err);
                          showToast(language === 'es' ? 'Error al generar el backup.' : 'Backup failed.', 'error');
                        }
                        setBackupRunning(false);
                      }}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-bright)',
                        padding: '10px 12px',
```

