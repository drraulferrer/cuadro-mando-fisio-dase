/* Review automatizado del cuadro de mando contra el spec.
   Ejecuta el HTML autocontenido en jsdom y verifica requisitos y casos límite. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.dirname(__dirname);
const HTML = fs.readFileSync(path.join(ROOT, "cuadro-mando-fisio-dase.html"), "utf8");

let pass = 0, fail = 0;
const fails = [];
function chk(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); } }

function nuevaDOM() {
  return new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true });
}

// espera a que la app renderice (init corre en DOMContentLoaded)
function listo(dom) {
  return new Promise(res => {
    const d = dom.window.document;
    if (d.querySelector("#cmiBox .ind")) return res();
    dom.window.addEventListener("DOMContentLoaded", () => setTimeout(res, 0));
    setTimeout(res, 500);
  });
}

// helper: cargar un fichero CSV simulando el flujo real (manejarFichero via input change)
function cargarCSV(dom, texto, nombre) {
  const w = dom.window;
  const file = new w.File([texto], nombre, { type: "text/csv" });
  const input = w.document.getElementById("fileInput");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new w.Event("change"));
  // FileReader es asíncrono: espera a que el aviso se actualice
  return new Promise(res => {
    const aviso = w.document.getElementById("avisoCarga");
    let n = 0;
    const t = setInterval(() => {
      if (aviso.textContent.trim() !== "" || ++n > 40) { clearInterval(t); res(); }
    }, 10);
  });
}

async function run() {
  const dom = nuevaDOM();
  await listo(dom);
  const w = dom.window, d = w.document;

  // R1: SheetJS embebido y disponible
  chk(typeof w.XLSX !== "undefined", "R1: XLSX (SheetJS) no está embebido/disponible");

  // R10/R4: datos precargados -> CMI con 12 indicadores
  const indCards = d.querySelectorAll("#cmiBox .ind");
  chk(indCards.length === 12, "R4/R10: se esperaban 12 tarjetas CMI, hay " + indCards.length);

  // R5: tabla operativa con 19 unidades + fila media
  const filas = d.querySelectorAll("#uniTabla tbody tr");
  chk(filas.length === 20, "R5: se esperaban 19 unidades + media (20 filas), hay " + filas.length);
  const cabeceras = d.querySelectorAll("#uniTabla thead th").length;
  chk(cabeceras === 11, "R5: se esperaban 11 columnas (Unidad + 7 + 3 actividad), hay " + cabeceras);
  chk(/Pendientes VI/.test(d.querySelector("#uniTabla thead").textContent), "Actividad PDF: falta la columna 'Pendientes VI'");

  // R6: semáforo respeta dirección. Buscar tarjetas por código.
  function estadoDe(cod) {
    const card = Array.from(d.querySelectorAll("#cmiBox .ind"))
      .find(e => e.querySelector(".cod") && e.querySelector(".cod").textContent.indexOf(cod) === 0);
    if (!card) return null;
    return ["verde", "ambar", "rojo", "neutro"].find(c => card.classList.contains(c));
  }
  chk(estadoDe("P1-01") === "ambar", "R6: P1-01 (demora 43,63 vs ≤35, menor_mejor) debería ser ámbar, es " + estadoDe("P1-01"));
  chk(estadoDe("P1-02") === "ambar", "R6: P1-02 (8,05 vs ≤7) debería ser ámbar, es " + estadoDe("P1-02"));
  chk(estadoDe("P2-02") === "verde", "R6: P2-02 (94 vs ≥90, mayor_mejor) debería ser verde, es " + estadoDe("P2-02"));
  chk(estadoDe("P2-01") === "ambar", "R6: P2-01 (79,16 vs ≥80) debería ser ámbar, es " + estadoDe("P2-01"));
  chk(estadoDe("P1-04") === "rojo", "R6: P1-04 (0 vs ≥50) debería ser rojo, es " + estadoDe("P1-04"));
  chk(estadoDe("P3-02") === "rojo", "R6: P3-02 (0 vs ≥80) debería ser rojo, es " + estadoDe("P3-02"));
  chk(estadoDe("P2-04") === "verde", "R6: P2-04 (cualitativo EstadoManual=verde) debería ser verde, es " + estadoDe("P2-04"));
  chk(estadoDe("P3-01") === "rojo", "R6: P3-01 (cualitativo EstadoManual=rojo) debería ser rojo, es " + estadoDe("P3-01"));

  // Rediseño tarjetas: pill de estado legible + barra de progreso a meta
  chk(d.querySelectorAll("#cmiBox .ind .pill").length === 12, "Tarjetas: cada tarjeta debe tener un pill de estado, hay " + d.querySelectorAll("#cmiBox .ind .pill").length);
  chk(/En meta|En riesgo|Crítico/.test(d.querySelector("#cmiBox .ind .pill").textContent), "Tarjetas: el pill debe mostrar etiqueta legible (En meta/En riesgo/Crítico)");
  chk(d.querySelectorAll("#cmiBox .ind .prog .prog-meta").length >= 8, "Tarjetas: faltan barras de progreso con marca de meta");
  chk(!/>verde<|>ambar<|>rojo</.test(d.getElementById("cmiBox").innerHTML), "Tarjetas: no deben mostrar la palabra cruda del estado (verde/ambar/rojo)");

  // Cabecera rediseñada: marca + chip de estado global
  chk(!!d.querySelector("header .brand-accent"), "Cabecera: falta la franja de marca");
  chk(/Servicio Madrileño de Salud/i.test(d.querySelector("header .eyebrow").textContent || ""), "Cabecera: falta el eyebrow institucional");
  chk(d.querySelectorAll("#estadoGlobal .eg-chip").length === 3, "Cabecera: el chip de estado global debe tener 3 contadores, hay " + d.querySelectorAll("#estadoGlobal .eg-chip").length);

  // Botón único de configuración: agrupa todas las opciones, cabecera limpia
  chk(!d.querySelector("header .toolbar"), "Config: ya no debe existir la barra de herramientas suelta");
  chk(!!d.getElementById("btnConfig") && !!d.getElementById("configPanel"), "Config: faltan el botón o el panel de configuración");
  chk(d.getElementById("configPanel").hidden === true, "Config: el panel debe empezar oculto");
  ["periodoSel", "disenoSel", "temaSel", "btnCargar", "btnImprimir", "fileInput"].forEach(function (id) {
    chk(d.getElementById("configPanel").contains(d.getElementById(id)), "Config: el control #" + id + " debe estar dentro del panel");
  });
  d.getElementById("btnConfig").dispatchEvent(new w.Event("click", { bubbles: true }));
  chk(d.getElementById("configPanel").hidden === false, "Config: al pulsar el botón el panel debe abrirse");
  d.body.dispatchEvent(new w.Event("click", { bubbles: true }));
  chk(d.getElementById("configPanel").hidden === true, "Config: al pulsar fuera el panel debe cerrarse");

  // R9: resumen con conteos. Verde count >=1, rojo count >=1
  const cards = d.querySelectorAll("#resumenCards .card");
  chk(cards.length >= 4, "R9: faltan tarjetas de resumen");
  const criticos = d.getElementById("criticosBox").textContent;
  chk(/cr[ií]tic/i.test(criticos) && /P1-04|P3-02|P4-01/.test(criticos), "R9: caja de críticos no lista los rojos esperados");

  // R11: formato español (coma decimal) en alguna celda
  const algunaCelda = d.querySelector("#uniTabla tbody td.cell");
  chk(algunaCelda && /\d,\d/.test(d.querySelector("#uniTabla tbody").textContent), "R11: no se ve formato con coma decimal");

  // E5: un solo periodo -> tendencias informa que no hay comparación
  chk(/no hay periodo anterior/i.test(d.getElementById("tendBox").textContent), "E5: con 1 periodo, Tendencias debe avisar de falta de comparación");

  // media DASE cartera (P2-03) calculada correctamente
  const cartera = [72.90,97.30,50.60,78.40,59.20,61.80,50.50,98.50,82.40,84.40,82.70,77.30,75.40,55.40,75.40,48.10,71.60,58.60,52.80];
  const mediaCartera = cartera.reduce((a,b)=>a+b,0)/cartera.length;
  const cardP203 = Array.from(d.querySelectorAll("#cmiBox .ind"))
    .find(e => e.querySelector(".cod").textContent.indexOf("P2-03")===0);
  const valTxt = cardP203.querySelector(".val").textContent.replace(/\./g,"").replace(",",".");
  chk(Math.abs(parseFloat(valTxt) - mediaCartera) < 0.05, "P2-03: media cartera esperada " + mediaCartera.toFixed(2) + ", mostrada " + valTxt);

  // ---- plantillas de presentación ----
  function setSel(id, val) { const s = d.getElementById(id); s.value = val; s.dispatchEvent(new w.Event("change")); }
  setSel("disenoSel", "okr");
  chk(d.querySelectorAll("#cmiBox .okr-obj").length === 4, "Vista OKR: se esperaban 4 objetivos, hay " + d.querySelectorAll("#cmiBox .okr-obj").length);
  chk(d.querySelectorAll("#cmiBox .okr-kr").length === 12, "Vista OKR: se esperaban 12 resultados clave, hay " + d.querySelectorAll("#cmiBox .okr-kr").length);
  chk(d.querySelectorAll("#cmiBox .okr-obj .okr-ring").length >= 3, "Vista OKR: faltan anillos de progreso por objetivo");
  chk(/%/.test((d.querySelector("#cmiBox .kr-pct") || {}).textContent || ""), "Vista OKR: los KR deben mostrar % de cumplimiento");
  // cumplimiento P2-02 (94 vs >=90) debe ser 100%
  (function(){
    var kr = Array.from(d.querySelectorAll("#cmiBox .okr-kr")).find(k => k.querySelector(".kr-cod").textContent === "P2-02");
    chk(kr && /100\s*%/.test(kr.querySelector(".kr-pct").textContent), "Vista OKR: P2-02 (94 vs ≥90) debería ser 100% de cumplimiento");
  })();
  setSel("disenoSel", "tarjetas");

  setSel("disenoSel", "barras");
  chk(d.querySelectorAll("#cmiBox .barra").length === 12, "Presentación barras: se esperaban 12 barras, hay " + d.querySelectorAll("#cmiBox .barra").length);
  chk(d.querySelectorAll("#cmiBox .barra .bmeta").length >= 8, "Presentación barras: faltan marcadores de meta");
  setSel("disenoSel", "medidores");
  chk(d.querySelectorAll("#cmiBox .gauge").length === 12, "Presentación medidores: se esperaban 12 gauges, hay " + d.querySelectorAll("#cmiBox .gauge").length);
  chk(d.querySelectorAll("#cmiBox .gauge svg .g-val").length >= 6, "Presentación medidores: faltan arcos de valor (indicadores con valor 0 no dibujan arco)");
  // gauge bien hecho: el arco de valor comparte EXACTAMENTE el trazado del arco base (overlap)
  const g1 = d.querySelector("#cmiBox .gauge svg");
  const dBg = g1.querySelector(".g-bg").getAttribute("d");
  const dVal = g1.querySelector(".g-val") ? g1.querySelector(".g-val").getAttribute("d") : dBg;
  chk(dBg === dVal, "Medidores: el arco de valor debe usar el MISMO trazado que el arco base (overlap)");
  chk(g1.querySelector(".g-val") ? g1.querySelector(".g-val").getAttribute("stroke-dasharray") !== null : true, "Medidores: el arco de valor debe revelarse con stroke-dasharray");
  setSel("disenoSel", "tarjetas");
  chk(d.querySelectorAll("#cmiBox .ind").length === 12, "Presentación tarjetas: debería volver a 12 tarjetas");

  // mapa de calor por unidad
  const btnHeat = Array.from(d.querySelectorAll("[data-vista]")).find(b => b.getAttribute("data-vista") === "heatmap");
  btnHeat.dispatchEvent(new w.Event("click"));
  chk(d.querySelector("#uniTabla").classList.contains("heat"), "Mapa de calor: la tabla no cambió a clase heat");
  chk(d.querySelectorAll("#uniTabla.heat tbody tr").length === 19, "Mapa de calor: se esperaban 19 filas, hay " + d.querySelectorAll("#uniTabla.heat tbody tr").length);
  const btnTabla = Array.from(d.querySelectorAll("[data-vista]")).find(b => b.getAttribute("data-vista") === "tabla");
  btnTabla.dispatchEvent(new w.Event("click"));
  chk(d.querySelector("#uniTabla").classList.contains("uni"), "Volver a tabla: la clase no volvió a uni");

  // vista ejecutiva (1 página)
  chk(d.querySelectorAll("#ejecBox .ejec-sem .pill").length === 3, "Ejecutivo: faltan las 3 píldoras de semáforo");
  chk(d.querySelectorAll("#ejecBox .barra").length === 12, "Ejecutivo: se esperaban 12 barras CMI, hay " + d.querySelectorAll("#ejecBox .barra").length);
  chk(d.querySelectorAll("#ejecBox table.heat tbody tr").length === 19, "Ejecutivo: mini-mapa de calor debería tener 19 unidades");

  // ---- carga CSV 2 periodos -> R7/R8 tendencias ----
  const csv2 = fs.readFileSync(path.join(ROOT, "test", "CMI_2periodos.csv"), "utf8");
  await cargarCSV(dom, csv2, "CMI_2periodos.csv");
  const ok = d.getElementById("avisoCarga").textContent;
  chk(/Cargado/.test(ok) && /Mar-2026/.test(ok), "R7: tras cargar CSV de 2 periodos, no se reconocen los periodos. Aviso: " + ok.slice(0,120));
  // selector de periodo con 2 opciones
  const ops = d.querySelectorAll("#periodoSel option");
  chk(ops.length === 2, "R7: el selector de periodo debería tener 2 periodos, tiene " + ops.length);
  // tendencias ahora con gráficos (svg spark)
  const sparks = d.querySelectorAll("#tendBox svg.spark");
  chk(sparks.length >= 1, "R8: no se generan gráficos de tendencia con 2 periodos");

  // ---- E1/E2: fichero malformado ----
  const dom2 = nuevaDOM();
  await listo(dom2);
  await cargarCSV(dom2, fs.readFileSync(path.join(ROOT,"test","malo.csv"),"utf8"), "malo.csv");
  const a2 = dom2.window.document.getElementById("avisoCarga");
  chk(/error/.test(a2.className) || /no se reconoce|faltan/i.test(a2.textContent), "E1/E2: fichero malformado debería dar error claro");
  // y los datos previos se conservan (sigue habiendo 12 CMI)
  chk(dom2.window.document.querySelectorAll("#cmiBox .ind").length === 12, "E1: tras fichero malo deben conservarse los datos previos");

  // ---- E7: fichero vacío ----
  const dom3 = nuevaDOM();
  await listo(dom3);
  await cargarCSV(dom3, "Periodo;Codigo;Valor\n", "vacio.csv");
  const a3 = dom3.window.document.getElementById("avisoCarga");
  chk(/vac[ií]o|error/i.test(a3.textContent), "E7: fichero sólo-cabeceras debería avisar de vacío");

  // ---- tema SaludMadrid oficial ----
  const optSermas = Array.from(d.querySelectorAll("#temaSel option")).find(o => /SaludMadrid/i.test(o.textContent));
  chk(!!optSermas, "Tema SERMAS: falta la opción 'SaludMadrid (oficial)'");
  chk(/#00a3e0/i.test(HTML) && /#0079a8/i.test(HTML), "Tema SERMAS: faltan los colores oficiales (#00A3E0 / #0079A8) en el CSS");

  // ---- lectura de PDF (parser puro) ----
  chk(typeof w.pdfjsLib !== "undefined", "PDF: pdf.js no está embebido/disponible");
  const textoPDF = [
    "AÑO 2026",
    "ACUMULADO Marzo",
    "DIR.ASIST. SURESTE",
    "CENTRO 16010210 - C.S. PERALES DE TAJUÑA",
    "UNIDAD DE APOYO FISIOTERAPIA",
    "INDICADOR DATO",
    "Actividad Nº de usuarios pendientes de consulta de valoración inicial 110",
    "Actividad Nº de sesiones individuales 1.209",
    "Actividad Nº de consultas de valoración inicial realizadas 183",
    "CENTRO 16010410 - C.S. ARGANDA DEL REY",
    "UNIDAD DE APOYO FISIOTERAPIA",
    "Actividad Nº de usuarios pendientes de consulta de valoración inicial 61",
    "Actividad Nº de sesiones individuales 655",
    "Actividad Nº de consultas de valoración inicial realizadas 176"
  ].join("\n");
  const r = w.__test.parsearActividad(textoPDF);
  chk(r.periodo === "Mar-2026", "PDF: periodo esperado Mar-2026, obtenido " + r.periodo);
  chk(r.filas.length === 2, "PDF: se esperaban 2 centros, obtenidos " + r.filas.length);
  const per = r.filas[0];
  chk(per.Unidad === "Perales de Tajuña", "PDF: el código 16010210 debe mapear a 'Perales de Tajuña', dio " + per.Unidad);
  chk(per.PendientesVI === 110, "PDF: PendientesVI esperado 110, dio " + per.PendientesVI);
  chk(per.SesionesIndiv === 1209, "PDF: SesionesIndiv esperado 1209 (1.209), dio " + per.SesionesIndiv);
  chk(per.ConsultasVI === 183, "PDF: ConsultasVI esperado 183, dio " + per.ConsultasVI);

  console.log("\n=== REVIEW: " + pass + " OK, " + fail + " FALLOS ===");
  if (fail) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
  console.log("Todas las comprobaciones pasaron.");
}

run().catch(e => { console.error("ERROR EN REVIEW:", e.stack); process.exit(2); });
