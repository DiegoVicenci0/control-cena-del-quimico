-- Migración: Bitácora precisa de Entradas, Salidas y Reingresos
CREATE TABLE IF NOT EXISTS public.movimientos_acceso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_num integer NOT NULL REFERENCES public.mesas(mesa_num) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida', 'reingreso')),
  registrado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_mesa_nombre ON public.movimientos_acceso(mesa_num, nombre);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON public.movimientos_acceso(registrado_at DESC);

ALTER TABLE public.movimientos_acceso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso lectura/escritura movimientos_acceso" ON public.movimientos_acceso;
CREATE POLICY "Acceso lectura/escritura movimientos_acceso" ON public.movimientos_acceso
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'movimientos_acceso'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_acceso;
  END IF;
END $$;
