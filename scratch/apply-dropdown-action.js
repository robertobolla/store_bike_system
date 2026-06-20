import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Normalize line endings to LF
content = content.replace(/\r\n/g, '\n');

// 1. Insert State & Effect
const stateTarget = `  // Prefix / Category modal
  const [pfFormPrefix, setPfFormPrefix] = useState('');`;

const stateReplacement = `  // Prefix / Category modal
  const [openActionMenuBikeId, setOpenActionMenuBikeId] = useState<string | null>(null);
  useEffect(() => {
    const handleDocClick = () => setOpenActionMenuBikeId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const [pfFormPrefix, setPfFormPrefix] = useState('');`;

if (content.includes(stateTarget)) {
  content = content.replace(stateTarget, stateReplacement);
  console.log("SUCCESS: State & Effect inserted!");
} else {
  console.error("ERROR: State Target not found!");
}

// 2. Replace the Requiere Service block with the Actions dropdown
const requiereServiceRegex = /\{status === 'Requiere Service' && \(\s*<div style=\{\{ display: 'flex', gap: '8px' \}\}>\s*<button className="btn-secondary btn-xs"[\s\S]*?<\/button>\s*<\/div>\s*\)\}/;

const requiereServiceReplacement = `{status === 'Requiere Service' && (
                               <div style={{ position: 'relative' }}>
                                 <button className="btn-secondary btn-xs" onClick={(e) => {
                                   e.stopPropagation();
                                   setOpenActionMenuBikeId(openActionMenuBikeId === bike.id ? null : bike.id);
                                 }}>
                                   {language === 'es' ? 'Acciones ▾' : 'Actions ▾'}
                                 </button>
                                 {openActionMenuBikeId === bike.id && (
                                   <div style={{
                                     position: 'absolute',
                                     right: 0,
                                     top: '100%',
                                     marginTop: '4px',
                                     background: 'rgba(25, 25, 35, 0.98)',
                                     border: '1px solid rgba(255, 255, 255, 0.1)',
                                     borderRadius: '8px',
                                     boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                     zIndex: 10,
                                     display: 'flex',
                                     flexDirection: 'column',
                                     minWidth: '160px',
                                     overflow: 'hidden',
                                     backdropFilter: 'blur(8px)'
                                   }}>
                                     <button style={{
                                       background: 'none',
                                       border: 'none',
                                       color: 'var(--text-bright)',
                                       padding: '10px 14px',
                                       textAlign: 'left',
                                       cursor: 'pointer',
                                       fontSize: '13px',
                                       display: 'flex',
                                       alignItems: 'center',
                                       gap: '8px',
                                       transition: 'background 0.2s'
                                     }} 
                                     onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                                     onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setOpenActionMenuBikeId(null);
                                       if (bike.status === 'Rentada') {
                                         showToast(language === 'es' ? 'No es posible realizar un service a un vehículo mientras esté rentado.' : 'Cannot schedule a service for a vehicle while it is rented.', 'error');
                                         return;
                                       }
                                       openServiceModal(bike.id);
                                     }}>
                                       🔧 {language === 'es' ? 'Programar Service' : 'Schedule Service'}
                                     </button>

                                     <button style={{
                                       background: 'none',
                                       border: 'none',
                                       color: 'var(--text-bright)',
                                       padding: '10px 14px',
                                       textAlign: 'left',
                                       cursor: 'pointer',
                                       fontSize: '13px',
                                       display: 'flex',
                                       alignItems: 'center',
                                       gap: '8px',
                                       transition: 'background 0.2s'
                                     }} 
                                     onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                                     onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       setOpenActionMenuBikeId(null);
                                       if (bike.status === 'Rentada') {
                                         showToast(language === 'es' ? 'No es posible ingresar al taller un vehículo mientras esté rentado.' : 'Cannot put a vehicle in the workshop while it is rented.', 'error');
                                         return;
                                       }
                                       try {
                                         const todayStr = new Date().toISOString().split('T')[0];
                                         
                                         // Find and update the scheduled service record date to today (actual check-in date)
                                         const record = records.find(r => r.bike_id === bike.id && r.service_date === bike.next_service_date);
                                         if (record) {
                                           await upsertRecord({
                                             ...record,
                                             service_date: todayStr
                                           });
                                           
                                           // Mark the associated calendar event as completed (Realizado) and update its date
                                           const existingEv = events.find(ev => ev.description.includes(\`Service ID: \${record.id}\`) && !ev.description.includes('Recordatorio personalizado'));
                                           if (existingEv) {
                                             await upsertEvent({
                                               ...existingEv,
                                               event_date: todayStr,
                                               status: 'Realizado'
                                             });
                                           }
                                         } else {
                                           // If no scheduled record exists, create a check-in record now!
                                           await upsertRecord({
                                             id: crypto.randomUUID(),
                                             bike_id: bike.id,
                                             service_date: todayStr,
                                             location: 'Dublin Central Garage',
                                             description: language === 'es' ? 'Ingreso directo a taller / Revisión general' : 'Direct check-in to workshop / General review',
                                             cost: 0,
                                             performed_by: 'Mechanic Sean'
                                           });
                                         }

                                         await upsertProduct({
                                           ...bike,
                                           maintenance_status: 'En Taller',
                                           status: 'Mantenimiento',
                                           last_service_date: todayStr,
                                           next_service_date: null
                                         });
                                         triggerReload();
                                         showToast(language === 'es' ? \`\${bike.serial_number} ingresada al taller.\` : \`\${bike.serial_number} entered workshop.\`, 'success');
                                       } catch {
                                         showToast('Error.', 'error');
                                       }
                                     }}>
                                       🧰 {language === 'es' ? 'Ingresar al Taller' : 'Enter Shop'}
                                     </button>

                                     <button style={{
                                       background: 'none',
                                       border: 'none',
                                       color: '#f87171',
                                       padding: '10px 14px',
                                       textAlign: 'left',
                                       cursor: 'pointer',
                                       fontSize: '13px',
                                       display: 'flex',
                                       alignItems: 'center',
                                       gap: '8px',
                                       borderTop: '1px solid rgba(255,255,255,0.06)',
                                       transition: 'background 0.2s'
                                     }} 
                                     onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                                     onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       setOpenActionMenuBikeId(null);
                                       try {
                                         const confirmMsg = language === 'es'
                                           ? '¿Cancelar la solicitud de service para este vehículo?'
                                           : 'Cancel the service request for this vehicle?';
                                         if (!await asyncConfirm(confirmMsg)) return;

                                         if (bike.next_service_date) {
                                           const record = records.find(r => r.bike_id === bike.id && r.service_date === bike.next_service_date);
                                           if (record) {
                                             await deleteRecord(record.id);
                                             const assocEvents = events.filter(ev => ev.description && ev.description.includes(\`Service ID: \${record.id}\`));
                                             for (const ev of assocEvents) {
                                               await deleteEvent(ev.id);
                                             }
                                           }
                                         }

                                         await upsertProduct({
                                           ...bike,
                                           maintenance_status: 'Al día',
                                           next_service_date: null,
                                           status: 'Disponible'
                                         });
                                         triggerReload();
                                         showToast(language === 'es' ? 'Requerimiento de service cancelado.' : 'Service request canceled.', 'success');
                                       } catch { showToast('Error.', 'error'); }
                                     }}>
                                       ✕ {language === 'es' ? 'Cancelar Solicitud' : 'Cancel Request'}
                                     </button>
                                   </div>
                                 )}
                               </div>
                             )}`;

if (requiereServiceRegex.test(content)) {
  content = content.replace(requiereServiceRegex, requiereServiceReplacement);
  console.log("SUCCESS: Replaced Requiere Service block!");
} else {
  console.error("ERROR: Requiere Service pattern not found via Regex");
}

// Convert back to CRLF
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf-8');
console.log("File saved!");
