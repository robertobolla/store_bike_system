// backup.ts – Full data backup to a multi-tab XLSX workbook.
// Builds one human-readable sheet per entity (foreign keys resolved to names,
// raw ids kept at the end of each row) and triggers a browser download.

import * as XLSX from 'xlsx';
import type {
  Product, ProductModel, Customer, Rental, RentalItem, RentalPayment,
  Sale, SaleItem, FinancingPlan, FinancingPayment, MaintenanceExpense,
  MaintenanceRecord, BikeModification, Lead, LeadCategory, Supplier,
  SupplierProduct, AppAccount, AppAccountNote, AppAccountEarning,
  AppPlatform, AppVehicleType, Category,
} from './db';

export interface BackupTransaction {
  date: string;
  category: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  received_via?: string;
}

export interface BackupData {
  categories: Category[];
  products: Product[];
  productModels: ProductModel[];
  customers: Customer[];
  rentals: Rental[];
  rentalItems: RentalItem[];
  payments: RentalPayment[];
  sales: Sale[];
  saleItems: SaleItem[];
  financingPlans: FinancingPlan[];
  financingPayments: FinancingPayment[];
  expenses: MaintenanceExpense[];
  records: MaintenanceRecord[];
  bikeModifications: BikeModification[];
  leads: Lead[];
  leadCategories: LeadCategory[];
  suppliers: Supplier[];
  supplierProducts: SupplierProduct[];
  appAccounts: AppAccount[];
  accountNotes: AppAccountNote[];
  accountEarnings: AppAccountEarning[];
  platforms: AppPlatform[];
  vehicles: AppVehicleType[];
  transactions: BackupTransaction[];
}

type Row = Record<string, string | number>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const yesNo = (v: unknown) => (v ? 'Sí' : 'No');

export function buildBackupWorkbook(d: BackupData): XLSX.WorkBook {
  // ---- lookup maps ----
  const productById = new Map(d.products.map(p => [p.id, p]));
  const customerById = new Map(d.customers.map(c => [c.id, c]));
  const categoryById = new Map(d.categories.map(c => [c.id, c]));
  const platformById = new Map(d.platforms.map(p => [p.id, p]));
  const vehicleById = new Map(d.vehicles.map(v => [v.id, v]));
  const saleById = new Map(d.sales.map(s2 => [s2.id, s2]));
  const planById = new Map(d.financingPlans.map(p => [p.id, p]));
  const leadCatById = new Map(d.leadCategories.map(c => [c.id, c]));
  const supplierById = new Map(d.suppliers.map(s2 => [s2.id, s2]));
  const accountById = new Map(d.appAccounts.map(a => [a.id, a]));

  const prodLabel = (id?: string | null) => {
    if (!id) return '';
    const p = productById.get(id);
    return p ? `${p.serial_number} ${p.name}`.trim() : id;
  };
  const custLabel = (id?: string | null) => {
    if (!id) return '';
    const c = customerById.get(id);
    return c ? `${c.first_name} ${c.last_name}`.trim() : id;
  };
  const catLabel = (id?: string | null) => (id ? (categoryById.get(id)?.name_es ?? '') : '');
  const rentalLabel = (rental?: Rental | null) =>
    rental ? `${prodLabel(rental.bike_id)} — ${custLabel(rental.customer_id)}` : '';
  const saleLabel = (id?: string | null) => {
    const sale = id ? saleById.get(id) : null;
    return sale ? `${custLabel(sale.customer_id)} (${sale.sale_date})` : '';
  };
  const accountLabel = (id?: string | null) => {
    const a = id ? accountById.get(id) : null;
    if (!a) return '';
    return `${platformById.get(a.platform_id)?.name ?? ''} ${a.platform_account_number || a.owner_name}`.trim();
  };

  // ---- build rows per sheet ----
  const transactions: Row[] = d.transactions.map(t => ({
    Fecha: t.date,
    Categoría: t.category,
    Descripción: t.description,
    Tipo: t.type === 'income' ? 'Ingreso' : 'Egreso',
    Medio: t.received_via ? (t.received_via === 'efectivo' ? 'Efectivo' : 'Transferencia') : '',
    Monto: t.amount,
  }));

  const stock: Row[] = d.products.map(p => ({
    Serial: s(p.serial_number),
    Categoría: catLabel(p.category_id),
    Marca: s(p.brand),
    Modelo: s(p.model),
    Estado: s(p.status),
    'Odómetro (km)': p.odometer ?? 0,
    'Precio compra': p.price_paid ?? 0,
    'Precio venta': p.price_sold ?? '',
    'Fecha compra': s(p.purchase_date),
    'Fecha venta': s(p.sold_date),
    Mantenimiento: s(p.maintenance_status),
    Color: s(p.color),
    Notas: s(p.notes),
    id: p.id,
  }));

  const modelos: Row[] = d.productModels.map(m => ({
    Marca: s(m.brand),
    Modelo: s(m.model_name),
    Categoría: catLabel(m.category_id),
    'Tarifa semanal sug.': m.suggested_weekly_rate ?? '',
    'Depósito sug.': m.suggested_deposit ?? '',
    Motor: s(m.motor_brand),
    Batería: s(m.battery_capacity),
    Rueda: s(m.wheel_size),
    id: m.id,
  }));

  const usuarios: Row[] = d.customers.map(c => ({
    Código: s(c.customer_code),
    Nombre: s(c.first_name),
    Apellido: s(c.last_name),
    Email: s(c.email),
    Teléfono: s(c.phone),
    Nacionalidad: s(c.nationality),
    Origen: s(c.referral_source),
    Notas: s(c.notes),
    Alta: s(c.created_at),
    id: c.id,
  }));

  const alquileres: Row[] = d.rentals.map(r => ({
    Bici: prodLabel(r.bike_id),
    Cliente: custLabel(r.customer_id),
    Tarifa: r.rental_rate ?? 0,
    Tipo: s(r.rate_type),
    Depósito: r.deposit_amount ?? 0,
    'Depósito devuelto': r.deposit_refunded ?? '',
    Seguro: yesNo(r.has_insurance),
    Inicio: s(r.start_date),
    Fin: s(r.end_date),
    'Devolución prog.': s(r.scheduled_return_date),
    Estado: s(r.status),
    Contrato: s(r.contract_type),
    Kit: yesNo(r.has_kit),
    'Odo inicio': r.odometer_start ?? '',
    'Odo fin': r.odometer_end ?? '',
    id: r.id,
    bike_id: s(r.bike_id),
    customer_id: s(r.customer_id),
  }));

  const alquilerItems: Row[] = d.rentalItems.map(ri => ({
    Alquiler: rentalLabel(d.rentals.find(r => r.id === ri.rental_id)),
    Producto: prodLabel(ri.product_id),
    Tipo: ri.item_type === 'battery' ? 'Batería' : 'Accesorio/Kit',
    rental_id: ri.rental_id,
    product_id: ri.product_id,
  }));

  const pagosAlquiler: Row[] = d.payments.map(p => ({
    Alquiler: rentalLabel(d.rentals.find(r => r.id === p.rental_id)),
    Monto: p.amount ?? 0,
    Fecha: s(p.payment_date),
    Método: s(p.payment_method),
    Vía: s(p.received_via),
    rental_id: p.rental_id,
  }));

  const ventas: Row[] = d.sales.map(sa => ({
    Cliente: custLabel(sa.customer_id),
    Fecha: s(sa.sale_date),
    'Tipo pago': s(sa.payment_type),
    Total: sa.total_amount ?? 0,
    Anticipo: sa.down_payment ?? 0,
    Estado: s(sa.status),
    Idioma: s(sa.email_language),
    Notas: s(sa.notes),
    id: sa.id,
  }));

  const ventaItems: Row[] = d.saleItems.map(si => ({
    Venta: saleLabel(si.sale_id),
    Producto: prodLabel(si.product_id),
    'Precio unit.': si.unit_price ?? 0,
    sale_id: si.sale_id,
    product_id: si.product_id,
  }));

  const finPlanes: Row[] = d.financingPlans.map(fp => ({
    Venta: saleLabel(fp.sale_id),
    'Total financiado': fp.total_financed ?? 0,
    Cuotas: fp.num_installments ?? 0,
    'Monto cuota': fp.installment_amount ?? 0,
    Frecuencia: s(fp.payment_frequency),
    Inicio: s(fp.start_date),
    Estado: s(fp.status),
    id: fp.id,
    sale_id: s(fp.sale_id),
  }));

  const finCuotas: Row[] = d.financingPayments.map(fc => {
    const plan = planById.get(fc.financing_plan_id);
    return {
      Plan: saleLabel(plan?.sale_id),
      'N° cuota': fc.installment_number ?? 0,
      Monto: fc.amount ?? 0,
      Vencimiento: s(fc.due_date),
      Pagada: yesNo(fc.paid_date),
      'Fecha pago': s(fc.paid_date),
      Estado: s(fc.status),
      Vía: s(fc.received_via),
      financing_plan_id: fc.financing_plan_id,
    };
  });

  const serviceTaller: Row[] = d.records.map(r => ({
    Bici: prodLabel(r.bike_id),
    Fecha: s(r.service_date),
    Lugar: s(r.location),
    Descripción: s(r.description),
    Costo: r.cost ?? 0,
    'Realizado por': s(r.performed_by),
    id: r.id,
    bike_id: s(r.bike_id),
  }));

  const modificaciones: Row[] = d.bikeModifications.map(m => ({
    Bici: prodLabel(m.bike_id),
    Fecha: s(m.modification_date),
    Descripción: s(m.description),
    id: m.id,
    bike_id: s(m.bike_id),
  }));

  const leadsRows: Row[] = d.leads.map(l => ({
    Nombre: s(l.name),
    Email: s(l.email),
    Teléfono: s(l.phone),
    Categoría: l.category_id ? (leadCatById.get(l.category_id)?.name_es ?? '') : '',
    Interés: s(l.interested_in),
    Estado: s(l.status),
    'Seguimiento fecha': s(l.follow_up_date),
    'Seguimiento acción': s(l.follow_up_action),
    Notas: s(l.notes),
    Alta: s(l.created_at),
    id: l.id,
  }));

  const proveedores: Row[] = d.suppliers.map(sp => ({
    Nombre: s(sp.name),
    Contacto: s(sp.contact_name),
    Teléfono: s(sp.phone),
    Email: s(sp.email),
    Web: s(sp.website),
    Dirección: s(sp.address),
    Notas: s(sp.notes),
    id: sp.id,
  }));

  const proveedorProductos: Row[] = d.supplierProducts.map(sp => ({
    Proveedor: supplierById.get(sp.supplier_id)?.name ?? sp.supplier_id,
    Producto: s(sp.name),
    Categoría: s(sp.category),
    Costo: sp.cost ?? 0,
    MOQ: sp.moq ?? 0,
    'Entrega (días)': sp.delivery_time_days ?? '',
    Specs: s(sp.specs),
    URL: s(sp.product_url),
    supplier_id: sp.supplier_id,
  }));

  const cuentasReparto: Row[] = d.appAccounts.map(a => ({
    Plataforma: platformById.get(a.platform_id)?.name ?? '',
    Vehículo: vehicleById.get(a.vehicle_type_id)?.name ?? '',
    'N° cuenta': s(a.platform_account_number),
    Titular: s(a.owner_name),
    Usuario: s(a.username),
    Contraseña: s(a.password),
    Email: s(a.email),
    'Datos bancarios': s(a.bank_details),
    'Tarifa semanal': a.weekly_rate ?? 0,
    Estado: s(a.status),
    'Renter actual': custLabel(a.current_renter_id),
    Inicio: s(a.start_date),
    Fin: s(a.end_date),
    id: a.id,
  }));

  const cuentasNotas: Row[] = d.accountNotes.map(n => ({
    Cuenta: accountLabel(n.account_id),
    Nota: s(n.note),
    Fecha: s(n.date),
    account_id: n.account_id,
  }));

  const cuentasGanancias: Row[] = d.accountEarnings.map(e => ({
    Cuenta: accountLabel(e.account_id),
    Monto: e.amount ?? 0,
    Fecha: s(e.date),
    Notas: s(e.notes),
    account_id: e.account_id,
  }));

  // ---- assemble workbook ----
  const wb = XLSX.utils.book_new();

  const sheets: { name: string; rows: Row[] }[] = [
    { name: 'Transacciones', rows: transactions },
    { name: 'Stock', rows: stock },
    { name: 'Modelos', rows: modelos },
    { name: 'Usuarios', rows: usuarios },
    { name: 'Alquileres', rows: alquileres },
    { name: 'Alquiler_Items', rows: alquilerItems },
    { name: 'Pagos_Alquiler', rows: pagosAlquiler },
    { name: 'Ventas', rows: ventas },
    { name: 'Venta_Items', rows: ventaItems },
    { name: 'Financiacion_Planes', rows: finPlanes },
    { name: 'Financiacion_Cuotas', rows: finCuotas },
    { name: 'Service_Taller', rows: serviceTaller },
    { name: 'Modificaciones_Bicis', rows: modificaciones },
    { name: 'Leads', rows: leadsRows },
    { name: 'Proveedores', rows: proveedores },
    { name: 'Proveedor_Productos', rows: proveedorProductos },
    { name: 'Cuentas_Reparto', rows: cuentasReparto },
    { name: 'Cuentas_Notas', rows: cuentasNotas },
    { name: 'Cuentas_Ganancias', rows: cuentasGanancias },
  ];

  // Cover sheet with per-tab counts
  const today = new Date().toISOString().split('T')[0];
  const resumen: (string | number)[][] = [
    ['The Fast Sheep — Backup'],
    ['Fecha', today],
    [],
    ['Pestaña', 'Filas'],
    ...sheets.map(sh => [sh.name, sh.rows.length]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');

  for (const sh of sheets) {
    const ws = sh.rows.length > 0
      ? XLSX.utils.json_to_sheet(sh.rows)
      : XLSX.utils.aoa_to_sheet([['(sin datos)']]);
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  }

  return wb;
}

export function downloadBackupXlsx(data: BackupData): string {
  const wb = buildBackupWorkbook(data);
  const today = new Date().toISOString().split('T')[0];
  const filename = `the-fast-sheep-backup-${today}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
