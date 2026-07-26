-- Datos fiscales de The Fast Sheep Limited.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.
--
-- Estos datos aparecen en la cabecera de cada documento emitido. Cada
-- documento congela una copia en company_snapshot al emitirse, asi que
-- cambiar algo aqui no reescribe los documentos ya emitidos.

update company_settings set
  legal_name = 'The Fast Sheep Limited',
  address    = E'Irish Formations, Unit 3D North Point House\n'
               'North Point Business Park, New Mallow Road\n'
               'Cork T23 AT2P, Ireland',
  cro_number = '802654',
  vat_number = 'IE4749594AH',
  accounting_email = 'facturacion@thefastsheep.com',
  default_vat_rate = 23,
  -- El PDF se genera en el servidor (Edge Function), donde la ruta
  -- /logo.png del front no existe: tiene que ser una URL absoluta y
  -- accesible sin login.
  --
  -- Apunta a la version reducida (200x200, 48 KB) y no al logo original
  -- de 676x676 y 280 KB: el logo se empotra en cada PDF, y con el
  -- original cada factura pesaba 324 KB en vez de 48 KB.
  logo_url = 'https://admin.thefastsheep.com/logo-invoice.png',
  invoice_footer = 'The Fast Sheep Limited · CRO 802654 · VAT IE4749594AH'
where id = 1;
