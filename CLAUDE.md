# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Memory routing

Al inicio de cada sesión, consulta la notebook **"Claude Memory"** en NotebookLM
para recuperar contexto relevante de trabajos anteriores antes de pedirle al
autor que vuelva a explicar nada. Trae solo las respuestas concretas que
necesites, no transcripciones completas.

> Nota de entorno: esta regla solo surte efecto si la sesión dispone de una
> herramienta/conector que llegue a NotebookLM. En sesiones sin ese acceso
> (p. ej. el entorno web remoto, que no tiene conector de NotebookLM), omite
> este paso silenciosamente y continúa: apóyate en el historial de git, los
> PRs y los archivos del repo como memoria de respaldo.

## Sobre el proyecto

Cuadro de mando de Fisioterapia AP — DASE Sureste. Dos apps HTML autocontenidas,
todo se procesa y guarda **solo en el navegador** (localStorage para los datos;
IndexedDB para las fotos, fuera del cupo de 5 MB); los datos de pacientes no
salen del dispositivo.

- `cuadro-mando-fisio-dase.html` — cuadro de mando institucional (CMI, indicadores
  por unidad, lectura de Excel/CSV/PDF). Se ensambla con `build/`.
- `consulta-diaria.html` — app del día a día de consulta (foto/OCR de la hoja,
  asistencia, evolución, ejercicios, informes, alta, estadísticas). Su
  especificación replicable está en `specs/consulta-diaria.md`.
- `index.html` — portada con acceso a ambas apps.

## Convenciones

- Un único HTML autocontenido por app; sin llamadas a internet en tiempo de uso
  (las librerías van en `vendor/` y se cargan bajo demanda).
- Respeta el sistema de temas y los tokens CSS existentes.
- Diseño/UX guiado por la skill `impeccable` (`.claude/skills/impeccable/`).
- Verifica los cambios con la batería jsdom y el detector de impeccable antes de
  dar por bueno el trabajo.
