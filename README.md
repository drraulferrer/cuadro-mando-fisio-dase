# Cuadro de Mando · Fisioterapia AP — DASE Sureste

Cuadro de mando (dashboard) en **un único fichero HTML autocontenido** para el proyecto técnico
de Fisioterapia de Atención Primaria de la DASE Sureste. Lee una plantilla estándar (Excel/CSV),
recalcula los indicadores, los muestra con semáforo frente a meta y representa su evolución.

Spec: [`../specs/cuadro-mando-fisio-dase.md`](../specs/cuadro-mando-fisio-dase.md)

## Qué se entrega

- **`cuadro-mando-fisio-dase.html`** — el cuadro de mando. Un solo fichero, sin dependencias externas
  (lleva SheetJS y todo el código embebidos). Funciona **sin internet**.
- **`index.html`** — redirección al cuadro de mando (cómodo al servir la carpeta).
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
