-- Esquema dedicado para Cena del Químico (proyecto Supabase independiente)
CREATE TABLE IF NOT EXISTS public.evento_config (
  id integer PRIMARY KEY DEFAULT 1,
  titulo text NOT NULL DEFAULT 'Cena del Químico 2026',
  subtitulo text NOT NULL DEFAULT 'Facultad de Ciencias Químicas · UdeC',
  fecha text NOT NULL DEFAULT 'Por confirmar',
  hora text NOT NULL DEFAULT '8:00 PM',
  lugar text NOT NULL DEFAULT 'Salón del Evento',
  vestimenta text NOT NULL DEFAULT 'Formal / Etiqueta',
  costo_boleto numeric NOT NULL DEFAULT 700,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.evento_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.mesas (
  mesa_num integer PRIMARY KEY,
  nombre_mesa text NOT NULL,
  capacidad integer NOT NULL DEFAULT 12,
  ubicacion_u text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invitados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_num integer NOT NULL REFERENCES public.mesas(mesa_num) ON DELETE CASCADE,
  asiento integer NOT NULL,
  nombre text NOT NULL,
  pago_monto numeric NOT NULL DEFAULT 0,
  pago_estado text NOT NULL DEFAULT 'pendiente',
  nota text,
  asistio boolean NOT NULL DEFAULT false,
  hora_llegada timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mesa_num, nombre)
);

CREATE TABLE IF NOT EXISTS public.movimientos_acceso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_num integer NOT NULL REFERENCES public.mesas(mesa_num) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida', 'reingreso')),
  registrado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitados_mesa ON public.invitados(mesa_num);
CREATE INDEX IF NOT EXISTS idx_invitados_asistio ON public.invitados(asistio);
CREATE INDEX IF NOT EXISTS idx_movimientos_mesa_nombre ON public.movimientos_acceso(mesa_num, nombre);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON public.movimientos_acceso(registrado_at DESC);

ALTER TABLE public.evento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_acceso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso lectura/escritura evento_config" ON public.evento_config;
CREATE POLICY "Acceso lectura/escritura evento_config" ON public.evento_config
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso lectura/escritura mesas" ON public.mesas;
CREATE POLICY "Acceso lectura/escritura mesas" ON public.mesas
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso lectura/escritura invitados" ON public.invitados;
CREATE POLICY "Acceso lectura/escritura invitados" ON public.invitados
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso lectura/escritura movimientos_acceso" ON public.movimientos_acceso;
CREATE POLICY "Acceso lectura/escritura movimientos_acceso" ON public.movimientos_acceso
  FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.invitados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_acceso;
