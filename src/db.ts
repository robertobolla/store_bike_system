// db.ts – The Fast Sheep: Async Supabase Data Layer
// localStorage has been completely removed.
// All data operations are async via Supabase as the single source of truth.

import { supabase } from './supabaseClient';

// ================================================================
// TYPESCRIPT INTERFACES
// ================================================================

export interface SerialPrefix {
  id: string;
  prefix: string;
  description: string;
  category_id?: string | null;
}

export interface Category {
  id: string;
  name_es: string;
  name_en: string;
  is_deletable: boolean;
}

export interface CustomFieldDefinition {
  id: string;
  category_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'boolean';
}

export interface Product {
  id: string;
  model_id: string | null;
  serial_number: string;
  prefix_id: string | null;
  name: string;
  category_id: string;
  price_paid: number;
  price_sold: number | null;
  sold_date: string | null;
  status: 'Disponible' | 'Rentada' | 'Mantenimiento' | 'Vendida' | 'Perdida' | 'Financiada' | 'Robada' | 'Perdida/Garda' | 'Uso Interno';
  notes: string;
  suggested_weekly_rate: number | null;
  suggested_deposit: number | null;
  odometer: number;
  frame_serial: string | null;
  motor_brand: string | null;
  battery_capacity: string | null;
  wheel_size: string | null;
  brand: string | null;
  model: string | null;
  battery_serial: string | null;
  purchase_date: string | null;
  arrival_date: string | null;
  key_number: string | null;
  factory_claim: boolean;
  factory_claim_notes: string | null;
  maintenance_status: 'Al día' | 'Requiere Service' | 'En Taller';
  last_service_date: string | null;
  last_service_location: string | null;
  next_service_date: string | null;
  next_service_odometer: number | null;
  odometer_last_updated: string | null;
  remind_service_one_week: boolean;
  remind_service_one_day: boolean;
  remind_service_odometer_threshold: number;
  custom_field_values: Record<string, unknown>;
  image_url: string | null;
  date_added: string;
  condition?: 'nuevo' | 'bueno' | 'regular' | 'para venta';
  color?: string | null;
}

export interface Customer {
  id: string;
  customer_code: string;
  first_name: string;
  last_name: string;
  email: string;
  // Opcional: las filas anteriores a la migracion no traen direccion.
  address?: string;
  phone: string;
  id_document_url: string;
  referral_source: string;
  nationality: string;
  notes: string;
  created_at: string;
}

// Frozen copy of the "RENTAL DETAILS" block of the contract, taken when the
// signing link is generated. Mirrors page 1 of the signed PDF agreement.
export interface RentalContractSnapshot {
  lessee_name: string;
  lessee_address: string;
  lessee_phone: string;
  lessee_email: string;
  email_lang: 'es' | 'en' | 'pt';
  bike_brand_model: string;
  // Numero de serie real del fabricante (products.frame_serial), que es el que
  // identifica legalmente la bici. bike_ref es el codigo interno de inventario.
  bike_serial: string;
  bike_ref: string;
  start_date: string;
  payment_due_weekday: string;
  rate_amount: number;
  rate_type: 'diario' | 'semanal' | 'mensual';
  deposit_amount: number;
  battery_count: number;
}

export interface Rental {
  id: string;
  bike_id: string;
  customer_id: string;
  has_insurance: boolean;
  deposit_amount: number;
  rental_rate: number;
  rate_type: 'diario' | 'semanal' | 'mensual';
  start_date: string;
  end_date: string | null;
  scheduled_return_date: string;
  return_notice_date: string | null;
  odometer_start: number;
  odometer_end: number | null;
  status: 'Activo' | 'Devolución en Proceso' | 'Inactivo';
  contract_type: 'photo' | 'digital';
  contract_url: string | null;
  // Digital rental contract (?firmar= page). The snapshot freezes the rental
  // details shown at signing time so later rate changes never alter what was signed.
  contract_snapshot?: RentalContractSnapshot | null;
  contract_signed_at?: string | null;
  contract_image_consent?: boolean | null;
  condition_photos: string[];
  return_photos?: string[];
  instagram_photos?: string[];
  has_kit: boolean;
  kit_details: string;
  deposit_refunded: number | null;
  damage_report: string | null;
  created_at: string;
  deposit_received_via?: string | null;
  // Codigo visible del alquiler (RNT-2026-0001). Es lo que enlaza sus
  // facturas, recibos de deposito y notas de credito entre si.
  rental_code?: string | null;
  // Facturacion semanal automatica. next_invoice_date es la proxima
  // fecha de cobro; el cron diario emite la factura de quien vence hoy.
  auto_invoice?: boolean;
  next_invoice_date?: string | null;
}

export interface RentalItem {
  id: string;
  rental_id: string;
  product_id: string;
  item_type: 'battery' | 'kit_accessory';
}

// Un cambio concreto recogido en un anexo: "Weekly Rental Fee: 80.5 -> 70".
export interface AmendmentChange {
  label: string;
  before: string;
  after: string;
}

// Anexo firmable al contrato. El contrato original nunca se modifica: cada
// cambio de condiciones genera un anexo numerado que lo referencia.
export interface RentalContractAmendment {
  id: string;
  rental_id: string;
  number: number;
  effective_date: string;
  changes: AmendmentChange[];
  snapshot_after: RentalContractSnapshot | null;
  note: string | null;
  customer_name: string;
  customer_email: string;
  email_lang: 'es' | 'en' | 'pt';
  status: 'pending' | 'signed';
  signature_url: string | null;
  signed_at: string | null;
  created_at: string;
}

// Tramo en el que una bici concreta estuvo asignada a un alquiler.
// to_date null = tramo vigente.
export interface RentalBikeAssignment {
  id: string;
  rental_id: string;
  product_id: string;
  from_date: string;
  to_date: string | null;
  created_at: string;
}

export interface RentalPayment {
  id: string;
  rental_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  received_via?: string;
}

export interface MaintenanceExpense {
  id: string;
  product_id: string;
  description: string;
  cost: number;
  date: string;
  rental_id: string | null;
  photos?: string[];
}

export interface LeadCategory {
  id: string;
  name_es: string;
  name_en: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  category_id: string | null;
  interested_in: string;
  notes: string;
  status: 'Nuevo' | 'Contactado' | 'Convertido' | 'Perdido';
  follow_up_date: string | null;
  follow_up_action: string | null;
  follow_up_completed: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  notes: string;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  name: string;
  category: 'Bicicleta' | 'Batería' | 'Repuesto' | 'Accesorio';
  cost: number;
  moq: number;
  delivery_time_days: number;
  specs: string;
  product_url: string;
}

export interface AppPlatform {
  id: string;
  name: string;
}

export interface AppVehicleType {
  id: string;
  name: string;
}

export interface AppAccount {
  id: string;
  platform_id: string;
  vehicle_type_id: string;
  platform_account_number: string;
  owner_name: string;
  username: string;
  password: string;
  email: string;
  bank_details: string;
  weekly_rate: number;
  start_date: string | null;
  end_date: string | null;
  current_renter_id: string | null;
  status: 'Activa' | 'Inactiva';
}

export interface AppAccountNote {
  id: string;
  account_id: string;
  note: string;
  date: string;
  created_at: string;
}

export interface AppAccountEarning {
  id: string;
  account_id: string;
  amount: number;
  date: string;
  notes: string;
}

export interface CompanyEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  remind_one_week: boolean;
  remind_one_day: boolean;
  status: 'Pendiente' | 'Realizado';
}

export interface MaintenanceRecord {
  id: string;
  bike_id: string;
  service_date: string;
  location: string;
  description: string;
  cost: number;
  performed_by: string;
}

export interface ProductModel {
  id: string;
  category_id: string;
  prefix_id: string | null;
  brand: string;
  model_name: string;
  suggested_weekly_rate: number;
  suggested_deposit: number;
  motor_brand: string | null;
  battery_capacity: string | null;
  wheel_size: string | null;
  image_url: string | null;
  color?: string | null;
}

export interface Sale {
  id: string;
  customer_id: string | null;
  sale_date: string;
  payment_type: 'contado' | 'financiado';
  total_amount: number;
  down_payment: number;
  email_language: 'es' | 'en' | 'pt';
  notes: string;
  status: 'Completada' | 'Financiada' | 'Cancelada';
  created_at: string;
  received_via?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  unit_price: number;
}

export interface FinancingPlan {
  id: string;
  sale_id: string;
  total_financed: number;
  num_installments: number;
  installment_amount: number;
  payment_frequency: 'semanal' | 'mensual';
  start_date: string;
  status: 'Activo' | 'Completado' | 'Cancelado';
  created_at: string;
}

export interface FinancingPayment {
  id: string;
  financing_plan_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'Pendiente' | 'Pagada' | 'Vencida';
  created_at: string;
  received_via?: string;
}

// ================================================================
// ROI CALCULATION (pure utility – no DB access needed)
// ================================================================

export function calculateProductROI(
  productId: string,
  products: Product[],
  categories: Category[],
  rentals: Rental[],
  rentalItems: RentalItem[],
  payments: RentalPayment[],
  expenses: MaintenanceExpense[],
  records: MaintenanceRecord[],
  // Historial de asignacion. Si se omite, se atribuye como antes: todo el
  // alquiler a su bici actual.
  assignments: RentalBikeAssignment[] = []
): { roi: number; totalPaid: number; totalExp: number; cost: number; soldPrice: number } {
  const prod = products.find(p => p.id === productId);
  if (!prod) return { roi: 0, totalPaid: 0, totalExp: 0, cost: 0, soldPrice: 0 };

  const cost = prod.price_paid || 0;
  const soldPrice = prod.status === 'Vendida' ? (prod.price_sold || 0) : 0;

  const cat = categories.find(c => c.id === prod.category_id);
  const catName = cat?.name_es ?? '';

  const associatedRentalIds = new Set<string>();
  rentals.forEach(r => { if (r.bike_id === productId) associatedRentalIds.add(r.id); });
  rentalItems.forEach(ri => { if (ri.product_id === productId) associatedRentalIds.add(ri.rental_id); });
  // Tras un cambio de bici, rentals.bike_id apunta a la nueva: sin esto la bici
  // saliente perderia los cobros de su tramo.
  assignments.forEach(a => { if (a.product_id === productId) associatedRentalIds.add(a.rental_id); });

  // Todos los tramos de cada alquiler, ordenados por fecha.
  const allSpansByRental = new Map<string, RentalBikeAssignment[]>();
  assignments.forEach(a => {
    const list = allSpansByRental.get(a.rental_id) ?? [];
    list.push(a);
    allSpansByRental.set(a.rental_id, list);
  });
  allSpansByRental.forEach(list => list.sort((x, y) => x.from_date.localeCompare(y.from_date)));

  // Un cobro pertenece a la bici que estaba asignada el dia del cobro. No se
  // prorratea: la semana ya cobrada queda entera para la bici que se usaba.
  //
  // Si el alquiler nunca cambio de bici hay un solo tramo, y entonces no se
  // filtra por fecha: cualquier cobro es suyo. Asi un pago atrasado, o hecho el
  // mismo dia del cierre, no se pierde. El filtrado solo entra en juego cuando
  // hubo un cambio de bici, que es cuando hay algo que repartir.
  const paymentBelongsHere = (rentalId: string, date: string): boolean => {
    const spans = allSpansByRental.get(rentalId);
    if (!spans || spans.length === 0) return true;  // sin historial: como antes
    if (spans.length === 1) return spans[0].product_id === productId;
    // Con varios tramos, los extremos se abren para no dejar cobros huerfanos.
    const idx = spans.findIndex((s, i) => {
      const startsBefore = i === 0 || date >= s.from_date;
      const endsAfter = i === spans.length - 1 || !s.to_date || date < s.to_date;
      return startsBefore && endsAfter;
    });
    return idx >= 0 && spans[idx].product_id === productId;
  };

  let totalPaid = 0;
  if (catName === 'Bicicleta') {
    payments.forEach(p => {
      if (associatedRentalIds.has(p.rental_id) && paymentBelongsHere(p.rental_id, p.payment_date)) {
        totalPaid += p.amount;
      }
    });

    rentals.forEach(r => {
      if (associatedRentalIds.has(r.id)) {
        const retained = r.deposit_amount - (r.deposit_refunded || 0);
        // El deposito retenido cubre danos al devolver, asi que se imputa a la
        // bici que tenia el rider al cerrar el alquiler.
        const closingDate = r.end_date || r.scheduled_return_date || r.start_date;
        if (retained > 0 && paymentBelongsHere(r.id, closingDate)) {
          totalPaid += retained;
        }
      }
    });
  }

  let totalExp = 0;
  expenses.forEach(e => { if (e.product_id === productId) totalExp += e.cost; });
  records.forEach(r => {
    if (r.bike_id === productId) {
      // Check if this record is upcoming/preventative and hasn't actually checked into the shop yet
      const bike = products.find(p => p.id === r.bike_id);
      if (bike && bike.maintenance_status === 'Requiere Service' && r.service_date === bike.next_service_date) {
        return;
      }
      totalExp += r.cost;
    }
  });

  const earnings = totalPaid + soldPrice - totalExp - cost;
  const roi = cost > 0 ? (earnings / cost) * 100 : 0;

  return {
    roi: Math.round(roi * 10) / 10,
    totalPaid: Math.round(totalPaid),
    totalExp: Math.round(totalExp),
    cost,
    soldPrice,
  };
}

// ================================================================
// PRODUCT MAPPING HELPERS (products JOIN product_models)
// ================================================================

function mapRowToProduct(row: Record<string, unknown>): Product {
  const pm = row.product_models as Record<string, unknown> | null;
  let brand = (pm?.brand as string) ?? null;
  let modelColor = null;
  if (brand && brand.includes('#')) {
    const parts = brand.split('#');
    brand = parts[0];
    modelColor = '#' + parts[1];
  }
  const modelName = (pm?.model_name as string) ?? null;
  const name =
    brand && modelName ? `${brand} ${modelName}`.trim()
    : brand || modelName || (row.serial_number as string) || 'Unknown';

  return {
    id: row.id as string,
    model_id: (row.model_id as string) ?? null,
    serial_number: row.serial_number as string,
    prefix_id: (row.prefix_id as string) ?? null,
    name,
    category_id: (pm?.category_id as string) ?? '',
    price_paid: (row.price_paid as number) ?? 0,
    price_sold: (row.price_sold as number) ?? null,
    sold_date: (row.sold_date as string) ?? null,
    status: (row.status as Product['status']) ?? 'Disponible',
    notes: (row.notes as string) ?? '',
    suggested_weekly_rate: (pm?.suggested_weekly_rate as number) ?? null,
    suggested_deposit: (pm?.suggested_deposit as number) ?? null,
    odometer: (row.odometer as number) ?? 0,
    frame_serial: (row.frame_serial as string) ?? null,
    motor_brand: (row.motor_brand as string) ?? (pm?.motor_brand as string) ?? null,
    battery_capacity: (pm?.battery_capacity as string) ?? null,
    wheel_size: (pm?.wheel_size as string) ?? null,
    brand,
    model: modelName,
    battery_serial: (row.battery_serial as string) ?? null,
    purchase_date: (row.purchase_date as string) ?? null,
    arrival_date: (row.arrival_date as string) ?? null,
    key_number: (row.key_number as string) ?? null,
    factory_claim: (row.factory_claim as boolean) ?? false,
    factory_claim_notes: (row.factory_claim_notes as string) ?? null,
    maintenance_status: (() => {
      let dbStatus = (row.maintenance_status as Product['maintenance_status']) ?? 'Al día';
      if (dbStatus === 'Al día') {
        const lastServiceDateStr = row.last_service_date as string | null;
        if (lastServiceDateStr) {
          const lastServiceDate = new Date(lastServiceDateStr);
          if (!isNaN(lastServiceDate.getTime())) {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            if (lastServiceDate <= threeMonthsAgo) {
              return 'Requiere Service';
            }
          }
        } else {
          // Check: 3 months from assembly date
          const customFieldValues = (row.custom_field_values as Record<string, unknown>) ?? {};
          const assemblyDateStr = customFieldValues?.assembly_date as string | null;
          if (assemblyDateStr) {
            const assemblyDate = new Date(assemblyDateStr);
            if (!isNaN(assemblyDate.getTime())) {
              const threeMonthsAgo = new Date();
              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
              if (assemblyDate <= threeMonthsAgo) {
                return 'Requiere Service';
              }
            }
          }
        }
      }
      return dbStatus;
    })(),
    last_service_date: (row.last_service_date as string) ?? null,
    last_service_location: (row.last_service_location as string) ?? null,
    next_service_date: (row.next_service_date as string) ?? null,
    next_service_odometer: (row.next_service_odometer as number) ?? null,
    odometer_last_updated: (row.odometer_last_updated as string) ?? null,
    remind_service_one_week: (row.remind_service_one_week as boolean) ?? true,
    remind_service_one_day: (row.remind_service_one_day as boolean) ?? true,
    remind_service_odometer_threshold: (row.remind_service_odometer_threshold as number) ?? 50,
    custom_field_values: (row.custom_field_values as Record<string, unknown>) ?? {},
    image_url: (row.image_url as string) ?? (pm?.image_url as string) ?? null,
    date_added: (row.date_added as string) ?? new Date().toISOString(),
    condition: (() => {
      const odometer = (row.odometer as number) ?? 0;
      const customFields = (row.custom_field_values as Record<string, unknown>) ?? {};
      const manualOdo = typeof customFields.manual_condition_odometer === 'number' ? customFields.manual_condition_odometer : null;
      if (odometer >= 5000 && (manualOdo === null || manualOdo < 5000)) {
        return 'para venta';
      }
      return (customFields.condition as any) || 'bueno';
    })(),
    color: ((row.custom_field_values as Record<string, unknown>)?.color as string) ?? modelColor,
  };
}

async function findOrCreateProductModel(p: Product): Promise<string | null> {
  if (!p.category_id) return null;
  if ((p as any).model_id) return (p as any).model_id;

  const brand = p.brand || (p.name ? p.name.split(' ')[0] : 'Unknown');
  const modelName =
    p.model !== undefined && p.model !== null ? p.model : (p.name ? p.name.split(' ').slice(1).join(' ') || p.name : 'Model');

  // Search both with and without color suffix
  const { data: existing, error: fetchErr } = await supabase
    .from('product_models')
    .select('id')
    .eq('category_id', p.category_id)
    .like('brand', `${brand}%`)
    .eq('model_name', modelName)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  if (existing?.id) {
    await supabase
      .from('product_models')
      .update({
        suggested_weekly_rate: p.suggested_weekly_rate ?? 0,
        suggested_deposit: p.suggested_deposit ?? 0,
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error: createErr } = await supabase
    .from('product_models')
    .insert({
      category_id: p.category_id,
      brand,
      model_name: modelName,
      suggested_weekly_rate: p.suggested_weekly_rate ?? 0,
      suggested_deposit: p.suggested_deposit ?? 0,
    })
    .select('id')
    .single();

  if (createErr) throw createErr;
  return created.id as string;
}

// ================================================================
// SERIAL PREFIXES
// ================================================================

export async function getPrefixes(): Promise<SerialPrefix[]> {
  const { data, error } = await supabase.from('serial_prefixes').select('*').order('prefix');
  if (error) throw error;
  const pfs = (data ?? []) as SerialPrefix[];

  // Auto-seed default prefixes if table is empty
  if (pfs.length === 0) {
    const defaults = [
      { prefix: 'B-',   description: 'Bicicletas / E-Bikes' },
      { prefix: 'BAT-', description: 'Baterías de Litio' },
      { prefix: 'L-',   description: 'Candados de Seguridad' },
    ];
    const { data: seeded, error: seedErr } = await supabase
      .from('serial_prefixes')
      .insert(defaults)
      .select('*');
    if (seedErr) throw seedErr;
    return (seeded ?? []) as SerialPrefix[];
  }

  return pfs;
}

export async function upsertPrefix(p: SerialPrefix): Promise<void> {
  try {
    const { error } = await supabase
      .from('serial_prefixes')
      .upsert({ 
        id: p.id, 
        prefix: p.prefix, 
        description: p.description, 
        category_id: p.category_id || null 
      });
    if (error) throw error;
  } catch (err: any) {
    if (err.message && err.message.includes('category_id')) {
      const { error } = await supabase
        .from('serial_prefixes')
        .upsert({ 
          id: p.id, 
          prefix: p.prefix, 
          description: p.description 
        });
      if (error) throw error;
    } else {
      throw err;
    }
  }
}

export async function deletePrefix(id: string): Promise<void> {
  const { error } = await supabase.from('serial_prefixes').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// CATEGORIES
// ================================================================

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name_es');
  if (error) throw error;
  const cats = (data ?? []) as Category[];

  // Auto-seed default categories if table is empty
  if (cats.length === 0) {
    const defaults = [
      { name_es: 'Bicicleta', name_en: 'Bicycle', is_deletable: false },
      { name_es: 'Batería', name_en: 'Battery', is_deletable: false },
      { name_es: 'Candado', name_en: 'Lock', is_deletable: true },
      { name_es: 'Accesorios', name_en: 'Accessories', is_deletable: true },
    ];
    const { data: seeded, error: seedErr } = await supabase
      .from('categories')
      .insert(defaults)
      .select('*');
    if (seedErr) throw seedErr;
    return (seeded ?? []) as Category[];
  }

  return cats;
}

export async function upsertCategory(c: Category): Promise<void> {
  const { error } = await supabase.from('categories').upsert(c);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// CUSTOM FIELD DEFINITIONS
// ================================================================

export async function getCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
  const { data, error } = await supabase.from('custom_field_definitions').select('*');
  if (error) throw error;
  return (data ?? []) as CustomFieldDefinition[];
}

export async function upsertCustomFieldDefinition(def: CustomFieldDefinition): Promise<void> {
  const { error } = await supabase.from('custom_field_definitions').upsert(def);
  if (error) throw error;
}

export async function deleteCustomFieldDefinition(id: string): Promise<void> {
  const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// PRODUCTS
// ================================================================

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_models(*)')
    .order('serial_number');
  if (error) throw error;
  return (data ?? []).map(row => mapRowToProduct(row as Record<string, unknown>));
}

export async function upsertProduct(p: Product): Promise<void> {
  const modelId = await findOrCreateProductModel(p);
  const { error } = await supabase.from('products').upsert({
    id: p.id,
    model_id: modelId,
    serial_number: p.serial_number,
    prefix_id: p.prefix_id,
    price_paid: p.price_paid,
    price_sold: p.price_sold,
    sold_date: p.sold_date,
    status: p.status,
    notes: p.notes,
    odometer: p.odometer,
    frame_serial: p.frame_serial,
    motor_brand: p.motor_brand,
    battery_serial: p.battery_serial,
    key_number: p.key_number,
    purchase_date: p.purchase_date,
    arrival_date: p.arrival_date,
    factory_claim: p.factory_claim,
    factory_claim_notes: p.factory_claim_notes,
    maintenance_status: p.maintenance_status,
    last_service_date: p.last_service_date,
    last_service_location: p.last_service_location,
    next_service_date: p.next_service_date,
    next_service_odometer: p.next_service_odometer,
    odometer_last_updated: p.odometer_last_updated,
    remind_service_one_week: p.remind_service_one_week,
    remind_service_one_day: p.remind_service_one_day,
    remind_service_odometer_threshold: p.remind_service_odometer_threshold,
    custom_field_values: {
      ...p.custom_field_values,
      condition: p.condition || 'bueno',
      color: p.color || null,
    },
    image_url: p.image_url,
    date_added: p.date_added,
  });
  if (error) throw error;
}

export async function batchInsertProducts(products: Product[]): Promise<void> {
  if (products.length === 0) return;
  
  let resolvedModelId = products[0].model_id;
  if (!resolvedModelId) {
    resolvedModelId = await findOrCreateProductModel(products[0]);
  }

  const rows = products.map(p => ({
    id: p.id,
    model_id: resolvedModelId,
    serial_number: p.serial_number,
    prefix_id: p.prefix_id,
    price_paid: p.price_paid,
    price_sold: p.price_sold,
    sold_date: p.sold_date,
    status: p.status,
    notes: p.notes,
    odometer: p.odometer,
    frame_serial: p.frame_serial,
    motor_brand: p.motor_brand,
    battery_serial: p.battery_serial,
    key_number: p.key_number,
    purchase_date: p.purchase_date,
    arrival_date: p.arrival_date,
    factory_claim: p.factory_claim,
    factory_claim_notes: p.factory_claim_notes,
    maintenance_status: p.maintenance_status,
    last_service_date: p.last_service_date,
    last_service_location: p.last_service_location,
    next_service_date: p.next_service_date,
    next_service_odometer: p.next_service_odometer,
    odometer_last_updated: p.odometer_last_updated,
    remind_service_one_week: p.remind_service_one_week,
    remind_service_one_day: p.remind_service_one_day,
    remind_service_odometer_threshold: p.remind_service_odometer_threshold,
    custom_field_values: {
      ...p.custom_field_values,
      condition: p.condition || 'bueno'
    },
    image_url: p.image_url,
    date_added: p.date_added,
  }));

  const { error } = await supabase.from('products').insert(rows);
  if (error) throw error;
}


export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${productId}/photo_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Upload bike condition photos for a rental
export async function uploadRentalPhoto(rentalId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `rentals/${rentalId}/condition_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('rental-photos')
    .upload(filePath, file, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage
    .from('rental-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Upload rider passport / ID document photo
export async function uploadRiderDocument(customerId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `riders/${customerId}/id_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('rider-documents')
    .upload(filePath, file, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage
    .from('rider-documents')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Upload physical contract photo for a rental
export async function uploadContractPhoto(rentalId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `rentals/${rentalId}/contract_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('rental-photos')
    .upload(filePath, file, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage
    .from('rental-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Upload digital signature image (from canvas toDataURL)
export async function uploadSignatureImage(rentalId: string, dataUrl: string): Promise<string> {
  // Convert data URL to Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const filePath = `rentals/${rentalId}/signature_${Date.now()}.png`;

  const { error: uploadErr } = await supabase.storage
    .from('rental-photos')
    .upload(filePath, blob, { upsert: true, contentType: 'image/png' });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage
    .from('rental-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Upload a delivery-checklist signature image (from canvas toDataURL)
export async function uploadChecklistSignature(checklistId: string, dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const filePath = `checklists/${checklistId}/signature_${Date.now()}.png`;

  const { error: uploadErr } = await supabase.storage
    .from('rental-photos')
    .upload(filePath, blob, { upsert: true, contentType: 'image/png' });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage
    .from('rental-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ================================================================
// DELIVERY CHECKLISTS (customer-facing e-bike delivery acknowledgement)
// ================================================================

export interface DeliveryChecklist {
  id: string;
  rental_id: string | null;
  audience: 'customer' | 'internal';
  customer_name: string;
  customer_email: string;
  email_lang: 'es' | 'en' | 'pt';
  bike_model: string;
  // Numero de serie real del fabricante; bike_ref es el codigo interno (B-018).
  bike_serial: string;
  bike_ref?: string | null;
  delivery_date: string;
  battery_level: string;
  items: Record<string, boolean>;
  notes: Record<string, string>;
  signature_url: string | null;
  status: 'pending' | 'completed';
  completed_at: string | null;
  created_at: string;
}

export async function createDeliveryChecklist(
  data: Pick<DeliveryChecklist, 'rental_id' | 'customer_name' | 'customer_email' | 'email_lang' | 'bike_model' | 'bike_serial' | 'delivery_date'> &
    Partial<Pick<DeliveryChecklist, 'audience' | 'bike_ref'>>
): Promise<DeliveryChecklist> {
  const { data: row, error } = await supabase
    .from('delivery_checklists')
    .insert({
      rental_id: data.rental_id,
      audience: data.audience ?? 'customer',
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      email_lang: data.email_lang,
      bike_model: data.bike_model,
      bike_serial: data.bike_serial,
      bike_ref: data.bike_ref ?? null,
      delivery_date: data.delivery_date,
    })
    .select('*')
    .single();
  if (error) throw error;
  return row as DeliveryChecklist;
}

// Create an internal (operator-filled) technical inspection checklist.
export async function createInternalChecklist(
  data: Pick<DeliveryChecklist, 'rental_id' | 'customer_name' | 'bike_model' | 'bike_serial' | 'delivery_date'> & {
    bike_ref?: string | null;
    battery_level?: string;
    items?: Record<string, boolean>;
    notes?: Record<string, string>;
    status?: 'pending' | 'completed';
  }
): Promise<DeliveryChecklist> {
  const { data: row, error } = await supabase
    .from('delivery_checklists')
    .insert({
      rental_id: data.rental_id,
      audience: 'internal',
      customer_name: data.customer_name,
      customer_email: '',
      email_lang: 'en',
      bike_model: data.bike_model,
      bike_serial: data.bike_serial,
      bike_ref: data.bike_ref ?? null,
      delivery_date: data.delivery_date,
      battery_level: data.battery_level ?? '',
      items: data.items ?? {},
      notes: data.notes ?? {},
      status: data.status ?? 'pending',
      completed_at: data.status === 'completed' ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return row as DeliveryChecklist;
}

// Update an existing checklist row (used to edit the internal checklist).
export async function updateDeliveryChecklist(
  id: string,
  payload: { items?: Record<string, boolean>; notes?: Record<string, string>; battery_level?: string; signature_url?: string; status?: 'pending' | 'completed' }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (payload.items !== undefined) update.items = payload.items;
  if (payload.notes !== undefined) update.notes = payload.notes;
  if (payload.battery_level !== undefined) update.battery_level = payload.battery_level;
  if (payload.signature_url !== undefined) update.signature_url = payload.signature_url;
  if (payload.status !== undefined) {
    update.status = payload.status;
    update.completed_at = payload.status === 'completed' ? new Date().toISOString() : null;
  }
  const { error } = await supabase.from('delivery_checklists').update(update).eq('id', id);
  if (error) throw error;
}

export async function getDeliveryChecklists(): Promise<DeliveryChecklist[]> {
  const { data, error } = await supabase
    .from('delivery_checklists')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeliveryChecklist[];
}

export async function getDeliveryChecklist(id: string): Promise<DeliveryChecklist | null> {
  const { data, error } = await supabase
    .from('delivery_checklists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as DeliveryChecklist) ?? null;
}

// Submit the checklist. Guarded: only flips a row that is still 'pending',
// so a re-submission via the same link cannot overwrite an accepted record.
// Returns true if this call completed the checklist.
export async function submitDeliveryChecklist(
  id: string,
  payload: { items: Record<string, boolean>; battery_level: string; signature_url: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from('delivery_checklists')
    .update({
      items: payload.items,
      battery_level: payload.battery_level,
      signature_url: payload.signature_url,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ================================================================
// PRODUCT MODELS (Templates)
// ================================================================

export async function getProductModels(): Promise<(ProductModel & { unit_count: number })[]> {
  const { data, error } = await supabase
    .from('product_models')
    .select('*')
    .order('brand');
  if (error) throw error;

  const models = (data ?? []) as ProductModel[];

  const mappedModels = models.map(m => {
    let brand = m.brand || '';
    let color = null;
    if (brand.includes('#')) {
      const parts = brand.split('#');
      brand = parts[0];
      color = '#' + parts[1];
    }
    return {
      ...m,
      brand,
      color,
    };
  });

  // Count products per model
  const { data: products } = await supabase
    .from('products')
    .select('model_id');

  const counts: Record<string, number> = {};
  (products ?? []).forEach((p: Record<string, unknown>) => {
    const mid = p.model_id as string;
    if (mid) counts[mid] = (counts[mid] || 0) + 1;
  });

  return mappedModels.map(m => ({ ...m, unit_count: counts[m.id] || 0 }));
}

export async function upsertProductModel(pm: ProductModel): Promise<string> {
  const brandValue = pm.color ? `${pm.brand}#${pm.color.replace('#', '')}` : pm.brand;
  const { data, error } = await supabase
    .from('product_models')
    .upsert({
      id: pm.id,
      category_id: pm.category_id || null,
      prefix_id: pm.prefix_id || null,
      brand: brandValue,
      model_name: pm.model_name,
      suggested_weekly_rate: pm.suggested_weekly_rate,
      suggested_deposit: pm.suggested_deposit,
      motor_brand: pm.motor_brand,
      battery_capacity: pm.battery_capacity,
      wheel_size: pm.wheel_size,
      image_url: pm.image_url,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteProductModel(id: string): Promise<void> {
  // First unlink any products that reference this model
  await supabase.from('products').update({ model_id: null }).eq('model_id', id);
  const { error } = await supabase.from('product_models').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadModelImage(modelId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `models/${modelId}/photo_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function batchCreateProducts(
  modelId: string,
  prefixId: string | null,
  quantity: number,
  startNumber: number,
  pricePaid: number,
  deposit: number
): Promise<Product[]> {
  // Get the prefix string
  let prefixStr = '';
  if (prefixId) {
    const { data: pfData } = await supabase
      .from('serial_prefixes')
      .select('prefix')
      .eq('id', prefixId)
      .single();
    prefixStr = (pfData?.prefix as string) ?? '';
  }

  const rows = [];
  for (let i = 0; i < quantity; i++) {
    const num = startNumber + i;
    const serial = `${prefixStr}${String(num).padStart(3, '0')}`;
    rows.push({
      model_id: modelId,
      serial_number: serial,
      prefix_id: prefixId,
      price_paid: pricePaid,
      status: 'Disponible',
      notes: '',
      odometer: 0,
      factory_claim: false,
      maintenance_status: 'Al día',
      remind_service_one_week: true,
      remind_service_one_day: true,
      remind_service_odometer_threshold: 50,
      custom_field_values: { condition: 'bueno' },
      suggested_deposit: deposit,
    });
  }

  const { error } = await supabase.from('products').insert(rows);
  if (error) throw error;

  // Return the created products by fetching them
  const { data, error: fetchErr } = await supabase
    .from('products')
    .select('*, product_models(*)')
    .eq('model_id', modelId)
    .order('serial_number');
  if (fetchErr) throw fetchErr;
  return (data ?? []).map(row => mapRowToProduct(row as Record<string, unknown>));
}

// ================================================================
// CUSTOMERS
// ================================================================

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers').select('*').order('last_name');
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function upsertCustomer(c: Customer): Promise<void> {
  const { error } = await supabase.from('customers').upsert({
    id: c.id,
    customer_code: c.customer_code,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    address: c.address ?? '',
    phone: c.phone,
    id_document_url: c.id_document_url,
    referral_source: c.referral_source,
    nationality: c.nationality,
    created_at: c.created_at,
    notes: c.notes,
  });
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// RENTALS
// ================================================================

export async function getRentals(): Promise<Rental[]> {
  const { data, error } = await supabase
    .from('rentals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({
    ...r,
    condition_photos: (r as Record<string, unknown>).condition_photos as string[] ?? [],
    return_photos: (r as Record<string, unknown>).return_photos as string[] ?? [],
    instagram_photos: (r as Record<string, unknown>).instagram_photos as string[] ?? [],
    kit_details: (r as Record<string, unknown>).kit_details as string ?? '',
  })) as Rental[];
}

export async function upsertRental(r: Rental): Promise<void> {
  const { error } = await supabase.from('rentals').upsert(r);
  if (error) throw error;
}

export async function deleteRental(id: string): Promise<void> {
  try {
    // 1. Fetch the rental to get the bike_id
    const { data: rental } = await supabase
      .from('rentals')
      .select('bike_id')
      .eq('id', id)
      .maybeSingle();

    // 2. Fetch associated rental items to get their product_ids
    const { data: items } = await supabase
      .from('rental_items')
      .select('product_id')
      .eq('rental_id', id);

    // Collect all product IDs to release
    const productIdsToRelease: string[] = [];
    if (rental?.bike_id) {
      productIdsToRelease.push(rental.bike_id);
    }
    if (items && items.length > 0) {
      items.forEach(item => {
        if (item.product_id) productIdsToRelease.push(item.product_id);
      });
    }

    // 3. Update products to 'Disponible' if they are currently marked as 'Rentada'
    if (productIdsToRelease.length > 0) {
      await supabase
        .from('products')
        .update({ status: 'Disponible' })
        .in('id', productIdsToRelease)
        .eq('status', 'Rentada');
    }
  } catch (err) {
    console.warn('Failed to release products during rental deletion:', err);
  }

  // First delete associated items and payments
  await deleteRentalItems(id);
  const { error: payErr } = await supabase.from('rental_payments').delete().eq('rental_id', id);
  if (payErr) console.warn('Error deleting rental payments:', payErr);
  
  const { error } = await supabase.from('rentals').delete().eq('id', id);
  if (error) throw error;
}

export async function getRentalItems(): Promise<RentalItem[]> {
  const { data, error } = await supabase.from('rental_items').select('*');
  if (error) throw error;
  return (data ?? []) as RentalItem[];
}

// ----------------------------------------------------------------
// HISTORIAL DE ASIGNACION DE BICI
// ----------------------------------------------------------------

export async function getBikeAssignments(): Promise<RentalBikeAssignment[]> {
  const { data, error } = await supabase
    .from('rental_bike_assignments').select('*').order('from_date');
  if (error) throw error;
  return (data ?? []) as RentalBikeAssignment[];
}

// Cierra el tramo vigente y abre uno nuevo para la bici entrante.
export async function switchRentalBike(
  rentalId: string,
  newBikeId: string,
  effectiveDate: string
): Promise<void> {
  const { error: closeErr } = await supabase
    .from('rental_bike_assignments')
    .update({ to_date: effectiveDate })
    .eq('rental_id', rentalId)
    .is('to_date', null);
  if (closeErr) throw closeErr;

  const { error: openErr } = await supabase
    .from('rental_bike_assignments')
    .insert({ rental_id: rentalId, product_id: newBikeId, from_date: effectiveDate });
  if (openErr) throw openErr;
}

// ----------------------------------------------------------------
// ANEXOS AL CONTRATO
// ----------------------------------------------------------------

export async function getContractAmendments(): Promise<RentalContractAmendment[]> {
  const { data, error } = await supabase
    .from('rental_contract_amendments').select('*').order('number');
  if (error) throw error;
  return (data ?? []) as RentalContractAmendment[];
}

// Lectura publica para la pagina de firma (el rider no esta logueado).
export async function getContractAmendment(id: string): Promise<RentalContractAmendment | null> {
  const { data, error } = await supabase
    .from('rental_contract_amendments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as RentalContractAmendment) ?? null;
}

export async function createContractAmendment(
  data: Omit<RentalContractAmendment, 'id' | 'created_at' | 'status' | 'signature_url' | 'signed_at'>
): Promise<RentalContractAmendment> {
  const { data: row, error } = await supabase
    .from('rental_contract_amendments').insert(data).select('*').single();
  if (error) throw error;
  return row as RentalContractAmendment;
}

export async function signContractAmendment(id: string, signatureUrl: string): Promise<void> {
  const { error } = await supabase
    .from('rental_contract_amendments')
    .update({ status: 'signed', signature_url: signatureUrl, signed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Siguiente numero correlativo de anexo para un alquiler.
export async function nextAmendmentNumber(rentalId: string): Promise<number> {
  const { data, error } = await supabase
    .from('rental_contract_amendments')
    .select('number').eq('rental_id', rentalId).order('number', { ascending: false }).limit(1);
  if (error) throw error;
  return ((data?.[0]?.number as number) ?? 0) + 1;
}

// Alta del primer tramo, al crear el alquiler.
export async function openBikeAssignment(
  rentalId: string,
  bikeId: string,
  fromDate: string
): Promise<void> {
  const { error } = await supabase
    .from('rental_bike_assignments')
    .insert({ rental_id: rentalId, product_id: bikeId, from_date: fromDate });
  if (error) throw error;
}

export async function insertRentalItems(items: RentalItem[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from('rental_items').insert(items);
  if (error) throw error;
}

export async function deleteRentalItems(rentalId: string): Promise<void> {
  const { error } = await supabase.from('rental_items').delete().eq('rental_id', rentalId);
  if (error) throw error;
}

// ================================================================
// PAYMENTS
// ================================================================

export async function getPayments(): Promise<RentalPayment[]> {
  const { data, error } = await supabase
    .from('rental_payments')
    .select('*')
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RentalPayment[];
}

export async function insertPayment(p: RentalPayment): Promise<void> {
  const { error } = await supabase.from('rental_payments').insert(p);
  if (error) throw error;
}

export async function upsertPayment(p: RentalPayment): Promise<void> {
  const { error } = await supabase.from('rental_payments').upsert(p);
  if (error) throw error;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('rental_payments').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// MAINTENANCE EXPENSES
// ================================================================

export async function getExpenses(): Promise<MaintenanceExpense[]> {
  const { data, error } = await supabase
    .from('maintenance_expenses')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(e => ({
    ...e,
    photos: (e as Record<string, unknown>).photos as string[] ?? [],
  })) as MaintenanceExpense[];
}

export async function insertExpense(e: MaintenanceExpense): Promise<void> {
  const { error } = await supabase.from('maintenance_expenses').insert(e);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('maintenance_expenses').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// LEADS
// ================================================================

export async function getLeadCategories(): Promise<LeadCategory[]> {
  const { data, error } = await supabase.from('lead_categories').select('*');
  if (error) throw error;
  return (data ?? []) as LeadCategory[];
}

export async function insertLeadCategory(nameEs: string, nameEn: string): Promise<LeadCategory> {
  const { data, error } = await supabase
    .from('lead_categories')
    .insert({ name_es: nameEs, name_en: nameEn })
    .select('*')
    .single();
  if (error) throw error;
  return data as LeadCategory;
}

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function upsertLead(l: Lead): Promise<void> {
  const { error } = await supabase.from('leads').upsert(l);
  if (error) throw error;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// SUPPLIERS
// ================================================================

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function upsertSupplier(s: Supplier): Promise<void> {
  const { error } = await supabase.from('suppliers').upsert(s);
  if (error) throw error;
}

export async function getSupplierProducts(): Promise<SupplierProduct[]> {
  const { data, error } = await supabase.from('supplier_products').select('*');
  if (error) throw error;
  return (data ?? []) as SupplierProduct[];
}

export async function upsertSupplierProduct(sp: SupplierProduct): Promise<void> {
  const { error } = await supabase.from('supplier_products').upsert(sp);
  if (error) throw error;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteSupplierProduct(id: string): Promise<void> {
  const { error } = await supabase.from('supplier_products').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// GIG APP ACCOUNTS
// ================================================================

export async function getPlatforms(): Promise<AppPlatform[]> {
  const { data, error } = await supabase.from('app_platforms').select('*');
  if (error) throw error;
  return (data ?? []) as AppPlatform[];
}

export async function getVehicles(): Promise<AppVehicleType[]> {
  const { data, error } = await supabase.from('app_vehicle_types').select('*');
  if (error) throw error;
  return (data ?? []) as AppVehicleType[];
}

export async function insertPlatform(name: string): Promise<AppPlatform> {
  const { data, error } = await supabase.from('app_platforms').insert({ name }).select('*').single();
  if (error) throw error;
  return data as AppPlatform;
}

export async function updatePlatform(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('app_platforms').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deletePlatform(id: string): Promise<void> {
  const { error } = await supabase.from('app_platforms').delete().eq('id', id);
  if (error) throw error;
}

export async function insertVehicle(name: string): Promise<AppVehicleType> {
  const { data, error } = await supabase.from('app_vehicle_types').insert({ name }).select('*').single();
  if (error) throw error;
  return data as AppVehicleType;
}

export async function updateVehicle(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('app_vehicle_types').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from('app_vehicle_types').delete().eq('id', id);
  if (error) throw error;
}



export async function getAppAccounts(): Promise<AppAccount[]> {
  const { data, error } = await supabase.from('app_accounts').select('*');
  if (error) throw error;
  return (data ?? []) as AppAccount[];
}

export async function upsertAppAccount(a: AppAccount): Promise<void> {
  const { error } = await supabase.from('app_accounts').upsert(a);
  if (error) throw error;
}

export async function deleteAppAccount(id: string): Promise<void> {
  const { error } = await supabase.from('app_accounts').delete().eq('id', id);
  if (error) throw error;
}

export async function getAccountNotes(): Promise<AppAccountNote[]> {
  const { data, error } = await supabase
    .from('app_account_notes')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppAccountNote[];
}

export async function insertAccountNote(n: AppAccountNote): Promise<void> {
  const { error } = await supabase.from('app_account_notes').insert(n);
  if (error) throw error;
}

export async function deleteAccountNote(id: string): Promise<void> {
  const { error } = await supabase.from('app_account_notes').delete().eq('id', id);
  if (error) throw error;
}

export async function getAccountEarnings(): Promise<AppAccountEarning[]> {
  const { data, error } = await supabase
    .from('app_account_earnings')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppAccountEarning[];
}

export async function insertAccountEarning(e: AppAccountEarning): Promise<void> {
  const { error } = await supabase.from('app_account_earnings').insert(e);
  if (error) throw error;
}

export async function deleteAccountEarning(id: string): Promise<void> {
  const { error } = await supabase.from('app_account_earnings').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// COMPANY EVENTS
// ================================================================

export async function getEvents(): Promise<CompanyEvent[]> {
  const { data, error } = await supabase
    .from('company_events')
    .select('*')
    .order('event_date');
  if (error) throw error;
  return (data ?? []) as CompanyEvent[];
}

export async function upsertEvent(e: CompanyEvent): Promise<void> {
  const { error } = await supabase.from('company_events').upsert(e);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('company_events').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// MAINTENANCE RECORDS
// ================================================================

export async function getRecords(): Promise<MaintenanceRecord[]> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*')
    .order('service_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceRecord[];
}

export async function insertRecord(r: MaintenanceRecord): Promise<void> {
  const { error } = await supabase.from('maintenance_records').insert(r);
  if (error) throw error;
}

export async function upsertRecord(r: MaintenanceRecord): Promise<void> {
  const { error } = await supabase.from('maintenance_records').upsert(r);
  if (error) throw error;
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from('maintenance_records').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// QUICK REPLIES
// ================================================================

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export async function getQuickReplies(): Promise<QuickReply[]> {
  try {
    const { data, error } = await supabase
      .from('quick_replies')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as QuickReply[];
  } catch {
    // Table may not exist yet – return empty gracefully
    return [];
  }
}

export async function upsertQuickReply(qr: QuickReply): Promise<void> {
  const { error } = await supabase.from('quick_replies').upsert({
    id: qr.id,
    title: qr.title,
    content: qr.content,
  });
  if (error) throw error;
}

export async function deleteQuickReply(id: string): Promise<void> {
  const { error } = await supabase.from('quick_replies').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// SALES
// ================================================================

export async function getSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('sale_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Sale[];
}

export async function insertSale(s: Omit<Sale, 'created_at'>): Promise<string> {
  const { data, error } = await supabase
    .from('sales')
    .insert({
      id: s.id,
      customer_id: s.customer_id,
      sale_date: s.sale_date,
      payment_type: s.payment_type,
      total_amount: s.total_amount,
      down_payment: s.down_payment,
      email_language: s.email_language,
      notes: s.notes,
      status: s.status,
      received_via: s.received_via,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateSaleStatus(id: string, status: Sale['status']): Promise<void> {
  const { error } = await supabase.from('sales').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteSale(id: string): Promise<void> {
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw error;
}

// ================================================================
// SALE ITEMS
// ================================================================

export async function getSaleItems(): Promise<SaleItem[]> {
  const { data, error } = await supabase
    .from('sale_items')
    .select('*');
  if (error) throw error;
  return (data ?? []) as SaleItem[];
}

export async function insertSaleItems(items: Omit<SaleItem, 'id'>[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from('sale_items').insert(
    items.map(i => ({
      sale_id: i.sale_id,
      product_id: i.product_id,
      unit_price: i.unit_price,
    }))
  );
  if (error) throw error;
}

export async function deleteSaleItems(saleId: string): Promise<void> {
  const { error } = await supabase.from('sale_items').delete().eq('sale_id', saleId);
  if (error) throw error;
}

export async function deleteSaleItem(id: string): Promise<void> {
  const { error } = await supabase.from('sale_items').delete().eq('id', id);
  if (error) throw error;
}

export async function updateSaleTotal(id: string, total_amount: number): Promise<void> {
  const { error } = await supabase.from('sales').update({ total_amount }).eq('id', id);
  if (error) throw error;
}

// ================================================================
// FINANCING PLANS
// ================================================================

export async function getFinancingPlans(): Promise<FinancingPlan[]> {
  const { data, error } = await supabase
    .from('financing_plans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinancingPlan[];
}

export async function insertFinancingPlan(fp: Omit<FinancingPlan, 'created_at'>): Promise<string> {
  const { data, error } = await supabase
    .from('financing_plans')
    .insert({
      id: fp.id,
      sale_id: fp.sale_id,
      total_financed: fp.total_financed,
      num_installments: fp.num_installments,
      installment_amount: fp.installment_amount,
      payment_frequency: fp.payment_frequency,
      start_date: fp.start_date,
      status: fp.status,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateFinancingPlanStatus(id: string, status: FinancingPlan['status']): Promise<void> {
  const { error } = await supabase.from('financing_plans').update({ status }).eq('id', id);
  if (error) throw error;
}

// ================================================================
// FINANCING PAYMENTS
// ================================================================

export async function getFinancingPayments(): Promise<FinancingPayment[]> {
  const { data, error } = await supabase
    .from('financing_payments')
    .select('*')
    .order('due_date');
  if (error) throw error;
  return (data ?? []) as FinancingPayment[];
}

export async function insertFinancingPayments(payments: Omit<FinancingPayment, 'created_at'>[]): Promise<void> {
  if (payments.length === 0) return;
  const { error } = await supabase.from('financing_payments').insert(
    payments.map(p => ({
      id: p.id,
      financing_plan_id: p.financing_plan_id,
      installment_number: p.installment_number,
      amount: p.amount,
      due_date: p.due_date,
      paid_date: p.paid_date,
      status: p.status,
    }))
  );
  if (error) throw error;
}

export async function markFinancingPaymentPaid(paymentId: string, paidDate: string, receivedVia?: string): Promise<void> {
  const { error } = await supabase
    .from('financing_payments')
    .update({ status: 'Pagada', paid_date: paidDate, received_via: receivedVia })
    .eq('id', paymentId);
  if (error) throw error;
}

export async function unmarkFinancingPaymentPaid(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('financing_payments')
    .update({ status: 'Pendiente', paid_date: null })
    .eq('id', paymentId);
  if (error) throw error;
}

export async function deleteFinancingPlan(id: string): Promise<void> {
  const { error } = await supabase.from('financing_plans').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteFinancingPayments(planId: string): Promise<void> {
  const { error } = await supabase.from('financing_payments').delete().eq('financing_plan_id', planId);
  if (error) throw error;
}

// ================================================================
// EMAIL TEMPLATES
// ================================================================

export interface EmailTemplate {
  id?: string;
  template_key: 'sale_contado' | 'financing_welcome' | 'installment_reminder' | 'rental_confirm' | 'rental_reminder' | 'financing_completed' | 'rental_payment_received' | 'app_account_assigned' | 'rental_returned';
  language: 'es' | 'en' | 'pt';
  subject: string;
  body_text: string;
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const defaultTemplates: EmailTemplate[] = [
    {
      template_key: 'sale_contado',
      language: 'es',
      subject: 'Confirmación de Compra - The Fast Sheep',
      body_text: `<h3>¡Muchas gracias por tu compra en The Fast Sheep!</h3>
<p>Hola <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Queremos agradecerte tu confianza al adquirir tus artículos con nosotros. A continuación encontrarás el resumen del detalle de tu compra realizada con éxito el día de hoy:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0;">
  <h4 style="margin: 0 0 10px 0; color: #a78bfa;">📦 Detalle de Artículos:</h4>
  {{PRODUCTS_LIST}}
</div>
<p><strong>Total de la Compra:</strong> <span style="font-size: 16px; color: #10b981; font-weight: bold;">{{TOTAL_SALE}}</span></p>
<p>Si tienes alguna consulta sobre tus productos o necesitas soporte técnico, nuestro equipo de taller está listo para ayudarte. ¡Disfruta del camino!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'sale_contado',
      language: 'en',
      subject: 'Purchase Confirmation - The Fast Sheep',
      body_text: `<h3>Thank you for your purchase at The Fast Sheep!</h3>
<p>Hello <strong>{{CLIENT_NAME}}</strong>,</p>
<p>We want to thank you for choosing us for your recent acquisition. Here is the summary of your successful purchase details today:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0;">
  <h4 style="margin: 0 0 10px 0; color: #a78bfa;">📦 Items Details:</h4>
  {{PRODUCTS_LIST}}
</div>
<p><strong>Total Purchase:</strong> <span style="font-size: 16px; color: #10b981; font-weight: bold;">{{TOTAL_SALE}}</span></p>
<p>If you have any questions about your products or need technical assistance, our workshop crew is here to help. Enjoy the ride!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'sale_contado',
      language: 'pt',
      subject: 'Confirmação de Compra - The Fast Sheep',
      body_text: `<h3>Muito obrigado pela sua compra na The Fast Sheep!</h3>
<p>Olá <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Agradecemos a sua confiança ao adquirir seus produtos connosco. A seguir encontrará o resumo do detalhe da sua compra realizada con sucesso hoje:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0;">
  <h4 style="margin: 0 0 10px 0; color: #a78bfa;">📦 Detalhes dos Itens:</h4>
  {{PRODUCTS_LIST}}
</div>
<p><strong>Total da Compra:</strong> <span style="font-size: 16px; color: #10b981; font-weight: bold;">{{TOTAL_SALE}}</span></p>
<p>Se tiver alguma dúvida sobre seus produtos ou precisar de suporte técnico, nossa equipa está pronta para ajudar. Aproveite o caminho!</p>
<p>Atenciosamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'financing_welcome',
      language: 'es',
      subject: 'Tu Plan de Financiamiento - The Fast Sheep',
      body_text: `<h3>¡Bienvenido a tu plan de financiamiento en The Fast Sheep!</h3>
<p>Estimado/a <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Nos complace darte la bienvenida a tu plan de financiamiento sin intereses adicionales. Tu plan ha sido registrado exitosamente el día de hoy. A continuación te detallamos el resumen del acuerdo:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px; line-height: 1.6;">
  • <strong>Total de la Venta:</strong> {{TOTAL_SALE}}<br/>
  • <strong>Monto de Entrada Abonado:</strong> {{DOWN_PAYMENT}}<br/>
  • <strong>Monto Restante Financiado:</strong> {{FINANCED_AMOUNT}}<br/>
  • <strong>Esquema de Cuotas:</strong> {{INSTALLMENTS_COUNT}} cuotas de {{INSTALLMENT_AMOUNT}}<br/>
  • <strong>Frecuencia de Pago:</strong> {{PAYMENT_FREQUENCY}}<br/>
  • <strong>Primer Vencimiento:</strong> {{FIRST_DUE_DATE}}
</div>
<p>Por favor, recuerda cumplir puntualmente con tus fechas de pago para mantener tu cuenta al día. Se te enviará un recordatorio automático en cada fecha de vencimiento.</p>
<p>¡Gracias por confiar en nosotros!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'financing_welcome',
      language: 'en',
      subject: 'Your Financing Plan - The Fast Sheep',
      body_text: `<h3>Welcome to your financing plan at The Fast Sheep!</h3>
<p>Dear <strong>{{CLIENT_NAME}}</strong>,</p>
<p>We are pleased to welcome you to your custom interest-free financing plan. Your plan has been successfully registered today. Below are the details of the agreement:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px; line-height: 1.6;">
  • <strong>Total Sale:</strong> {{TOTAL_SALE}}<br/>
  • <strong>Down Payment Paid:</strong> {{DOWN_PAYMENT}}<br/>
  • <strong>Remaining Financed Balance:</strong> {{FINANCED_AMOUNT}}<br/>
  • <strong>Installments Schedule:</strong> {{INSTALLMENTS_COUNT}} installments of {{INSTALLMENT_AMOUNT}}<br/>
  • <strong>Payment Frequency:</strong> {{PAYMENT_FREQUENCY}}<br/>
  • <strong>First Due Date:</strong> {{FIRST_DUE_DATE}}
</div>
<p>Please remember to fulfill your payments on time to keep your account current. An automatic reminder will be sent on each due date.</p>
<p>Thank you for your business!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'financing_welcome',
      language: 'pt',
      subject: 'Seu Plano de Financiamento - The Fast Sheep',
      body_text: `<h3>Bem-vindo ao seu plano de financiamento na The Fast Sheep!</h3>
<p>Caro/a <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Temos o prazer de lhe dar as boas-vindas ao seu plano de financiamento sem juros adicionais. O seu plano foi registado com sucesso hoje. Abaixo estão os detalhes do acordo:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px; line-height: 1.6;">
  • <strong>Total da Venda:</strong> {{TOTAL_SALE}}<br/>
  • <strong>Monto de Entrada Pago:</strong> {{DOWN_PAYMENT}}<br/>
  • <strong>Monto Financiado Restante:</strong> {{FINANCED_AMOUNT}}<br/>
  • <strong>Esquema de Parcelas:</strong> {{INSTALLMENTS_COUNT}} parcelas de {{INSTALLMENT_AMOUNT}}<br/>
  • <strong>Frequência de Pagamento:</strong> {{PAYMENT_FREQUENCY}}<br/>
  • <strong>Primeiro Vencimento:</strong> {{FIRST_DUE_DATE}}
</div>
<p>Por favor, lembre-se de cumprir os seus pagamentos em dia para manter a sua conta ativa. Um lembrete automático será enviado em cada data de vencimento.</p>
<p>Obrigado pela sua preferência!</p>
<p>Atenciosamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'installment_reminder',
      language: 'es',
      subject: 'Recordatorio de Pago de Cuota - The Fast Sheep',
      body_text: `<h3>Recordatorio de vencimiento de cuota - The Fast Sheep</h3>
<p>Estimado/a <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Te escribimos para recordarte que el próximo vencimiento de tu plan de financiamiento es el día de hoy, <strong>{{DUE_DATE}}</strong>.</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Cuota Próxima:</strong> Cuota número {{INSTALLMENT_NUMBER}}<br/>
  • <strong>Monto a Abonar:</strong> <strong style="font-size: 16px; color: #a78bfa;">{{INSTALLMENT_AMOUNT}}</strong><br/>
  • <strong>Fecha de Vencimiento:</strong> {{DUE_DATE}}
</div>
<p>Por favor, realiza el pago a través de los canales de cobro autorizados o acércate a la oficina para mantener tu cuenta al día y evitar recargos o suspensiones.</p>
<p>¡Muchas gracias por tu compromiso!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'installment_reminder',
      language: 'en',
      subject: 'Payment Installment Due Reminder - The Fast Sheep',
      body_text: `<h3>Installment Payment Reminder - The Fast Sheep</h3>
<p>Dear <strong>{{CLIENT_NAME}}</strong>,</p>
<p>This is a friendly reminder that the next due date for your interest-free financing plan is today, <strong>{{DUE_DATE}}</strong>.</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Next Payment:</strong> Installment number {{INSTALLMENT_NUMBER}}<br/>
  • <strong>Amount Due:</strong> <strong style="font-size: 16px; color: #a78bfa;">{{INSTALLMENT_AMOUNT}}</strong><br/>
  • <strong>Due Date:</strong> {{DUE_DATE}}
</div>
<p>Please make the payment through authorized channels or visit the office to keep your account current and avoid any disruption.</p>
<p>Thank you for your prompt response!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'installment_reminder',
      language: 'pt',
      subject: 'Lembrete de Pagamento de Parcela - The Fast Sheep',
      body_text: `<h3>Lembrete de vencimento de parcela - The Fast Sheep</h3>
<p>Caro/a <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Escrevemos para lembrá-lo que o próximo vencimento do seu plano de financiamento sem juros é hoje, <strong>{{DUE_DATE}}</strong>.</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Próxima Parcela:</strong> Parcela número {{INSTALLMENT_NUMBER}}<br/>
  • <strong>Valor a Pagar:</strong> <strong style="font-size: 16px; color: #a78bfa;">{{INSTALLMENT_AMOUNT}}</strong><br/>
  • <strong>Data de Vencimento:</strong> {{DUE_DATE}}
</div>
<p>Por favor, efetue o pagamento através dos canais autorizados para manter a sua conta em dia.</p>
<p>Muito obrigado pelo seu compromisso!</p>
<p>Atentamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_confirm',
      language: 'es',
      subject: 'Confirmación de Alquiler - The Fast Sheep',
      body_text: `<h3>¡Tu alquiler en The Fast Sheep ha sido confirmado!</h3>
<p>Hola <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Queremos darte la bienvenida y confirmar el registro de tu alquiler de e-bike con nosotros. A continuación tienes los detalles del acuerdo de alquiler:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px; line-height: 1.6;">
  • <strong>E-Bike Alquilada:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Fecha de Inicio:</strong> {{START_DATE}}<br/>
  • <strong>Alquiler Mensual:</strong> <strong style="color: #10b981;">{{MONTHLY_RATE}}</strong><br/>
  • <strong>Depósito / Fianza:</strong> {{DEPOSIT_AMOUNT}}
</div>
<p>Recuerda que las mensualidades se cobrarán el mismo día de cada mes a partir de tu fecha de inicio. ¡Disfruta del camino con total tranquilidad!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_confirm',
      language: 'en',
      subject: 'Rental Confirmation - The Fast Sheep',
      body_text: `<h3>Your Rental at The Fast Sheep has been confirmed!</h3>
<p>Hello <strong>{{CLIENT_NAME}}</strong>,</p>
<p>We are pleased to welcome you and confirm the registration of your e-bike rental with us. Below are your rental agreement details:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px; line-height: 1.6;">
  • <strong>Rented E-Bike:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Start Date:</strong> {{START_DATE}}<br/>
  • <strong>Monthly Rent:</strong> <strong style="color: #10b981;">{{MONTHLY_RATE}}</strong><br/>
  • <strong>Security Deposit:</strong> {{DEPOSIT_AMOUNT}}
</div>
<p>Please note that monthly payments will be processed on the same day of each month starting from your initial date. Enjoy your ride with total peace of mind!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'rental_confirm',
      language: 'pt',
      subject: 'Confirmação de Aluguer - The Fast Sheep',
      body_text: `<h3>O seu aluguer na The Fast Sheep foi confirmado!</h3>
<p>Olá <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Temos o prazer de lhe dar as boas-vindas e confirmar o registo do seu aluguer de e-bike connosco. Abaixo estão os detalhes do seu acordo de aluguer:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px; line-height: 1.6;">
  • <strong>E-Bike Alugada:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Data de Início:</strong> {{START_DATE}}<br/>
  • <strong>Aluguer Mensal:</strong> <strong style="color: #10b981;">{{MONTHLY_RATE}}</strong><br/>
  • <strong>Depósito / Fiança:</strong> {{DEPOSIT_AMOUNT}}
</div>
<p>Por favor, lembre-se que os pagamentos mensais serão efetuados no mesmo dia de cada mês a partir da sua data de início. Aproveite o seu caminho com total tranquilidade!</p>
<p>Atenciosamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_reminder',
      language: 'es',
      subject: 'Recordatorio de Pago de Alquiler - The Fast Sheep',
      body_text: `<h3>Recordatorio de pago de mensualidad de alquiler - The Fast Sheep</h3>
<p>Estimado/a <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Te escribimos para recordarte que el día de hoy, <strong>{{DUE_DATE}}</strong>, corresponde el cobro mensual de tu alquiler activo:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>E-Bike:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Monto de Mensualidad:</strong> <strong style="font-size: 16px; color: #a78bfa;">{{MONTHLY_RATE}}</strong><br/>
  • <strong>Fecha de Vencimiento:</strong> {{DUE_DATE}}
</div>
<p>Por favor, mantén tu cuenta al día para seguir disfrutando de tu servicio sin interrupciones. ¡Muchas gracias!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_reminder',
      language: 'en',
      subject: 'Rental Payment Due Reminder - The Fast Sheep',
      body_text: `<h3>Rental Payment Reminder - The Fast Sheep</h3>
<p>Dear <strong>{{CLIENT_NAME}}</strong>,</p>
<p>This is a friendly reminder that the monthly payment for your active e-bike rental is due today, <strong>{{DUE_DATE}}</strong>:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>E-Bike:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Monthly Rate:</strong> <strong style="font-size: 16px; color: #a78bfa;">{{MONTHLY_RATE}}</strong><br/>
  • <strong>Due Date:</strong> {{DUE_DATE}}
</div>
<p>Please make sure to fulfill the payment to continue enjoying your service without interruptions. Thank you very much!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'rental_reminder',
      language: 'pt',
      subject: 'Lembrete de Pagamento de Aluguer - The Fast Sheep',
      body_text: `<h3>Lembrete de pagamento de mensalidade de aluguer - The Fast Sheep</h3>
<p>Caro/a <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Escrevemos para lembrá-lo que hoje, <strong>{{DUE_DATE}}</strong>, corresponde o pagamento mensal do seu aluguer ativo:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>E-Bike:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Mensalidade de Aluguer:</strong> <strong style="font-size: 16px; color: #a78bfa;">{{MONTHLY_RATE}}</strong><br/>
  • <strong>Data de Vencimento:</strong> {{DUE_DATE}}
</div>
<p>Por favor, efetue o pagamento para continuar a desfrutar do seu serviço sem interrupções. Muito obrigado!</p>
<p>Atentamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'financing_completed',
      language: 'es',
      subject: '¡Felicidades! Has completado tu financiación - The Fast Sheep',
      body_text: `<h3>¡Felicidades por completar tu financiación!</h3>
<p>Hola <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Queremos agradecerte y felicitarte por haber abonado exitosamente la última cuota de tu financiación.</p>
<p>¡La e-bike ahora es completamente tuya! Gracias por confiar en The Fast Sheep. Esperamos que la sigas disfrutando al máximo.</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'financing_completed',
      language: 'en',
      subject: 'Congratulations! You have completed your financing - The Fast Sheep',
      body_text: `<h3>Congratulations on completing your financing!</h3>
<p>Hello <strong>{{CLIENT_NAME}}</strong>,</p>
<p>We want to thank you and congratulate you for successfully paying the last installment of your financing.</p>
<p>The e-bike is now completely yours! Thank you for trusting The Fast Sheep. We hope you continue to enjoy it to the fullest.</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'financing_completed',
      language: 'pt',
      subject: 'Parabéns! Você concluiu seu financiamento - The Fast Sheep',
      body_text: `<h3>Parabéns por concluir seu financiamento!</h3>
<p>Olá <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Queremos agradecer e parabenizá-lo por ter pago com sucesso a última parcela do seu financiamento.</p>
<p>A e-bike agora é totalmente sua! Obrigado por confiar na The Fast Sheep. Esperamos que você continue a aproveitá-la ao máximo.</p>
<p>Atenciosamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_payment_received',
      language: 'es',
      subject: 'Confirmación de pago de alquiler - The Fast Sheep',
      body_text: `<h3>¡Tu pago ha sido registrado con éxito!</h3>
<p>Hola <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Te confirmamos que hemos recibido correctamente tu pago de alquiler de e-bike:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Monto Recibido:</strong> <strong style="font-size: 16px; color: #10b981;">{{PAYMENT_AMOUNT}}</strong><br/>
  • <strong>Fecha de Pago:</strong> {{PAYMENT_DATE}}<br/>
  • <strong>Concepto / Método:</strong> {{PAYMENT_METHOD}}
</div>
<p>Tu cuenta se encuentra al día. ¡Gracias por confiar en The Fast Sheep y buen viaje!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_payment_received',
      language: 'en',
      subject: 'Rental Payment Confirmation - The Fast Sheep',
      body_text: `<h3>Your payment has been successfully recorded!</h3>
<p>Hello <strong>{{CLIENT_NAME}}</strong>,</p>
<p>This is to confirm that we have successfully received your e-bike rental payment:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Amount Received:</strong> <strong style="font-size: 16px; color: #10b981;">{{PAYMENT_AMOUNT}}</strong><br/>
  • <strong>Payment Date:</strong> {{PAYMENT_DATE}}<br/>
  • <strong>Concept / Method:</strong> {{PAYMENT_METHOD}}
</div>
<p>Your account is up to date. Thank you for choosing The Fast Sheep. Have a safe ride!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'rental_payment_received',
      language: 'pt',
      subject: 'Confirmação de pagamento de aluguer - The Fast Sheep',
      body_text: `<h3>O seu pagamento foi registado com sucesso!</h3>
<p>Olá <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Confirmamos que recebemos corretamente o pagamento do seu aluguer de e-bike:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Valor Recebido:</strong> <strong style="font-size: 16px; color: #10b981;">{{PAYMENT_AMOUNT}}</strong><br/>
  • <strong>Data de Pagamento:</strong> {{PAYMENT_DATE}}<br/>
  • <strong>Conceito / Método:</strong> {{PAYMENT_METHOD}}
</div>
<p>A sua conta está em dia. Obrigado por confiar na The Fast Sheep. Boa viagem!</p>
<p>Atenciosamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'app_account_assigned',
      language: 'es',
      subject: 'Tu cuenta de app asignada - The Fast Sheep',
      body_text: `<h3>¡Tu cuenta de app de reparto está lista!</h3>
<p>Hola <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Te confirmamos que te hemos asignado exitosamente tu cuenta de app de reparto para trabajar:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Plataforma:</strong> {{PLATFORM_NAME}}<br/>
  • <strong>Usuario:</strong> <strong style="color: #a78bfa;">{{ACCOUNT_USERNAME}}</strong><br/>
  • <strong>Contraseña:</strong> {{ACCOUNT_PASSWORD}}<br/>
  • <strong>Detalles de cobro:</strong> {{BANK_DETAILS}}
</div>
<p>Por favor inicia sesión con estos datos para comenzar a trabajar. ¡Mucho éxito en tus repartos!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'app_account_assigned',
      language: 'en',
      subject: 'Your assigned app account - The Fast Sheep',
      body_text: `<h3>Your gig delivery app account is ready!</h3>
<p>Hello <strong>{{CLIENT_NAME}}</strong>,</p>
<p>We confirm that your gig delivery app account has been successfully assigned to you:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Platform:</strong> {{PLATFORM_NAME}}<br/>
  • <strong>Username:</strong> <strong style="color: #a78bfa;">{{ACCOUNT_USERNAME}}</strong><br/>
  • <strong>Password:</strong> {{ACCOUNT_PASSWORD}}<br/>
  • <strong>Payout details:</strong> {{BANK_DETAILS}}
</div>
<p>Please log in using these credentials to start working. Best of luck with your deliveries!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'app_account_assigned',
      language: 'pt',
      subject: 'Sua conta de app atribuída - The Fast Sheep',
      body_text: `<h3>A sua conta de app de entregas está pronta!</h3>
<p>Olá <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Confirmamos que lhe atribuímos com sucesso a sua conta de app de entregas para trabalhar:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Plataforma:</strong> {{PLATFORM_NAME}}<br/>
  • <strong>Utilizador:</strong> <strong style="color: #a78bfa;">{{ACCOUNT_USERNAME}}</strong><br/>
  • <strong>Senha:</strong> {{ACCOUNT_PASSWORD}}<br/>
  • <strong>Detalhes bancários:</strong> {{BANK_DETAILS}}
</div>
<p>Inicie sessão com estes dados para começar a trabalhar. Muito sucesso nas suas entregas!</p>
<p>Atenciosamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_returned',
      language: 'es',
      subject: 'Confirmación de devolución de bicicleta - The Fast Sheep',
      body_text: `<h3>¡Tu devolución ha sido procesada con éxito!</h3>
<p>Hola <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Te confirmamos que hemos recibido la devolución de tu e-bike alquilada y cerrado tu acuerdo de alquiler:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>E-Bike Devuelta:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Kilometraje Final:</strong> {{ODOMETER_END}} KM<br/>
  • <strong>Depósito Devuelto:</strong> <strong style="color: #10b981;">{{DEPOSIT_REFUNDED}}</strong><br/>
  • <strong>Reporte de Daños:</strong> {{DAMAGE_REPORT}}
</div>
<p>Queremos agradecerte enormemente tu confianza al elegir The Fast Sheep. ¡Esperamos volver a verte muy pronto!</p>
<p>Atentamente,<br/><strong>El equipo de The Fast Sheep</strong></p>`
    },
    {
      template_key: 'rental_returned',
      language: 'en',
      subject: 'E-Bike Return Confirmation - The Fast Sheep',
      body_text: `<h3>Your return has been successfully processed!</h3>
<p>Hello <strong>{{CLIENT_NAME}}</strong>,</p>
<p>We confirm that we have received the return of your rented e-bike and successfully closed your rental agreement:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>Returned E-Bike:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Final Odometer:</strong> {{ODOMETER_END}} KM<br/>
  • <strong>Refunded Deposit:</strong> <strong style="color: #10b981;">{{DEPOSIT_REFUNDED}}</strong><br/>
  • <strong>Damage Report:</strong> {{DAMAGE_REPORT}}
</div>
<p>Thank you very much for choosing The Fast Sheep. We hope to see you again soon!</p>
<p>Best regards,<br/><strong>The Fast Sheep Team</strong></p>`
    },
    {
      template_key: 'rental_returned',
      language: 'pt',
      subject: 'Confirmação de devolução de bicicleta - The Fast Sheep',
      body_text: `<h3>A sua devolução foi processada com sucesso!</h3>
<p>Olá <strong>{{CLIENT_NAME}}</strong>,</p>
<p>Confirmamos que recebemos a devolução da sua e-bike alugada e encerrámos o seu contrato de aluguer:</p>
<div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin: 16px 0; font-size: 14px;">
  • <strong>E-Bike Devolvida:</strong> {{VEHICLE_NAME}}<br/>
  • <strong>Quilometragem Final:</strong> {{ODOMETER_END}} KM<br/>
  • <strong>Depósito Devolvido:</strong> <strong style="color: #10b981;">{{DEPOSIT_REFUNDED}}</strong><br/>
  • <strong>Relatório de Danos:</strong> {{DAMAGE_REPORT}}
</div>
<p>Agradecemos imenso a sua confiança ao escolher a The Fast Sheep. Esperamos vê-lo de volta muito em breve!</p>
<p>Atenciosamente,<br/><strong>A equipa The Fast Sheep</strong></p>`
    }
  ];

  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('template_key', { ascending: true });
    
    if (error) {
      console.warn('Could not fetch email templates from Supabase, using defaults:', error.message);
      return defaultTemplates;
    }

    const list = (data ?? []) as EmailTemplate[];

    // Auto-seed any missing default templates
    const missingTemplates = defaultTemplates.filter(def => 
      !list.some(dbTpl => dbTpl.template_key === def.template_key && dbTpl.language === def.language)
    );

    if (missingTemplates.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('email_templates')
        .insert(missingTemplates)
        .select('*');
      
      if (!insertErr && inserted) {
        return [...list, ...inserted] as EmailTemplate[];
      }
    }

    return list;
  } catch (err: any) {
    console.warn('Gracefully caught exception while loading email templates, falling back to defaults:', err.message);
    return defaultTemplates;
  }
}

export async function upsertEmailTemplate(template: EmailTemplate): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .upsert({
      template_key: template.template_key,
      language: template.language,
      subject: template.subject,
      body_text: template.body_text
    }, {
      onConflict: 'template_key,language'
    });
  if (error) throw error;
}

// ================================================================
// ALLOWED EMAILS (Google Auth Access Control)
// ================================================================

export interface AllowedEmail {
  id: string;
  email: string;
  role?: string;
  created_at: string;
}

export async function getAllowedEmails(): Promise<AllowedEmail[]> {
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('*')
    .order('email');
  if (error) throw error;
  return (data ?? []) as AllowedEmail[];
}

export async function addAllowedEmail(email: string, role: string = 'admin'): Promise<void> {
  const { error } = await supabase
    .from('allowed_emails')
    .upsert({ email: email.toLowerCase().trim(), role }, { onConflict: 'email' });
  if (error) throw error;
}

export async function deleteAllowedEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('allowed_emails')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ================================================================
// BIKE MODIFICATIONS (Historical modifications log for Bicycles)
// ================================================================

export interface BikeModification {
  id: string;
  bike_id: string;
  description: string;
  modification_date: string;
  created_at: string;
}

export async function getBikeModifications(bikeId: string): Promise<BikeModification[]> {
  const { data, error } = await supabase
    .from('bike_modifications')
    .select('*')
    .eq('bike_id', bikeId)
    .order('modification_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BikeModification[];
}

// All bike modifications (used for the full data backup).
export async function getAllBikeModifications(): Promise<BikeModification[]> {
  const { data, error } = await supabase
    .from('bike_modifications')
    .select('*')
    .order('modification_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BikeModification[];
}

export async function addBikeModification(bikeId: string, description: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('bike_modifications')
    .insert({
      bike_id: bikeId,
      description,
      modification_date: date
    });
  if (error) throw error;
}

export async function deleteBikeModification(id: string): Promise<void> {
  const { error } = await supabase
    .from('bike_modifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ================================================================
// TASK BOARD (To-Do Lists)
// ================================================================

export interface TaskCard {
  id: string;
  title: string;
  created_at: string;
}

export interface TaskItem {
  id: string;
  card_id: string;
  text: string;
  completed: boolean;
  color: string;
  position: number;
  created_at?: string;
}

export interface TaskColorTag {
  color: string;
  label: string;
}

export async function getTaskCards(): Promise<TaskCard[]> {
  const { data, error } = await supabase
    .from('task_cards')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskCard[];
}

export async function upsertTaskCard(card: Partial<TaskCard>): Promise<void> {
  const { error } = await supabase
    .from('task_cards')
    .upsert(card);
  if (error) throw error;
}

export async function deleteTaskCard(id: string): Promise<void> {
  const { error } = await supabase
    .from('task_cards')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getTaskItems(): Promise<TaskItem[]> {
  const { data, error } = await supabase
    .from('task_items')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskItem[];
}

export async function upsertTaskItem(item: Partial<TaskItem>): Promise<void> {
  const { error } = await supabase
    .from('task_items')
    .upsert(item);
  if (error) throw error;
}

export async function deleteTaskItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('task_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getColorTags(): Promise<TaskColorTag[]> {
  const { data, error } = await supabase
    .from('task_color_tags')
    .select('*');
  if (error) throw error;
  return (data ?? []) as TaskColorTag[];
}

export async function upsertColorTag(tag: TaskColorTag): Promise<void> {
  const { error } = await supabase
    .from('task_color_tags')
    .upsert(tag);
  if (error) throw error;
}

export async function deleteColorTag(color: string): Promise<void> {
  const { error } = await supabase
    .from('task_color_tags')
    .delete()
    .eq('color', color);
  if (error) throw error;
}



