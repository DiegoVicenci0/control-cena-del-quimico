# Cena del Químico · Control de Mesas, QR y Asistencia

Aplicación web desplegable en **GitHub Pages** con respaldo en tiempo real en **Supabase** (base de datos independiente del proyecto de Resguardos) y sincronización bidireccional con **`Cena del quimico acomodo.xlsx`**.

## Funcionalidades
1. **Escáner QR / Check-in en Recepción:** Escanea el QR de la mesa con la cámara del celular (o abre `?mesa=N`), despliega los nombres de esa mesa con su estado de pago y te permite marcar quién ya llegó antes de registrar su ingreso.
2. **Panel "Gente Dentro":** Contador en vivo de cuántas personas han ingresado, progreso por mesa y búsqueda rápida.
3. **Tarjetas QR Bonitas por Mesa:** Genera las 15 tarjetas imprimibles (PDF o PNG individual) con los datos del evento.
4. **Sincronización con Excel:** Carga tu `.xlsx` actualizado sin perder asistencias registradas, o descarga el reporte final de asistencia.

## Despliegue rápido (GitHub Pages + Supabase)

### 1. Crear proyecto nuevo en Supabase (aparte de Resguardos)
1. En [Supabase](https://supabase.com/dashboard), crea un proyecto nuevo (ej. `cena-quimico-2026`).
2. Ve a **SQL Editor** y ejecuta primero `supabase/schema.sql`.
3. Luego ejecuta `supabase/seed.sql` (ya incluye las 15 mesas y los 137 invitados cargados desde tu Excel).
4. Copia tu **Project URL** y **anon public key** (en *Project Settings → API*).

### 2. Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub (ej. `cena-quimico-app`).
2. En el repo, ve a **Settings → Secrets and variables → Actions** y agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. En **Settings → Pages → Source**, selecciona **GitHub Actions**.
4. Sube este repo (`git push -u origin main`) y GitHub Actions lo publicará automáticamente.
