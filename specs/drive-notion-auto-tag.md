# Spec · Auto-etiquetado Inbox Drive → Notion

> Especificación **replicable** del sistema que registra y clasifica automáticamente en Notion
> los archivos que se suben a una carpeta `Inbox` de Google Drive.
> No es código dentro del repositorio: es una **rutina programada** (scheduled trigger) que se
> ejecuta en la nube usando los conectores de Google Drive y Notion. Este documento deja
> constancia de cómo está montada para poder **revisarla, pausarla, modificarla o recrearla**.

## Register

product

## Propósito

Que la biblioteca documental de Notion («Biblioteca Drive · Raúl (clasificada)») se mantenga
**sola**: basta con arrastrar un archivo a la carpeta `Inbox` de Drive y, sin pedirlo, aparece
fichado y etiquetado en Notion. Pensado para uso como **repositorio**, donde una latencia de
hasta 24 h es perfectamente aceptable.

## Piezas del sistema

| Pieza | Identificador | Notas |
|---|---|---|
| Carpeta Drive `Inbox` | `13iLBEvIUD3Asr6v3S61Ut_gEozOMx-5q` | Bandeja de entrada. Se sueltan aquí los archivos. |
| Base Notion | «Biblioteca Drive · Raúl (clasificada)» · `e8bdffa0-7e5e-41c0-9a50-93d4095f0b7f` | Base de destino. |
| Data source Notion | `collection://019eeb0e-c36f-4da1-89c6-2dfb2b18dafe` | Se usa como tabla en las consultas SQL. |
| Rutina programada | `trig_01N5n2PRqTq6jxNUiGwzrbQT` | `cron: 23 4 * * *` (04:23 UTC diario). Sesión nueva por ejecución. Aviso push si hay novedades. |

## Esquema de la base (propiedades)

| Propiedad | Tipo | Cómo se rellena |
|---|---|---|
| `Nombre` | title | Nombre del archivo. |
| `Enlace` | url | URL de vista del archivo en Drive (`viewUrl`/`webViewLink`). |
| `Tema` | select | Una de las 9 categorías (ver abajo), elegida por criterio a partir del nombre (y del contenido si el nombre es ambiguo). |
| `Tipo` | select | Extensión del archivo mapeada a la lista cerrada de tipos. |

### Opciones de `Tema`
`Dolor y fisioterapia clinica` · `Proyecto GAP-421 / EPS` · `Gestion y estrategia sanitaria` ·
`Docencia y formacion` · `Investigacion y metodologia` · `Emprendimiento y marca` ·
`IA y herramientas` · `Administrativo y personal` · `Otros`

### Opciones de `Tipo`
`pdf` · `docx` · `doc` · `pptx` · `xlsx` · `xls` · `zip` · `mp3` · `png` · `otros`
(Cualquier extensión no listada —jpg, txt, csv…— cae en `otros`.)

## Lógica de cada ejecución

1. **Listar** los archivos con padre = carpeta `Inbox` (ignorando subcarpetas).
2. **Deduplicar**: leer los `Enlace` ya registrados en Notion; para cada archivo, extraer su
   **ID de Drive** (`/d/ID/`) y saltarlo si ese ID ya aparece en algún enlace existente.
   La comparación es **por ID**, no por la URL completa, porque el sufijo `?usp=…` varía.
3. **Clasificar** cada archivo nuevo: `Tipo` por extensión; `Tema` por criterio semántico.
4. **Crear** una página en Notion (una por archivo) con las cuatro propiedades.
5. **Cerrar**: si hubo altas, resumen + aviso push; si no, termina en silencio.

> **Nota de diseño — por qué no se mueven los archivos:** el conector de Google Drive disponible
> permite leer, buscar y crear, pero **no mover ni borrar**. Por eso los archivos permanecen en el
> `Inbox` y la no-duplicación se garantiza comprobando el ID contra Notion, no vaciando la carpeta.

## Operación

- **Ver / pausar / borrar la rutina**: gestionable desde los *triggers* de la cuenta
  (`trig_01N5n2PRqTq6jxNUiGwzrbQT`). Pausarla la deja guardada sin ejecutarse.
- **Cambiar la frecuencia**: editar el `cron`. Ej.: cada 12 h → `23 4,16 * * *`; cada 48 h no es
  expresable en cron simple (se deja diario, que cumple el requisito de 24–48 h).
- **Forzar una pasada ahora**: disparar la rutina manualmente (fire) tras soltar un archivo de
  prueba en el `Inbox`.

## Limitación conocida

La rutina se ejecuta en una **sesión desatendida**; depende de que los conectores de Google Drive
y Notion sigan **autorizados** en esas sesiones. Si en algún momento dejan de estarlo, la pasada
fallará silenciosamente. Validación recomendada tras crearla: soltar un archivo real en el `Inbox`,
forzar una pasada y confirmar que aparece en Notion.

## Alternativas (si algún día se quiere tiempo real e independencia total de Claude)

- **Google Apps Script** enganchado al Drive con disparador temporal (cada X min), llamando a la
  API de Notion con un token de integración. Corre 24/7 en Google. El `Tema` se decide por palabras
  clave o llamando a una IA.
- **No-code (Make.com / Zapier / n8n)**: *watch folder* de Drive → *create item* en Notion, con un
  módulo de IA opcional para el `Tema`.
