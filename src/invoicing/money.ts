// Aritmetica de importes para facturacion.
//
// Deliberadamente separada de round1/fmt1 de App.tsx, que redondean a UN
// decimal. En un documento fiscal eso pierde centimos y descuadra el tipo
// declarado: un alquiler de 80 daria base 65.0 y VAT 15.0, o sea un
// 23.08%, no un 23%. Aqui se trabaja siempre a dos decimales.

export const VAT_RATE = 23;

export function round2(value: number): number {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
}

export interface VatBreakdown {
  subtotal: number;    // base imponible
  vat_rate: number;
  vat_amount: number;
  total: number;       // lo que paga el cliente
}

// VENTAS Y ALQUILERES: el precio de la app ya lleva el VAT dentro. El
// rider ve 80 y paga 80; la factura tiene que sacar la base hacia afuera.
//
//   Total  80.00
//   Base   65.04   (80 / 1.23)
//   VAT    14.96   (80 - 65.04)
//
// La base se redondea y el VAT sale por diferencia, nunca al reves: asi
// base + VAT da exactamente el total y no aparece el centimo de descuadre
// clasico de redondear ambos por separado.
export function splitVatInclusive(total: number, vatRate = VAT_RATE): VatBreakdown {
  const gross = round2(total);
  const subtotal = round2(gross / (1 + vatRate / 100));
  return {
    subtotal,
    vat_rate: vatRate,
    vat_amount: round2(gross - subtotal),
    total: gross,
  };
}

export interface ExpenseBreakdown {
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  amount: number;      // lo que se paga al proveedor
}

// COMPRAS: convencion opuesta, y es intencionada. En el formulario de
// Stock el coste se escribe SIN VAT y el 23% se suma encima, que es como
// cotiza un proveedor. Aplicar aqui splitVatInclusive daria un importe
// distinto al de la factura del proveedor.
export function addVat(net: number, vatRate = VAT_RATE): ExpenseBreakdown {
  const base = round2(net);
  const vat = round2(base * (vatRate / 100));
  return {
    net_amount: base,
    vat_rate: vatRate,
    vat_amount: vat,
    amount: round2(base + vat),
  };
}

// Gasto sin VAT (sueldos, alquiler del local, tasas).
export function noVat(amount: number): ExpenseBreakdown {
  const value = round2(amount);
  return { net_amount: value, vat_rate: 0, vat_amount: 0, amount: value };
}

const euro = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Los documentos van siempre en euros y en ingles, con dos decimales
// fijos: en una factura "65.0" esta mal escrito.
export function formatMoney(value: number): string {
  return euro.format(round2(value));
}
