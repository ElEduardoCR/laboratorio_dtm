# ContextoV1 — Historial del Sistema

Resumen cronológico del sistema de gestión de laboratorio DTM (Next.js 15 + Supabase + Tailwind). Cada entrada refleja un commit con su fecha, objetivo y cambios relevantes.

---

## Stack y convenciones

- **Framework**: Next.js 15 (App Router, `"use client"`).
- **Base de datos**: Supabase (Postgres + Storage + RLS con políticas abiertas — app monoinquilino).
- **Estilos**: Tailwind CSS con color corporativo `dtm-blue`.
- **Íconos**: `lucide-react`.
- **Zona horaria**: `America/Mexico_City` para bloqueos diarios y semanales.
- **Storage bucket único**: `review-photos` (reutilizado para fotos, videos y PDFs).
- **Fechas ISO**: `YYYY-MM-DD` en campos `review_date`.

---

## Línea del tiempo

### 2026-04-11 — Fundación

- **15:37 · `083994e` · Initial commit from Create Next App**
  Bootstrap del proyecto.

- **15:51 · `8071cdc` · Initial commit con proyecto Next JS base**
  Scaffolding base, layout global, configuración Tailwind y Supabase.

- **21:27 · `cf95493` · Dashboard con 6 módulos y módulo POI completo**
  - Panel principal con 6 tiles (POI, Pozos, Mantenimiento, Tanques, Inventario, Recaudación).
  - Módulo POI: lista, detalle con métricas, historial de revisiones.

- **21:32 · `b5d2012` · Formulario dedicado de alta de POI**
  Alta de plantas con nombre, ubicación y zona (urbana/rural).

- **21:39 · `1ab1ecd` · Revisión diaria en página dedicada con bloqueo diario**
  Primera versión de revisión diaria con bloqueo en CDMX (hasta 00:01 del día siguiente) y placeholder semanal.

---

### 2026-04-14 — Revisión diaria productiva y fixes iOS

- **13:27 · `34d779a` · Revisión diaria con cloro E/S, dureza E/S y fotos obligatorias**
  - Campos: cloro entrada/salida, dureza entrada/salida, peso de cilindro, observaciones.
  - 4 fotos obligatorias como evidencia.
  - Historial con filtros diarias/semanales/mensuales (por muestreo de `daily_reviews`).

- **13:43 · `498cf8e` · Polyfills Safari/iOS**
  `Object.hasOwn`, `Array.at` y otros para compatibilidad iOS.

- **13:53 · `7b126a3` · Fix insert + subida de fotos desde iPhone**
  Corrección de error al insertar revisión diaria y mejora en la captura de fotos desde iPhone.

- **14:02 · `a5d57e1` · Botón de regreso al panel en listado de POI**
  Navegación consistente entre pantallas.

---

### 2026-04-16 — Revisión semanal, tanques y proveedor

- **16:27 · `fa88eec` · Formulario de revisión semanal con 8 secciones**
  Selector inicial de operatividad. Si está en operación, 8 secciones con semáforos y evidencias:
  1. Sistema de monedas (2 fotos)
  2. Revisión de sal (surtido/vaciado en kg + foto)
  3. Videos de entrada y salida de tanques
  4. Pretratamiento (filtros multimedia, carbón, resinas con semáforo + foto)
  5. Filtro de sedimentos (foto)
  6. Sistema de ósmosis inversa (foto de 50/50 flujómetros)
  7. Filtro BigBlue (semáforo + foto)
  8. Lámpara UV balast (foto)

  Tabla `weekly_reviews` creada con unique `(poi_id, review_date)`.

- **16:47 · `1f1607a` · Módulo de tanques de gas-cloro con trazabilidad completa**
  - Tablas `tanks` y `tank_events`.
  - Alta con ID único administrado, peso inicial.
  - Asignación a POI con decremento de peso.
  - Envío masivo a proveedor GSG Supplies con orden de compra (1 PDF compartido entre varios tanques).
  - Baja con certificado de auditor.
  - Historial de eventos (compra, asignación, retiro, envío, baja, lectura de peso).

- **17:05 · `622f05a` · Recepción masiva de tanques desde proveedor**
  - Página `/tanques/recibir-proveedor` con multi-select.
  - Al recibir: estatus → `almacen`, peso → `initial_weight_kg`, documento de evidencia obligatorio.
  - Distingue en almacén: llenos sin uso vs vacíos esperando proveedor.

---

### 2026-04-17 — Pozos, mantenimiento, inventario, recaudación

- **20:58 · `0dc00c7` · Módulo de pozos con revisión diaria de cloro y eventos de mantenimiento**
  - Tablas `pozos`, `well_daily_reviews`, `maintenance_events` + columnas `tanks.current_pozo_id` y `tank_events.pozo_id`.
  - Alta de pozos: identifier, estado operacional, sistema clorador, dirección, punto de muestreo.
  - Asignación de tanques de gas-cloro a pozos (además de plantas).
  - Revisión diaria con cloro residual (mg/L) + foto, bloqueada hasta 00:01 CDMX del día siguiente.
  - Generación automática de eventos de mantenimiento si el cloro sale del umbral (>1.5 mg/L) o si el clorador está dañado.
  - Listado `/mantenimiento` con filtros (abierto/en_proceso/cerrado/todos) y acciones Tomar/Cerrar/Reabrir.
  - Activación de tiles "Pozos" y "Mantenimiento" en el panel.

- **23:27 · `eb223b1` · Módulo de inventario con cuenta de gasto por POI y pozo**
  - Tablas `inventory_items`, `inventory_entries`, `inventory_usages` con RLS abierto.
  - Alta de SKU: código único, descripción, unidad, proveedor, cantidad por proveedor, precio.
  - Entrada de material `/inventario/entrada` con archivo de orden de compra (PDF/imagen) y actualización automática de existencias.
  - Detalle de SKU con historial de entradas y salidas.
  - Detalle de evento de mantenimiento `/mantenimiento/[id]` con asignación de material (descuenta inventario, permite revertir con restitución).
  - Cuenta de gasto en detalle de POI y detalle de pozo con total acumulado y enlaces al evento originador.
  - Activación de tile "Inventario".

- **23:32 · `710d253` · Módulo de recaudación con estadísticas semanales y mensuales**
  - Columna `collection_amount` en `weekly_reviews`.
  - Campo de monto recaudado en el formulario de revisión semanal (sección 1, Sistema de Monedas).
  - `/recaudacion` con métricas: total semana / mes / año / promedio por POI operacional.
  - POIs operacionales pendientes de reportar en la semana (enlaces directos a su revisión).
  - Destacado del POI líder del mes.
  - Gráfico de tendencia de las últimas 8 semanas.
  - Ranking mensual por POI con semana / mes / año.
  - Activación del tile "Recaudación".

- **23:42 · `14f6345` · Bloqueo semanal lun 00:01 CDMX y visibilidad de revisiones semanales**
  - La revisión semanal se bloquea si ya existe una en la semana actual (lun–dom CDMX) y muestra fecha del último registro y fecha/hora del próximo desbloqueo.
  - La pestaña "Semanales" en el detalle de POI ahora lee de la tabla `weekly_reviews` (antes mostraba muestreo de `daily_reviews`).
  - Se muestran recaudación, sal, estatus de los 4 filtros con semáforo y toda la evidencia fotográfica/video en acordeón expandible.

- **23:47 · `d6f0099` · Modal para foto/video con botón de descarga**
  - Nuevo componente reutilizable `src/components/MediaThumb.tsx`.
  - Al hacer click en una miniatura se abre un modal a pantalla completa (antes abría pestaña nueva).
  - Controles nativos para video, botón de descarga (usa `fetch` + blob para Supabase Storage), cierre con Escape o click fuera.
  - Integrado en historial diario y semanal de POI y en historial diario de pozo.
  - Las OC de inventario y tanques siguen como enlaces directos por ser PDFs.

---

## Estructura de módulos (a la fecha)

| Módulo | Ruta base | Estado |
|---|---|---|
| Panel principal | `/` | Activo |
| Plantas (POI) | `/poi` | Activo |
| Pozos | `/pozos` | Activo |
| Mantenimiento | `/mantenimiento` | Activo |
| Tanques de gas-cloro | `/tanques` | Activo |
| Inventario | `/inventario` | Activo |
| Recaudación | `/recaudacion` | Activo |

---

## Tablas principales en Supabase

- `poi` — plantas con ubicación, zona, estado operacional.
- `daily_reviews` — revisión diaria de POI (cloro, dureza, cilindro).
- `weekly_reviews` — revisión semanal de POI (8 secciones + `collection_amount`).
- `pozos` — pozos con identifier, sistema clorador, dirección, muestreo.
- `well_daily_reviews` — revisión diaria de pozos (cloro residual mg/L).
- `maintenance_events` — eventos de mantenimiento vinculados a POI o pozo.
- `tanks` — tanques de gas-cloro con peso actual/inicial, estatus, FKs a POI o pozo.
- `tank_events` — historial de eventos por tanque (compra, asignación, envío, recepción, baja, lectura de peso).
- `inventory_items` — catálogo de SKUs con precio y existencia.
- `inventory_entries` — entradas de material con orden de compra adjunta.
- `inventory_usages` — salidas vinculadas a evento de mantenimiento, POI o pozo.

---

## Reglas de negocio clave

- **Revisión diaria de POI**: una por día por POI; desbloquea a las 00:01 CDMX del día siguiente.
- **Revisión diaria de pozo**: una por día por pozo; desbloquea a las 00:01 CDMX del día siguiente. Umbral de cloro residual: 1.5 mg/L.
- **Revisión semanal de POI**: una por semana por POI (lun–dom CDMX); desbloquea el lunes siguiente a las 00:01 CDMX.
- **Asignación de tanque**: un tanque `asignado` ocupa un POI o un pozo, nunca ambos; la revisión diaria correspondiente actualiza su peso.
- **Evento de mantenimiento cerrado**: no permite agregar ni revertir material utilizado.
- **Material asignado a evento**: descuenta de inventario al asignar; al revertir (solo si no está cerrado) se restituye la existencia.
