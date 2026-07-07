# Cuadro de Mando · Fisioterapia AP — DASE Sureste

Cuadro de mando (dashboard) en **un único fichero HTML autocontenido** para el proyecto técnico
de Fisioterapia de Atención Primaria de la DASE Sureste. Lee una plantilla estándar (Excel/CSV),
recalcula los indicadores, los muestra con semáforo frente a meta y representa su evolución.

Spec: [`../specs/cuadro-mando-fisio-dase.md`](../specs/cuadro-mando-fisio-dase.md)

## Qué se entrega

- **`cuadro-mando-fisio-dase.html`** — el cuadro de mando. Un solo fichero, sin dependencias externas
  (lleva SheetJS y todo el código embebidos). Funciona **sin internet**.
- **`consulta-diaria.html`** — app de **consulta diaria** (pacientes del día). Ver
  [su sección](#consulta-diaria-día-a-día-de-la-consulta) más abajo.
- **`index.html`** — portada con acceso a las dos aplicaciones (cómodo al servir la carpeta).
- **`plantillas/`** — plantilla estándar para introducir los datos:
  - `Plantilla_Cuadro_Mando_Fisio_DASE.xlsx` (hojas `Unidades`, `CMI` y `LÉEME`).
  - `Plantilla_Unidades.csv` y `Plantilla_CMI.csv` (alternativa en CSV).

## Cómo usarlo

1. **Verlo:** abre `cuadro-mando-fisio-dase.html` (doble clic) o súbelo a cualquier servidor estático.
   Ya viene con los datos reales **Dic-2025** precargados.
2. **Actualizar datos (plantilla):** edita la plantilla, añade un periodo nuevo cambiando la columna
   `Periodo` (p. ej. `Mar-2026`), guárdala y cárgala con **«Cargar datos»** o arrastrándola.
3. **Cargar un PDF de actividad:** arrastra el informe **«Unidades de Atención Específica»** en
   `.pdf` (el que sale del sistema, por centro). El dashboard lo lee en el navegador, detecta el
   periodo (`AÑO` + `ACUMULADO mes`) y añade por unidad: **pendientes de valoración inicial**,
   **sesiones individuales** y **consultas de VI realizadas**.
4. El histórico vive en los datos cargados (una fila por unidad/indicador y periodo); al haber
   varios periodos aparecen las **tendencias** y el **selector de periodo**.

> Formatos admitidos: **.xlsx**, **.csv** (plantilla de indicadores) y **.pdf** (informe de
> actividad por centro). El PDF y la plantilla son complementarios: el PDF aporta los volúmenes de
> actividad; la plantilla, los indicadores calculados (demoras, %, cartera).

> Todo el procesamiento ocurre en el navegador. No se envía ningún dato a ningún servidor.
> El cuadro de mando sólo maneja indicadores agregados; nunca datos de pacientes.

## OKR por unidad (prioridades)

La pestaña **«OKR por unidad»** establece prioridades de mejora para cada centro:

- **Prioridades automáticas**: por cada unidad, el cuadro calcula la brecha de cada indicador a
  su meta (o a la media DASE) y destaca las 2-3 mayores (críticos primero) como prioridades.
- **Resultados clave por área** (Accesibilidad, Efectividad, Cartera, Actividad) con % de cumplimiento.
- **OKR a medida** (opcional, *híbrido*): si cargas una hoja/CSV **OKR_Unidades** con
  `Periodo, Unidad/Codigo, Objetivo, KR, Valor, Meta, Direccion, Prioridad`, esos OKR definidos
  a mano se muestran junto a las prioridades automáticas. Plantilla en `plantillas/`.
- **Matriz comparativa** unidades × áreas (cumplimiento medio + nº de prioridades) para ver de un
  vistazo dónde actuar; pulsa una unidad para ver su detalle.

## Formas de presentar los datos (plantillas de presentación)

Además del color (temas), puedes cambiar **cómo** se muestran los datos:

- **Diseño CMI** (selector en la cabecera): los indicadores estratégicos como
  **Tarjetas** (con mini-gráfico y tendencia), **Barras con meta** (bullet, se ve cuánto falta
  para el objetivo) o **Medidores** (gauge radial frente a meta).
- **Por unidad** (botones dentro de esa pestaña): **Tabla** ordenable o **Mapa de calor**
  (matriz 19 unidades × indicadores, coloreada por estado).
- **Ejecutivo** (pestaña): vista de **una página** pensada para imprimir/PDF — semáforo global,
  críticos, CMI en barras y mapa de calor de unidades, todo junto.

## Cambiar la estética (temas)

En la cabecera hay un selector **«Tema»** con varias plantillas estéticas que se aplican al
instante (incluidos los gráficos) y se recuerdan en el navegador:

- **SaludMadrid (oficial, por defecto)** · **Verde salud** · **Corporativo sobrio** ·
  **Burdeos institucional** · **Oscuro** · **Alto contraste** (accesibilidad).

> El tema **SaludMadrid (oficial)** usa los colores del Manual de Identidad SaludMadrid (pág. 10):
> azul Pantone 299 **#00A3E0** (con azul oscuro derivado **#0079A8** para contraste de texto) y
> rojo Pantone 032 **#FF3333**. Los colores de semáforo (verde/ámbar/rojo) se mantienen por su
> significado de estado.

Cada tema es sólo un conjunto de **variables CSS**. Para crear uno nuevo:

1. En `build/styles.css`, copia un bloque `body[data-tema="..."]{ ... }`, ponle un nombre nuevo
   y cambia los colores (`--azul`, `--acento`, `--header-grad`, y para modos oscuros también
   `--superficie`, `--texto`, `--gris-bg`…).
2. En `build/index.src.html`, añade su `<option value="tu-tema">Tu tema</option>` al `<select id="temaSel">`.
3. Reconstruye con `cd build && python3 assemble.py`.

> Si sólo quieres retocar los colores del tema actual, edita las variables del bloque `:root`
> en `build/styles.css` y reconstruye.

## Consulta diaria (día a día de la consulta)

**`consulta-diaria.html`** es una segunda app, independiente del cuadro de mando, para el trabajo
diario con pacientes en la consulta:

1. **Hoja del día con foto** — haz una foto a la hoja impresa de pacientes. Puedes leer los
   nombres automáticamente (**OCR** con Tesseract.js, necesita internet la primera vez) revisando
   y corrigiendo lo detectado, o añadirlos a mano mirando la foto (que queda guardada y ampliable).
   El OCR se queda **solo con el nombre y apellidos** (descarta cifras y siglas administrativas),
   coge la hora si aparece, y el prefijo **V / SES / TEL** de la hoja se convierte en la etiqueta
   de **tipo de cita** (valoración / sesión / telefónica), visible en la agenda, editable, e
   incluida en informes y en el Excel. También extrae, revisables antes de añadir: los **4 últimos
   dígitos del TIS**, el **CIAS del médico derivador** (para estadísticas de derivación) y la
   **fecha de nacimiento**, de la que calcula la **edad** que se muestra junto al nombre.
   Botón **«Resetear captura»** para vaciar las citas del día y empezar de cero (y el OCR nunca
   duplica a un paciente que ya esté en el día).
2. **Asistencia con hora** — marca «Viene / No viene»; al marcar «Viene» se registra la **hora de
   llegada** automáticamente (editable). La agenda va **ordenada por hora** (con opción de orden
   alfabético), tiene **buscador por nombre**, y una vista **«Pendientes»** que oculta a los ya
   marcados para ver solo lo que queda. El **nombre se corrige con el lápiz (✏️)** — errores del
   OCR — y si el nombre corregido ya existía, se **fusionan los historiales**.
3. **Registro de la sesión** — evolución (**mejor / igual / peor**), cumplimiento de la **pauta de
   tratamiento** (sí / parcial / no) y **ejercicios pautados**: tantos como quieras, cada uno con
   tipo, series, repeticiones, descanso y carga/notas. Botón para **repetir los ejercicios de la
   sesión anterior**. Pensado para usar **sin teclado** (tablet): los ejercicios se eligen de un
   **catálogo tocable** (con los usados con frecuencia primero, aprendidos de tu propio registro),
   las series/repeticiones se ajustan con **− / +**, el descanso es un desplegable y las
   observaciones tienen **frases rápidas** de un toque (también en el alta).
4. **Informe del día** — un **resumen clínico narrado** por paciente (asistencia, evolución,
   ajuste de tratamiento y peculiaridades), en tono profesional, listo para **copiar y pegar** en
   el evolutivo de la historia clínica. El nombre, fecha, hora y tipo de cita quedan **fuera del
   texto que se copia** (como cabecera de referencia). Las **1ª sesiones no generan informe de
   seguimiento** y no aparecen en el listado.
5. **Historial por paciente** — todas sus sesiones, con marca de **1ª sesión** (se marca a mano
   cuando corresponde) y resumen de evolución y adherencia.
6. **Alta con informe** — al dar el alta eliges **estado** y **motivo**; se genera un **informe de
   alta** con el periodo de tratamiento, sesiones realizadas y no asistencias, evolución global,
   adherencia y último plan de ejercicio, también para copiar y pegar. El alta se puede anular.
7. **Estadísticas** — pestaña visual con **el día** (citas, asistencia, mejorías, altas, evolución
   y pauta de hoy) y **el histórico** con filtro de periodo (4/12 semanas, 6 meses, todo):
   efectividad clínica (% de sesiones con mejoría), asistencia y ausencias por semana, adherencia
   a la pauta, altas (estado y media de sesiones) y ejercicios más pautados. Gráficos SVG propios
   (sin dependencias), con leyenda y vista de tabla en cada uno.
8. **Código pseudoanónimo** — cada paciente tiene un código con las **iniciales del nombre y
   apellidos + los 4 últimos dígitos del TIS** (p. ej. `MGL-1234`). El TIS se introduce al
   añadir el paciente, desde el OCR o en su ficha (si pegas el TIS completo, solo se guardan los
   4 últimos dígitos; los datos antiguos guardados como CIPA migran solos). El código se ve en el
   listado y en la ficha de cada paciente.
9. **Copia de seguridad y exportación** — exportar/importar los datos en JSON y **exportar a
   Excel (.xlsx)** con tres hojas: *Pacientes* (situación, sesiones, alta), *Sesiones*
   (asistencia, horas, evolución, pauta) y *Ejercicios* (tipo, series, repeticiones, descanso).
   Con la casilla **«Pseudoanonimizar»** (marcada por defecto) las copias y el Excel salen con el
   código en lugar del nombre. Si el navegador no puede generar `.xlsx`, exporta un `.csv`
   equivalente que también abre Excel. Botón aparte para limpiar fotos antiguas.

> **Privacidad:** a diferencia del cuadro de mando, esta app sí maneja datos de pacientes.
> **Todo se guarda únicamente en el navegador del dispositivo** (localStorage); no se envía nada a
> ningún servidor. Úsala en un dispositivo propio y bloqueado, exporta copias con regularidad y
> ten en cuenta que borrar los datos de navegación borra también los de la app.

### Publicar en GitHub Pages (acceso desde el navegador)

1. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root** y guarda.
2. En unos minutos la web queda en `https://<usuario>.github.io/cuadro-mando-fisio-dase/`
   (la portada enlaza a las dos apps; la consulta diaria está en `…/consulta-diaria.html`).
3. Aunque la página se sirva desde GitHub Pages, los datos de pacientes siguen viviendo solo en el
   navegador que la abre: cada dispositivo tiene sus propios datos.

## Desplegar en un servidor sencillo

Copia el contenido de esta carpeta (al menos el `.html`, `index.html` y `plantillas/`) a la raíz
web. Ejemplos:

```bash
# Servidor local de prueba
python3 -m http.server 8000        # luego abre http://localhost:8000/

# Apache/nginx/IIS: copia los ficheros al directorio público.
# GitHub Pages: sube la carpeta y activa Pages.
```

## Reconstruir (sólo para desarrollo)

El HTML se ensambla desde piezas en `build/`:

```bash
cd build
python3 assemble.py     # genera ../cuadro-mando-fisio-dase.html y las plantillas
node review.js          # ejecuta la batería de verificación contra el spec (jsdom)
```

- `build/data_source.py` — datos reales (fuente única) y generación de plantillas/JSON.
- `build/styles.css`, `build/app.js`, `build/index.src.html` — estilos, lógica y plantilla HTML.
- `build/review.js` — comprobaciones automáticas (jsdom): requisitos, casos límite, temas,
  plantillas de presentación, medidores y lectura de PDF.
- `vendor/` — librerías embebidas: SheetJS (Excel) y pdf.js + worker (PDF), todo offline.

## Regla del semáforo

- **Verde:** cumple la meta. **Ámbar:** cerca de la meta. **Rojo:** lejos / en el punto de partida.
- Respeta la dirección de cada indicador (`menor_mejor` p. ej. demoras; `mayor_mejor` p. ej. % al alta).
- Indicadores cualitativos (sin meta numérica) usan el estado manual de la plantilla (`EstadoManual`).

Umbrales configurables en `build/app.js` (`TOL_MAYOR`, `TOL_MENOR`). Ver Asunción A1 del spec.
