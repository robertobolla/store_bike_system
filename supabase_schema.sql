-- ============================================================
-- The Fast Sheep – Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  is_deletable BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- SERIAL PREFIXES
-- ============================================================
CREATE TABLE IF NOT EXISTS serial_prefixes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prefix TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text'
);

-- ============================================================
-- PRODUCT MODELS (brand + model template with suggested rates)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  prefix_id UUID REFERENCES serial_prefixes(id) ON DELETE SET NULL,
  brand TEXT NOT NULL DEFAULT '',
  model_name TEXT NOT NULL DEFAULT '',
  suggested_weekly_rate NUMERIC NOT NULL DEFAULT 0,
  suggested_deposit NUMERIC NOT NULL DEFAULT 0,
  motor_brand TEXT,
  battery_capacity TEXT,
  wheel_size TEXT,
  image_url TEXT
);

-- ============================================================
-- PRODUCTS (individual inventory items)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID REFERENCES product_models(id) ON DELETE SET NULL,
  serial_number TEXT NOT NULL,
  prefix_id UUID REFERENCES serial_prefixes(id) ON DELETE SET NULL,
  price_paid NUMERIC NOT NULL DEFAULT 0,
  price_sold NUMERIC,
  sold_date DATE,
  status TEXT NOT NULL DEFAULT 'Disponible',
  notes TEXT NOT NULL DEFAULT '',
  odometer NUMERIC NOT NULL DEFAULT 0,
  frame_serial TEXT,
  battery_serial TEXT,
  key_number TEXT,
  purchase_date DATE,
  arrival_date DATE,
  factory_claim BOOLEAN NOT NULL DEFAULT false,
  factory_claim_notes TEXT,
  maintenance_status TEXT NOT NULL DEFAULT 'Al día',
  last_service_date DATE,
  last_service_location TEXT,
  next_service_date DATE,
  next_service_odometer NUMERIC,
  odometer_last_updated DATE,
  remind_service_one_week BOOLEAN NOT NULL DEFAULT true,
  remind_service_one_day BOOLEAN NOT NULL DEFAULT true,
  remind_service_odometer_threshold NUMERIC NOT NULL DEFAULT 50,
  custom_field_values JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  id_document_url TEXT NOT NULL DEFAULT '',
  referral_source TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RENTALS
-- ============================================================
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bike_id UUID REFERENCES products(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  has_insurance BOOLEAN NOT NULL DEFAULT false,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  rental_rate NUMERIC NOT NULL DEFAULT 0,
  rate_type TEXT NOT NULL DEFAULT 'semanal',
  start_date DATE NOT NULL,
  end_date DATE,
  scheduled_return_date DATE NOT NULL,
  return_notice_date DATE,
  odometer_start NUMERIC NOT NULL DEFAULT 0,
  odometer_end NUMERIC,
  status TEXT NOT NULL DEFAULT 'Activo',
  contract_type TEXT NOT NULL DEFAULT 'digital',
  contract_url TEXT,
  condition_photos JSONB NOT NULL DEFAULT '[]',
  instagram_photos JSONB NOT NULL DEFAULT '[]',
  has_kit BOOLEAN NOT NULL DEFAULT false,
  kit_details TEXT NOT NULL DEFAULT '',
  deposit_refunded NUMERIC,
  damage_report TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RENTAL ITEMS (batteries, locks associated with a rental)
-- ============================================================
CREATE TABLE IF NOT EXISTS rental_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'battery'
);

-- ============================================================
-- RENTAL PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS rental_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL
);

-- ============================================================
-- MAINTENANCE EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  cost NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  rental_id UUID REFERENCES rentals(id) ON DELETE SET NULL
);

-- ============================================================
-- LEAD CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES lead_categories(id) ON DELETE SET NULL,
  interested_in TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Nuevo',
  follow_up_date DATE,
  follow_up_action TEXT,
  follow_up_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- SUPPLIER PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Bicicleta',
  cost NUMERIC NOT NULL DEFAULT 0,
  moq INTEGER NOT NULL DEFAULT 1,
  delivery_time_days INTEGER NOT NULL DEFAULT 7,
  specs TEXT NOT NULL DEFAULT '',
  product_url TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- APP PLATFORMS & VEHICLE TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS app_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_vehicle_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL
);

-- ============================================================
-- APP ACCOUNTS (gig economy accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id UUID REFERENCES app_platforms(id) ON DELETE SET NULL,
  vehicle_type_id UUID REFERENCES app_vehicle_types(id) ON DELETE SET NULL,
  platform_account_number TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  bank_details TEXT NOT NULL DEFAULT '',
  weekly_rate NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  current_renter_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Activa'
);

-- ============================================================
-- APP ACCOUNT NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS app_account_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES app_accounts(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- APP ACCOUNT EARNINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS app_account_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES app_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- COMPANY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS company_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_date DATE NOT NULL,
  remind_one_week BOOLEAN NOT NULL DEFAULT true,
  remind_one_day BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'Pendiente'
);

-- ============================================================
-- MAINTENANCE RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bike_id UUID REFERENCES products(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cost NUMERIC NOT NULL DEFAULT 0,
  performed_by TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- QUICK REPLIES (saved text snippets)
-- ============================================================
CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SALES (groups multiple products into a single sale/order)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  sale_date DATE NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'contado',  -- 'contado' | 'financiado'
  total_amount NUMERIC NOT NULL DEFAULT 0,
  down_payment NUMERIC NOT NULL DEFAULT 0,
  email_language TEXT NOT NULL DEFAULT 'es',  -- 'es' | 'en' | 'pt'
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Completada',  -- 'Completada' | 'Financiada' | 'Cancelada'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SALE ITEMS (individual products within a sale)
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0
);

-- ============================================================
-- FINANCING PLANS (installment plan for a financed sale)
-- ============================================================
CREATE TABLE IF NOT EXISTS financing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  total_financed NUMERIC NOT NULL DEFAULT 0,  -- total_amount - down_payment
  num_installments INTEGER NOT NULL DEFAULT 1,
  installment_amount NUMERIC NOT NULL DEFAULT 0,
  payment_frequency TEXT NOT NULL DEFAULT 'mensual',  -- 'semanal' | 'mensual'
  start_date DATE NOT NULL,  -- date of first installment
  status TEXT NOT NULL DEFAULT 'Activo',  -- 'Activo' | 'Completado' | 'Cancelado'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FINANCING PAYMENTS (individual installment records)
-- ============================================================
CREATE TABLE IF NOT EXISTS financing_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  financing_plan_id UUID REFERENCES financing_plans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'Pendiente',  -- 'Pendiente' | 'Pagada' | 'Vencida'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS: Disable Row Level Security for all tables (dev mode)
-- Enable RLS with proper policies before going to production!
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_prefixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_account_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_account_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_payments ENABLE ROW LEVEL SECURITY;

-- Allow both anon and authenticated full access (development only – restrict in production)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'categories','serial_prefixes','custom_field_definitions','product_models',
    'products','customers','rentals','rental_items','rental_payments',
    'maintenance_expenses','lead_categories','leads','suppliers','supplier_products',
    'app_platforms','app_vehicle_types','app_accounts','app_account_notes',
    'app_account_earnings','company_events','maintenance_records','quick_replies',
    'sales','sale_items','financing_plans','financing_payments'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "dev_all_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "dev_all_%s" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END;
$$;

-- ============================================================
-- STORAGE: product-images bucket (run this in Supabase SQL Editor)
-- ============================================================

-- 1. Create the storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload images
DROP POLICY IF EXISTS "auth_upload_product_images" ON storage.objects;
CREATE POLICY "auth_upload_product_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- 3. Allow authenticated users to update/overwrite their uploads
DROP POLICY IF EXISTS "auth_update_product_images" ON storage.objects;
CREATE POLICY "auth_update_product_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

-- 4. Allow public read access to product images
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

-- 5. Add image_url column to products if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ADD COLUMN image_url TEXT;
  END IF;
END;
$$;

-- 6. Add prefix_id and image_url to product_models if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_models' AND column_name = 'prefix_id'
  ) THEN
    ALTER TABLE product_models ADD COLUMN prefix_id UUID REFERENCES serial_prefixes(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_models' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE product_models ADD COLUMN image_url TEXT;
  END IF;
END;
$$;

-- 7. Add motor_brand to products if it doesn't exist (to store specific motor number/serial)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'motor_brand'
  ) THEN
    ALTER TABLE products ADD COLUMN motor_brand TEXT;
  END IF;
END;
$$;


-- ============================================================
-- STORAGE: rider-documents and rental-photos buckets
-- ============================================================

-- 1. Create rider-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rider-documents',
  'rider-documents',
  true,
  5242880,  -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create rental-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rental-photos',
  'rental-photos',
  true,
  5242880,  -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow anon and authenticated users to upload documents to rider-documents
DROP POLICY IF EXISTS "public_upload_rider_documents" ON storage.objects;
CREATE POLICY "public_upload_rider_documents"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'rider-documents');

-- 4. Allow anon and authenticated users to update/overwrite uploads in rider-documents
DROP POLICY IF EXISTS "public_update_rider_documents" ON storage.objects;
CREATE POLICY "public_update_rider_documents"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'rider-documents');

-- 5. Allow public read access to rider-documents
DROP POLICY IF EXISTS "public_read_rider_documents" ON storage.objects;
CREATE POLICY "public_read_rider_documents"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'rider-documents');

-- 6. Allow anon and authenticated users to upload photos to rental-photos
DROP POLICY IF EXISTS "public_upload_rental_photos" ON storage.objects;
CREATE POLICY "public_upload_rental_photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'rental-photos');

-- 7. Allow anon and authenticated users to update/overwrite uploads in rental-photos
DROP POLICY IF EXISTS "public_update_rental_photos" ON storage.objects;
CREATE POLICY "public_update_rental_photos"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'rental-photos');

-- 8. Allow public read access to rental-photos
DROP POLICY IF EXISTS "public_read_rental_photos" ON storage.objects;
CREATE POLICY "public_read_rental_photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'rental-photos');

-- ============================================================
-- UPGRADE: Add instagram_photos column to rentals if it doesn't exist
-- ============================================================
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS instagram_photos JSONB NOT NULL DEFAULT '[]';

-- ============================================================
-- EMAIL TEMPLATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key TEXT NOT NULL,       -- 'sale_contado', 'financing_welcome', 'installment_reminder'
  language TEXT NOT NULL,           -- 'es', 'en', 'pt'
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,          -- Cuerpo del mensaje con etiquetas del tipo {{CLIENT_NAME}}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_key, language)
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "dev_all_email_templates" ON email_templates';
  EXECUTE 'CREATE POLICY "dev_all_email_templates" ON email_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
END;
$$;

-- Insert email templates for rentals and financing completion
INSERT INTO email_templates (template_key, language, subject, body_text) VALUES
('rental_confirmation', 'es', 'Confirmación de alquiler de bicicleta - The Fast Sheep', 'Hola {{CLIENT_NAME}},

Gracias por elegir The Fast Sheep.

Aquí están los detalles de tu alquiler:
- Fecha de inicio: {{START_DATE}}
- Costo de alquiler ({{RATE_TYPE}}): {{RENTAL_RATE}}
- Depósito de seguridad: {{DEPOSIT_AMOUNT}}

Por favor conserva este email como comprobante. Si tienes alguna duda, contáctanos.

Saludos,
El equipo de The Fast Sheep'),

('rental_payment_reminder', 'es', 'Recordatorio de pago de alquiler - The Fast Sheep', 'Hola {{CLIENT_NAME}},

Te recordamos que hoy es el día de pago de tu alquiler por el monto de {{RENTAL_RATE}}.

Por favor, realiza el pago a la brevedad para evitar recargos o la interrupción del servicio. Si ya realizaste el pago, por favor ignora este mensaje.

Saludos,
El equipo de The Fast Sheep'),

('financing_completed', 'es', '¡Felicidades! Has completado tu financiación - The Fast Sheep', 'Hola {{CLIENT_NAME}},

Queremos agradecerte y felicitarte por haber abonado exitosamente la última cuota de tu financiación. 

¡La bicicleta ahora es completamente tuya! Gracias por confiar en The Fast Sheep. Esperamos que la sigas disfrutando al máximo.

Saludos,
El equipo de The Fast Sheep')
ON CONFLICT (template_key, language) DO UPDATE 
SET subject = EXCLUDED.subject, body_text = EXCLUDED.body_text;

-- ============================================================
-- TASK CARDS (To-Do List columns/categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TASK ITEMS (Checklist items within a card)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID REFERENCES task_cards(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TASK COLOR TAGS (Hex color label mappings)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_color_tags (
  color TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

ALTER TABLE task_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_color_tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "dev_all_task_cards" ON task_cards';
  EXECUTE 'CREATE POLICY "dev_all_task_cards" ON task_cards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "dev_all_task_items" ON task_items';
  EXECUTE 'CREATE POLICY "dev_all_task_items" ON task_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';

  EXECUTE 'DROP POLICY IF EXISTS "dev_all_task_color_tags" ON task_color_tags';
  EXECUTE 'CREATE POLICY "dev_all_task_color_tags" ON task_color_tags FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
END;
$$;

-- ============================================================
-- UPGRADE: Add category_id to serial_prefixes if it doesn't exist
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serial_prefixes' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE serial_prefixes ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END;
$$;


