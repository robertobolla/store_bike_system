import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const target = `                                    // Find and update the scheduled service record date to today (actual check-in date)
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
                                    }`;

const replacement = `                                    // Find and update the scheduled service record date to today (actual check-in date)
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
                                    }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("SUCCESS: Replaced check-in logic successfully!");
} else {
  console.error("ERROR: Target string not found in App.tsx");
}
