# Spec · Consulta Diaria (Fisioterapia)

> Especificación **replicable y personalizable** de la aplicación `consulta-diaria.html`.
> Pensada para que cualquier fisioterapeuta pueda **desplegar su propia instancia** y adaptarla.
> Los dos únicos bloques que **cada fisio debe personalizar** están marcados con **🛠 PERSONALIZAR**:
> el **catálogo de ejercicios** y los **centros de salud** que se asignan a los médicos derivadores.
> El resto es común a todas las instancias.

## Register

product

## Users

Fisioterapeuta de Atención Primaria (SERMAS / SaludMadrid) en su consulta diaria. Contexto de uso:
pasar consulta con una hoja impresa de pacientes del día, registrar lo ocurrido en cada sesión y
volcar el resultado en el programa de historia clínica. Trabaja **en su propio dispositivo**
(tablet/iPad de la consulta o móvil), a menudo **sin teclado**, y necesita rapidez por toques.
Cada fisio maneja **sus propios pacientes** y su propio catálogo de ejercicios habituales.

## Product Purpose

Aplicación **autocontenida** (un único fichero HTML offline, sin servidor ni dependencias en
tiempo de ejecución más allá del OCR opcional) que cubre el día a día de la consulta:
capturar la hoja del día (foto o galería), marcar asistencia y hora, registrar evolución, pauta y
ejercicios, generar un **resumen clínico narrado** para pegar en el evolutivo, llevar el
**historial por paciente**, emitir el **informe de alta**, y ofrecer **estadísticas** de
efectividad, asistencia y derivación. Éxito = que el fisio termine el día con la historia clínica
al día en el mínimo de toques y sin escribir a mano lo que se pueda evitar.

## Brand Personality

Institucional, clínico, sobrio y fiable — con un aire actual. Autoridad tranquila de servicio
público sanitario (SERMAS / SaludMadrid). Tres palabras: **fiable, claro, clínico**. Debe
transmitir seriedad sanitaria, no “producto de consumo”.

## Anti-references

- Estética de app de consumo/startup poco seria para un entorno sanitario.
- Sobrecarga visual: gradientes llamativos, sombras fuertes, glassmorphism, franjas laterales de
  color (el “side-tab” es un anti-patrón explícito).
- Formularios que exijan teclado para lo que puede resolverse por toques.
- Enviar datos de pacientes a cualquier servidor.

## Design Principles

- **El toque manda.** Todo el flujo del día se resuelve con botones, segmentados, steppers y
  frases rápidas; el teclado es la excepción (nombre, notas libres).
- **El dato clínico es lo que importa.** Lo demás (cromo, adornos) se aparta.
- **Un vistazo primero.** Estado del día de un vistazo (KPIs, semáforo verde/rojo por asistencia).
- **Identidad SaludMadrid contenida.** Azul/rojo corporativos como acentos disciplinados.
- **Consistencia sobre sorpresa.** Mismo vocabulario visual en todas las pestañas.

## Accessibility & Inclusion

Objetivo WCAG 2.1 AA. Contraste de texto ≥ 4.5:1 (cuerpo) / ≥ 3:1 (grande). El estado nunca solo
por color (punto + etiqueta además del color). `:focus-visible` en todos los controles. Objetivos
táctiles ≥ 36–44 px. Campos a 16 px en móvil (evita el auto-zoom de iOS). `prefers-reduced-motion`
respetado. Paletas de gráficos verificadas para daltonismo (separación CVD) y contraste.

---

## Privacy & Data (obligatorio, común)

- **Todo se guarda solo en el navegador del dispositivo** (localStorage). No hay servidor ni
  telemetría. La foto de la hoja se procesa en local.
- **OCR opcional**: usa Tesseract.js cargado desde CDN la primera vez (única salida a internet).
  Sin conexión, se añade a mano.
- **Pseudoanonimización**: cada paciente tiene un **código** = iniciales del nombre y apellidos +
  4 últimos dígitos del **TIS** (p. ej. `MGL-1234`). Las exportaciones pueden sustituir el nombre
  por el código (casilla marcada por defecto).
- Uso previsto: dispositivo propio y bloqueado; exportar copia (.json) con regularidad; borrar
  los datos de navegación borra también los de la app.
- Claves de almacenamiento:
  - `cdFisio.datos.v1` — pacientes y sesiones.
  - `cdFisio.fotos.v1` — fotos de las hojas por día.
  - `cdFisio.medicos.v1` — **directorio de médicos** (CIAS → nombre/centro), **independiente**:
    sobrevive al “Borrar todos los datos”.

## Data model (común)

- **Paciente**: `{ id, nombre, creado, tis4, cias, fnac, alta }`.
  - `tis4` = 4 últimos dígitos del TIS. `cias` = código del médico derivador. `fnac` = fecha de
    nacimiento (→ edad calculada). `alta = { fecha, estado, motivo, obs } | null`.
- **Sesión**: `{ id, pacienteId, fecha, ord, tipoCita, horaCita, asistencia, horaLlegada,
  primera, evolucion, pauta, ejercicios[], obs }`.
  - `ord` = nº de orden de la hoja. `tipoCita ∈ {V, SES, TEL}` (SES por defecto).
  - `asistencia ∈ {pendiente, si, no}`. `evolucion ∈ {mejor, igual, peor}`.
  - `pauta ∈ {si, parcial, no}`. `primera` = 1ª sesión (booleano).
  - `ejercicio` = `{ tipo, series, reps, descanso, notas }`.
- **Directorio de médicos**: `medicos = { [cias]: { nombre, centro } }`.

---

## Features (común a todas las instancias)

### 1. Agenda del día
- Cabecera con **selector de día**.
- **Hoja del día**: subir imagen con **cámara o galería** (`<input accept="image/*">` sin
  `capture`, para que iOS/Android ofrezcan Fototeca / Hacer foto / Archivo). La imagen se comprime
  y se guarda por día; ampliable a pantalla completa.
- Controles: **Leer nombres (OCR)**, **Añadir por Ord.**, **Añadir paciente**, **Resetear captura**.
- Lista de citas con: punto de estado (verde acude / rojo no acude), nombre (con lápiz para
  corregir), **edad**, chip de **1ª sesión**, chip de **CIAS/médico + centro**, chip de nº de
  sesión, selector de **tipo de cita**, hora de cita.
- **Filtros**: buscador por nombre, vista **Todos / Pendientes** (oculta a los ya marcados),
  orden **por hora / por nombre**.
- KPIs del día: Citas · Han venido · No han venido · Pendientes.

### 2. OCR de la hoja
- De cada línea se extrae, **revisable antes de añadir**:
  - **Ord** (nº de orden, columna izquierda, único por paciente en el día).
  - **Tipo de cita**: prefijo `V` / `SES` / `TEL` de la hoja; **SES por defecto** si no aparece.
  - **Nombre y apellidos**: la racha más larga de palabras alfabéticas; descarta cifras y siglas
    administrativas (NHC, DNI, SALA, BOX…).
  - **Hora** (hh:mm).
  - **TIS** → 4 últimos dígitos (número “puro”; no confunde con DNI/CIAS que llevan letra).
  - **CIAS** del médico: token que **empieza por `160`** y termina en letra(s) (no se confunde con
    el DNI).
  - **Fecha de nacimiento** (dd/mm/aaaa) → edad.
- Pantalla de revisión: una tarjeta por línea, campos etiquetados (Ord, Tipo, Nombre, Hora, TIS,
  CIAS, F. nacimiento) que reparten el ancho y hacen wrap; casilla para incluir/excluir.
- **Añadir por Ord.**: introducir un nº de orden y leer de la foto **solo esa fila** (reutiliza el
  último escaneo o re-lee), para recuperar a quien el OCR se dejó. No duplica si ya está.

### 3. Registro de la sesión (sin teclado)
- **Asistencia**: «✓ Viene / ✗ No viene»; al marcar «Viene» se registra la **hora de llegada**
  automáticamente (editable). Deshacer disponible.
- **Evolución** (Mejor / Igual / Peor) y **Cumple la pauta** (Sí / Parcial / No) como segmentados.
- En **citas de valoración (V)**: nota de que normalmente aún no hay evolución que registrar.
- **Ejercicios pautados**: series y repeticiones con **steppers − / +**; descanso como desplegable;
  botón «Repetir los de la sesión anterior». Se añaden desde el **catálogo tocable** (ver 🛠).
- **Medios físicos** (bloque **plegable**, colapsado por defecto para no saturar): se añaden por
  tipo desde un selector y cada uno muestra **solo sus parámetros**:
  - **TENS**: frecuencia (Hz), tiempo de impulso (µs), tiempo de aplicación (min).
  - **Microonda**: potencia (W), tiempo (min).
  - **Onda corta**: frecuencia, **modo continuo/pulsado**, potencia (W), tiempo (min), aplicador
    (tipo/posición); si es **pulsado**: duración de pulso (µs), frecuencia de pulso (Hz) y
    potencia media/pico (W).
  - **Infrarrojo**: tiempo de aplicación (min) y distancia (cm) — potencia fija **250 W**.
- **Recomendaciones domiciliarias** (bloque plegable): texto libre con **frases rápidas**
  (termoterapia, crioterapia, reposo relativo, higiene postural).
- **Observaciones** con **frases rápidas** de un toque (distintas si acude / no acude).

### 4. Informe del día (evolutivo)
- Un bloque por paciente con **resumen clínico narrado**, en tono profesional, sin datos
  identificativos ni etiquetas: asistencia, evolución, ajuste de tratamiento y peculiaridades.
- **Nombre, fecha, hora y tipo de cita van fuera del texto a copiar** (como cabecera).
- **Las 1ª sesiones no generan informe de seguimiento** (se excluyen, con aviso).
- Botón «Copiar» por paciente (copia solo el resumen) y «Copiar todos» (antepone el nombre).
- El copiado usa `execCommand` síncrono (compatible con iPad/Safari) con la API moderna de
  respaldo.

### 5. Pacientes (ficha + historial)
- Listado buscable (sin tildes). Ficha con: código pseudoanónimo, TIS, fecha de nacimiento/edad,
  CIAS/médico, resumen de evolución y adherencia, historial de sesiones (timeline con punto de
  estado), y acciones: informe de historial, dar de alta / reabrir, corregir nombre (**fusiona
  historiales** si coincide con otro paciente), borrar paciente.

### 6. Alta e **informe de alta completo**
- Alta rápida: estado al alta y motivo (listas), observaciones con frases rápidas. Alta anulable.
- **Informe de alta completo** (editable · copiar · PDF), con función legal/asistencial. Estructura
  (16 apartados): identificación del informe (tipo alta/continuidad, fechas de valoración y alta,
  ámbito, motivo), del paciente (nombre, nacimiento/edad, sexo, TIS, centro de referencia, médico
  derivador), del profesional y centro (fisioterapeuta, nº colegiado, unidad, centro); motivo de
  derivación, diagnóstico médico, valoración fisioterápica inicial, juicio funcional, objetivos,
  intervención realizada, evolución clínica y funcional, situación funcional al alta,
  recomendaciones y programa domiciliario, plan de continuidad/derivación, información facilitada
  al paciente e incidencias; firma e identificación profesional.
  - **Se precarga automáticamente** con lo registrado (nº de sesiones y periodo, técnicas =
    ejercicios + medios físicos, adherencia, evolución global, recomendaciones + último plan) y es
    **totalmente editable** antes de emitir.
  - **Copiar** (texto para el evolutivo) y **Descargar PDF** (impresión nativa → «Guardar como
    PDF», sin dependencias; funciona en iPad). El informe editado se guarda en `p.alta.informe`.
- Los **datos del profesional/centro** (fisioterapeuta, nº colegiado, unidad, centro, ámbito) se
  configuran una vez en *Datos*, se guardan en `cdFisio.config.v1` y se reutilizan en cada informe.

### 7. Estadísticas (día + histórico)
- **El día**: citas, asistencia (%), no asisten, pendientes, mejorías, altas; barras de evolución
  y pauta del día.
- **Histórico** con filtro de periodo **corto**: **7 días / 2 sem / 4 sem / Todo** (por defecto
  2 semanas; ventana en días desde el día seleccionado).
- Indicadores: sesiones realizadas, **% asistencia** y ausencias, **efectividad clínica**
  (% de sesiones con mejoría), **pauta completa** (parcial/no), pacientes atendidos y en
  tratamiento, altas (media de sesiones/alta), recuento por tipo de cita (V/SES/TEL), edad media.
- Gráficos SVG propios (sin dependencias): **actividad por semana** (realizadas/ausencias),
  **evolución clínica** (mejor/igual/peor), **adherencia**, **estado al alta**,
  **derivaciones por centro**, **derivaciones por médico**, **ejercicios más pautados**. Cada uno
  con leyenda y vista «Ver como tabla».

### 8. Datos (copia y exportación)
- Exportar/importar copia **.json** (importar **fusiona** el directorio de médicos).
- Exportar a **Excel .xlsx** (hojas Pacientes / Sesiones / Ejercicios; con Médico y Centro). Si no
  puede generar xlsx, CSV con BOM y `;`.
- Casilla **Pseudoanonimizar** (nombre → código).
- Borrar fotos antiguas · **Borrar todos los datos** (conserva el directorio de médicos) ·
  **Borrar directorio de médicos** (aparte).

---

## 🛠 PERSONALIZAR — 1. Catálogo de ejercicios

Cada fisio define **su propio catálogo**, agrupado por regiones. Es lo único que cambia el
contenido clínico del selector de ejercicios. En el código vive en la constante `CATALOGO_EJ`:

```js
// Cada grupo: { g: 'Nombre del grupo', items: [ ... ] }
// Cada ítem: 'Nombre del ejercicio'  ó  { t: 'Nombre', n: 'nota por defecto en Carga/notas' }
const CATALOGO_EJ = [
  { g: '<REGIÓN 1>', items: [
    '<Ejercicio A>',
    { t: '<Ejercicio B>', n: '<matiz que se copia a la columna Carga/notas>' },
    // …
  ]},
  { g: '<REGIÓN 2>', items: [ /* … */ ]},
  // … tantas regiones como se quiera
];
```

Reglas de personalización:
- **Dosis por defecto** al añadir cualquier ejercicio: **3 series × 10 repeticiones, descanso 60 s**
  (ajustables luego con − / +). Si algún ejercicio necesita otra dosis habitual, puede indicarse
  en la nota `n` o ajustarse en la sesión.
- El grupo ofrece **«Añadir todos (n)»** para pautar un bloque de movilidad completo de un toque.
- Se mantienen siempre: la sección **«Usados con frecuencia»** (aprendida del propio registro) y el
  botón **«Otro (escribir a mano)»** para cualquier ejercicio fuera del catálogo.
- **Este bloque no debe fijarse en la spec como definitivo**: es el punto de adaptación por fisio.

> Ejemplo de referencia (una consulta real) — sustituir por el catálogo de cada fisio:
> Cervical (flexo-extensión, rotaciones, inclinaciones, elevación/giro de hombros, manos al pecho,
> flexión craneocervical) · Hombro/MMSS (rotación externa con goma, «la cruz» a 1 y 2 pies, ULNT1) ·
> Lumbar movilidad (puente, báscula pélvica, rodilla/dos rodillas al pecho, SLR, abdominal
> superior/doble, oblicuos) · Lumbar/MMII (sentadilla alta, monster walk, excéntricos en escalera,
> excéntricos de tibial posterior en 4 pasos).

## 🛠 PERSONALIZAR — 2. Centros de salud (asignados a los médicos)

El **directorio de médicos** relaciona cada **CIAS** con un **nombre de médico** y un **centro de
salud** derivador. La **lista de centros** es lo que cambia por zona/instancia. En el código vive
en la constante `CENTROS`:

```js
// Centros de salud derivadores de esta consulta (personalizable por instancia)
const CENTROS = ['<Centro 1>', '<Centro 2>' /*, … */];
```

Reglas de personalización:
- Cada fisio pone **los centros de su zona** (uno o varios). El editor «Médicos derivadores (CIAS)»
  de la pestaña *Datos* usa esta lista en el desplegable de centro.
- El **CIAS** se detecta del OCR (empieza por `160`) o se introduce a mano en la ficha; el fisio va
  poniendo **nombre y centro** a cada CIAS «poco a poco». El directorio **persiste** aunque se
  borren los datos, para no re-identificarlos.
- Las estadísticas agrupan **derivaciones por centro** y **por médico** con esta asignación.

> Ejemplo de referencia (una consulta real) — sustituir por los centros de cada fisio:
> `['Entrevías', 'El Pozo']`.

---

## Deployment (replicar una instancia)

1. Copiar `consulta-diaria.html` (y `index.html`, `README.md`) a un repositorio propio.
2. Personalizar en el fichero los dos bloques 🛠: `CATALOGO_EJ` y `CENTROS`.
3. Publicar con **GitHub Pages** (Settings → Pages → Deploy from a branch → `main` / root). Queda
   en `https://<usuario>.github.io/<repo>/consulta-diaria.html`.
4. En el iPad/móvil, abrir esa URL y «Añadir a pantalla de inicio».
5. Cada dispositivo tiene sus propios datos (localStorage); no se comparten entre fisios.

## Out of scope (no forma parte de esta app)

- Sincronización entre dispositivos o entre fisios, backend, cuentas de usuario.
- Integración directa con el sistema de historia clínica (el flujo es copiar/pegar).
- Datos identificativos más allá de nombre + 4 dígitos del TIS + CIAS + fecha de nacimiento.
