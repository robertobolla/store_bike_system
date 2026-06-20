import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Normalize line endings to LF (\n) to avoid CRLF mismatch on Windows
content = content.replace(/\r\n/g, '\n');

// Target 1: En Taller block and insert Recién Revisada undo button after it
const targetEnTaller = `                               {status === 'En Taller' && (
                                 <button className="btn-primary btn-xs" onClick={async () => {
                                   try {
                                     const todayStr = new Date().toISOString().split('T')[0];
                                     
                                     // Ensure we have a record in the maintenance timeline when finalizing service
                                     const record = records.find(r => r.bike_id === bike.id && r.service_date === bike.last_service_date);
                                     if (!record) {
                                       await upsertRecord({
                                         id: crypto.randomUUID(),
                                         bike_id: bike.id,
                                         service_date: todayStr,
                                         location: 'Dublin Central Garage',
                                         description: language === 'es' ? 'Mantenimiento finalizado / Puesta a punto' : 'Maintenance finished / Fine-tuning',
                                         cost: 0,
                                         performed_by: 'Mechanic Sean'
                                       });
                                     }

                                     await upsertProduct({ 
                                       ...bike, 
                                       maintenance_status: 'Al día', 
                                       status: 'Disponible',
                                       last_service_date: todayStr
                                     });
                                     triggerReload(); showToast(\`\${bike.serial_number} marcada como lista.\`, 'success');
                                   } catch { showToast('Error.', 'error'); }
                                 }}>✓ {language === 'es' ? 'Finalizar Service' : 'Finish Service'}</button>
                               )}`;

const replacementEnTaller = `                               {status === 'En Taller' && (
                                 <div style={{ display: 'flex', gap: '8px' }}>
                                   <button className="btn-primary btn-xs" onClick={async () => {
                                     try {
                                       const todayStr = new Date().toISOString().split('T')[0];
                                       
                                       // Ensure we have a record in the maintenance timeline when finalizing service
                                       const record = records.find(r => r.bike_id === bike.id && r.service_date === bike.last_service_date);
                                       if (!record) {
                                         await upsertRecord({
                                           id: crypto.randomUUID(),
                                           bike_id: bike.id,
                                           service_date: todayStr,
                                           location: 'Dublin Central Garage',
                                           description: language === 'es' ? 'Mantenimiento finalizado / Puesta a punto' : 'Maintenance finished / Fine-tuning',
                                           cost: 0,
                                           performed_by: 'Mechanic Sean'
                                         });
                                       }

                                       await upsertProduct({ 
                                         ...bike, 
                                         maintenance_status: 'Al día', 
                                         status: 'Disponible',
                                         last_service_date: todayStr
                                       });
                                       triggerReload(); showToast(\`\${bike.serial_number} marcada como lista.\`, 'success');
                                     } catch { showToast('Error.', 'error'); }
                                   }}>✓ {language === 'es' ? 'Finalizar Service' : 'Finish Service'}</button>
                                   <button className="btn-secondary btn-xs" onClick={async () => {
                                     try {
                                       const confirmMsg = language === 'es' 
                                         ? '¿Cancelar el ingreso al taller de esta bicicleta?' 
                                         : 'Cancel workshop entry for this bicycle?';
                                       if (!await asyncConfirm(confirmMsg)) return;
                                       
                                       const todayStr = new Date().toISOString().split('T')[0];
                                       // Find and delete the record created today for this bike
                                       const recentRec = records.find(r => r.bike_id === bike.id && r.service_date === todayStr);
                                       if (recentRec) {
                                         await deleteRecord(recentRec.id);
                                         const assocEvents = events.filter(ev => ev.description && ev.description.includes(\`Service ID: \${recentRec.id}\`));
                                         for (const ev of assocEvents) {
                                           await deleteEvent(ev.id);
                                         }
                                       }
                                       
                                       await upsertProduct({
                                         ...bike,
                                         maintenance_status: 'Requiere Service',
                                         status: 'Disponible',
                                         next_service_date: todayStr
                                       });
                                       triggerReload();
                                       showToast(language === 'es' ? 'Ingreso al taller cancelado.' : 'Workshop entry canceled.', 'success');
                                     } catch { showToast('Error.', 'error'); }
                                   }} title={language === 'es' ? 'Cancelar ingreso y volver a Requiere Service' : 'Cancel entry and return to Service Due'}>✕</button>
                                 </div>
                               )}
                               {status === 'Recién Revisada' && (
                                 <button className="btn-secondary btn-xs" onClick={async () => {
                                   try {
                                     const confirmMsg = language === 'es'
                                       ? '¿Deshacer la finalización del service y devolver la bicicleta al taller?'
                                       : 'Undo service completion and return the bicycle to the workshop?';
                                     if (!await asyncConfirm(confirmMsg)) return;

                                     await upsertProduct({
                                       ...bike,
                                       maintenance_status: 'En Taller',
                                       status: 'Mantenimiento'
                                     });
                                     triggerReload();
                                     showToast(language === 'es' ? 'Finalización cancelada. Devuelta al taller.' : 'Completion canceled. Returned to workshop.', 'success');
                                   } catch { showToast('Error.', 'error'); }
                                 }}>↩️ {language === 'es' ? 'Deshacer' : 'Undo'}</button>
                               )}`;

// Target 2: Requiere Service block with cancel button
const targetRequiereService = `                             {status === 'Requiere Service' && (
                               <div style={{ display: 'flex', gap: '8px' }}>
                                 <button className="btn-secondary btn-xs" onClick={() => {
                                   if (bike.status === 'Rentada') {
                                     showToast(language === 'es' ? 'No es posible realizar un service a un vehículo mientras esté rentado.' : 'Cannot schedule a service for a vehicle while it is rented.', 'error');
                                     return;
                                   }
                                   openServiceModal(bike.id);
                                 }}>🔧 Service</button>
                                 <button className="btn-primary btn-xs" onClick={async () => {
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
                                       const existingEv = events.find(e => e.description.includes(\`Service ID: \${record.id}\`) && !e.description.includes('Recordatorio personalizado'));
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
                                 }}>🧰 {language === 'es' ? 'Ingresar al Taller' : 'Enter Shop'}</button>
                               </div>
                             )}`;

const replacementRequiereService = `                             {status === 'Requiere Service' && (
                               <div style={{ display: 'flex', gap: '8px' }}>
                                 <button className="btn-secondary btn-xs" onClick={() => {
                                   if (bike.status === 'Rentada') {
                                     showToast(language === 'es' ? 'No es posible realizar un service a un vehículo mientras esté rentado.' : 'Cannot schedule a service for a vehicle while it is rented.', 'error');
                                     return;
                                   }
                                   openServiceModal(bike.id);
                                 }}>🔧 Service</button>
                                 <button className="btn-primary btn-xs" onClick={async () => {
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
                                       const existingEv = events.find(e => e.description.includes(\`Service ID: \${record.id}\`) && !e.description.includes('Recordatorio personalizado'));
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
                                 }}>🧰 {language === 'es' ? 'Ingresar al Taller' : 'Enter Shop'}</button>
                                 <button className="btn-danger btn-xs" style={{ padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={async () => {
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
                                 }} title={language === 'es' ? 'Cancelar service y volver a Disponible' : 'Cancel service and return to Available'}>✕</button>
                               </div>
                             )}`;

let changed = false;

if (content.includes(targetEnTaller)) {
  content = content.replace(targetEnTaller, replacementEnTaller);
  changed = true;
  console.log("SUCCESS: Applied replacement En Taller + Recién Revisada!");
} else {
  console.error("ERROR: Target En Taller NOT found!");
}

if (content.includes(targetRequiereService)) {
  content = content.replace(targetRequiereService, replacementRequiereService);
  changed = true;
  console.log("SUCCESS: Applied replacement Requiere Service!");
} else {
  console.error("ERROR: Target Requiere Service NOT found!");
}

if (changed) {
  // Convert back to Windows line endings
  content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("File saved successfully!");
}
