/* Cuadro de Mando — Fisioterapia AP DASE Sureste
   Lógica de carga, cálculo de semáforos, tendencias y render. Vanilla JS.
   Los datos precargados se inyectan como DATOS_PRECARGADOS. */
(function () {
  "use strict";

  // ---- Configuración del semáforo (ver Asunción A1 del spec) ----
  var TOL_MAYOR = 0.10; // mayor_mejor: ámbar si >= meta*(1-0.10)
  var TOL_MENOR = 0.30; // menor_mejor: ámbar si <= meta*(1+0.30)
  var MESES = { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, oct:10, nov:11, dic:12 };

  var UNI_REQ = ["Periodo", "Unidad"];
  var CMI_REQ = ["Periodo", "Codigo", "Valor"];

  var estado = {
    data: clon(DATOS_PRECARGADOS),
    periodos: [],
    periodoSel: null,
    sortCol: "Unidad",
    sortDir: 1,
    disenoCMI: "okr",        // okr | tarjetas | barras | medidores (por defecto OKR)
    vistaUnidad: "tabla",    // tabla | heatmap
    compA: null, compB: null, // periodos a comparar en la pestaña Comparativa
    unidadOKR: null,          // unidad seleccionada en "OKR por unidad"
  };

  // ---------- utilidades ----------
  function clon(o) { return JSON.parse(JSON.stringify(o)); }

  function numES(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return isNaN(v) ? null : v;
    var s = String(v).trim();
    if (s === "" || s === "—" || s === "-" || s.toLowerCase() === "n/d") return null;
    s = s.replace(/%/g, "").replace(/\s/g, "");
    if (s.indexOf(",") !== -1) {
      s = s.replace(/\./g, "").replace(",", "."); // '.' miles, ',' decimal
    }
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function fmt(v, dec) {
    if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return "—";
    if (typeof v !== "number") return String(v);
    dec = dec === undefined ? 2 : dec;
    var s = v.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return s;
  }

  function periodKey(p) {
    if (!p) return "";
    var s = String(p).trim();
    var m = s.match(/^(\d{4})[-\/](\d{1,2})$/); // AAAA-MM
    if (m) return m[1] + "-" + ("0" + m[2]).slice(-2);
    m = s.match(/^([A-Za-zÁÉÍÓÚáéíóú]{3,})[-\/\s](\d{4})$/); // Mmm-AAAA
    if (m) {
      var mes = MESES[m[1].slice(0, 3).toLowerCase()];
      if (mes) return m[2] + "-" + ("0" + mes).slice(-2);
    }
    return s; // fallback: orden alfabético
  }

  function ordenarPeriodos(ps) {
    return ps.slice().sort(function (a, b) {
      var ka = periodKey(a), kb = periodKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  // ---------- semáforo ----------
  function estadoMeta(valor, metaNum, direccion) {
    if (valor === null || metaNum === null || metaNum === undefined) return "neutro";
    if (direccion === "menor_mejor") {
      if (valor <= metaNum) return "verde";
      if (valor <= metaNum * (1 + TOL_MENOR)) return "ambar";
      return "rojo";
    }
    // mayor_mejor (por defecto)
    if (valor >= metaNum) return "verde";
    if (valor >= metaNum * (1 - TOL_MAYOR)) return "ambar";
    return "rojo";
  }

  function estadoRelativo(valor, media, direccion) {
    if (valor === null || media === null || media === 0) return "neutro";
    var dev = (valor - media) / media;
    var bueno = direccion === "menor_mejor" ? -dev : dev;
    if (bueno >= 0.05) return "verde";
    if (bueno <= -0.15) return "rojo";
    return "ambar";
  }

  function estadoCMI(reg, valor) {
    if (reg.EstadoManual) return String(reg.EstadoManual).toLowerCase();
    var meta = numES(reg.MetaNum);
    if (valor !== null && meta !== null) return estadoMeta(valor, meta, reg.Direccion);
    return "neutro";
  }

  // ---------- acceso a datos por periodo ----------
  function unidadesDe(periodo) {
    return estado.data.unidades.filter(function (u) { return u.Periodo === periodo; });
  }
  function cmiDe(periodo) {
    return estado.data.cmi.filter(function (c) { return c.Periodo === periodo; });
  }
  function periodoAnterior(periodo) {
    var idx = estado.periodos.indexOf(periodo);
    return idx > 0 ? estado.periodos[idx - 1] : null; // periodos en orden ascendente
  }
  function mediaOperativa(periodo, clave) {
    var us = unidadesDe(periodo), vals = [];
    us.forEach(function (u) { var n = numES(u[clave]); if (n !== null) vals.push(n); });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }
  function valorCMI(periodo, codigo) {
    var r = cmiDe(periodo).filter(function (c) { return c.Codigo === codigo; })[0];
    return r ? numES(r.Valor) : null;
  }

  function recomputarPeriodos() {
    var set = {};
    estado.data.unidades.forEach(function (u) { if (u.Periodo) set[u.Periodo] = 1; });
    estado.data.cmi.forEach(function (c) { if (c.Periodo) set[c.Periodo] = 1; });
    estado.periodos = ordenarPeriodos(Object.keys(set));
    if (!estado.periodoSel || estado.periodos.indexOf(estado.periodoSel) === -1) {
      estado.periodoSel = estado.periodos[estado.periodos.length - 1] || null; // más reciente
    }
  }

  // ---------- tendencia ----------
  function tendencia(actual, anterior, direccion) {
    if (actual === null || anterior === null) return { cls: "flat", txt: "—", delta: null };
    var d = actual - anterior;
    if (Math.abs(d) < 1e-9) return { cls: "flat", txt: "=", delta: 0 };
    var sube = d > 0;
    var bueno = direccion === "menor_mejor" ? !sube : sube;
    var flecha = sube ? "▲" : "▼";
    var cls = (sube ? "up-" : "down-") + (bueno ? "good" : "bad");
    return { cls: cls, txt: flecha + " " + fmt(Math.abs(d), 2), delta: d };
  }

  function sparkline(valores, direccion, metaNum) {
    var pts = valores.filter(function (v) { return v !== null; });
    if (pts.length < 2) return "";
    var w = 230, h = 46, pad = 4;
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    if (metaNum !== null && metaNum !== undefined) { min = Math.min(min, metaNum); max = Math.max(max, metaNum); }
    var rng = (max - min) || 1;
    var n = valores.length;
    var x = function (i) { return pad + (i * (w - 2 * pad)) / (n - 1); };
    var y = function (v) { return h - pad - ((v - min) / rng) * (h - 2 * pad); };
    var d = "", first = true, dots = "";
    for (var i = 0; i < n; i++) {
      if (valores[i] === null) continue;
      var px = x(i).toFixed(1), py = y(valores[i]).toFixed(1);
      d += (first ? "M" : "L") + px + " " + py + " ";
      dots += '<circle class="spark-dot" cx="' + px + '" cy="' + py + '" r="2.4"/>';
      first = false;
    }
    var metaLine = "";
    if (metaNum !== null && metaNum !== undefined) {
      var my = y(metaNum).toFixed(1);
      metaLine = '<line class="spark-meta" x1="' + pad + '" y1="' + my + '" x2="' + (w - pad) + '" y2="' + my + '"/>';
    }
    return '<svg class="spark" width="100%" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img">' +
      metaLine + '<path class="spark-line" d="' + d.trim() + '"/>' + dots + "</svg>";
  }

  // ---------- render ----------
  function el(id) { return document.getElementById(id); }

  function render() {
    recomputarPeriodos();
    renderSelectorPeriodo();
    renderResumen();
    renderCMI();
    renderOperativa();
    renderTendencias();
    renderEjecutivo();
    renderOKRUnidad();
    renderEstadoGlobal();
    renderHero();
    renderOverviewObjetivos();
    // La pestaña Comparativa solo aparece con ≥2 periodos cargados
    var tabComp = document.querySelector('.tabs .tab[data-panel="panelTendencias"]');
    if (tabComp) {
      var hayComp = estado.periodos.length >= 2;
      tabComp.style.display = hayComp ? "" : "none";
      if (!hayComp && tabComp.classList.contains("activa")) activarTab("panelResumen");
    }
    el("fuente").textContent = estado.data.fuente || "";
  }

  function activarTab(panelId) {
    document.querySelectorAll(".tabs .tab").forEach(function (x) {
      x.classList.toggle("activa", x.getAttribute("data-panel") === panelId);
    });
    document.querySelectorAll(".panel").forEach(function (x) {
      x.classList.toggle("activa", x.id === panelId);
    });
  }

  function renderEstadoGlobal() {
    var box = el("estadoGlobal");
    if (!box) return;
    var c = { verde: 0, ambar: 0, rojo: 0, neutro: 0 };
    cmiDe(estado.periodoSel).forEach(function (x) { c[estadoCMI(x, numES(x.Valor))]++; });
    box.innerHTML =
      '<span class="eg-chip"><span class="dot" style="background:var(--verde)"></span>' + c.verde + " en meta</span>" +
      '<span class="eg-chip"><span class="dot" style="background:var(--ambar)"></span>' + c.ambar + " en riesgo</span>" +
      '<span class="eg-chip"><span class="dot" style="background:var(--rojo)"></span>' + c.rojo + " críticos</span>";
  }

  // Hero de estado (cabina ejecutiva): donut de % en meta + contadores accesibles
  function renderHero() {
    var box = el("heroEstado");
    if (!box) return;
    var p = estado.periodoSel;
    var lista = cmiDe(p);
    if (!lista.length) { box.style.display = "none"; box.innerHTML = ""; return; }
    box.style.display = "";
    var c = { verde: 0, ambar: 0, rojo: 0, neutro: 0 };
    lista.forEach(function (x) { c[estadoCMI(x, numES(x.Valor))]++; });
    var conMeta = c.verde + c.ambar + c.rojo;
    var pct = conMeta ? Math.round((c.verde / conMeta) * 100) : 0;
    var anillo = pct >= 80 ? "verde" : pct >= 50 ? "ambar" : "rojo";
    var C = 2 * Math.PI * 44, off = C * (1 - pct / 100);
    var ring = '<svg class="hero-ring" viewBox="0 0 104 104" role="img" aria-label="' + pct + '% de indicadores en meta">' +
      '<circle class="hero-ring-bg" cx="52" cy="52" r="44"></circle>' +
      '<circle class="hero-ring-val ' + anillo + '" cx="52" cy="52" r="44" stroke-dasharray="' + C.toFixed(1) +
        '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 52 52)"></circle>' +
      '<text class="hero-ring-pct" x="52" y="50" text-anchor="middle" dominant-baseline="middle">' + pct + '%</text>' +
      '<text class="hero-ring-cap" x="52" y="67" text-anchor="middle">EN META</text></svg>';
    var sub = lista.length + ' indicadores CMI · periodo ' + (p || "—") +
      (c.neutro ? ' · ' + c.neutro + ' cualitativos' : '');
    box.innerHTML = ring +
      '<div class="hero-main">' +
        '<div class="hero-title">Situación global del cuadro de mando</div>' +
        '<div class="hero-sub">' + sub + '</div>' +
        '<div class="hero-counts">' +
          '<span class="hero-count verde"><span class="ico">✓</span><span class="n">' + c.verde + '</span> en meta</span>' +
          '<span class="hero-count ambar"><span class="ico">▲</span><span class="n">' + c.ambar + '</span> en riesgo</span>' +
          '<span class="hero-count rojo"><span class="ico">✕</span><span class="n">' + c.rojo + '</span> críticos</span>' +
        '</div>' +
      '</div>';
  }

  // Overview: barras horizontales de cumplimiento medio por objetivo estratégico (estilo BI)
  function renderOverviewObjetivos() {
    var box = el("ovObjetivos");
    if (!box) return;
    var porObj = gruposCMI(), orden = Object.keys(porObj).sort(), objetivos = estado.data.objetivos || {};
    if (!orden.length) { box.innerHTML = '<p class="hint">Sin datos de CMI en este periodo.</p>'; return; }
    var html = "";
    orden.forEach(function (obj) {
      var pcts = porObj[obj].map(cumplimientoKR).filter(function (x) { return x !== null; });
      var avg = pcts.length ? pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length : null;
      var e = avg === null ? "neutro" : bandaObjetivo(avg);
      var pct = avg === null ? 0 : Math.round(avg);
      html += '<div class="ovbar-row">' +
        '<div class="ovbar-lab"><span class="ovbar-cod">' + obj + '</span> ' + (objetivos[obj] || "") + '</div>' +
        '<div class="ovbar-track"><div class="ovbar-fill ' + e + '" style="width:' + pct + '%"></div></div>' +
        '<div class="ovbar-val ' + e + '">' + (avg === null ? "s/d" : pct + "%") + '</div>' +
        '</div>';
    });
    box.innerHTML = html;
  }

  function renderEjecutivo() {
    var box = el("ejecBox");
    if (!box) return;
    var p = estado.periodoSel;
    var cmi = cmiDe(p);
    var cuenta = { verde: 0, ambar: 0, rojo: 0, neutro: 0 }, criticos = [];
    cmi.forEach(function (c) {
      var e = estadoCMI(c, numES(c.Valor));
      cuenta[e] = (cuenta[e] || 0) + 1;
      if (e === "rojo") criticos.push(c.Codigo + " · " + c.Indicador);
    });
    var html = "";
    html += '<div class="ejec-head"><h2>Cuadro de Mando · Fisioterapia AP — DASE Sureste</h2>' +
      '<div class="hint">Periodo <strong>' + (p || "—") + '</strong> · ' + cmi.length + " indicadores CMI · " + unidadesDe(p).length + " unidades</div></div>";
    html += '<div class="ejec-sem">' +
      '<span class="pill verde">' + cuenta.verde + " en meta</span>" +
      '<span class="pill ambar">' + cuenta.ambar + " en riesgo</span>" +
      '<span class="pill rojo">' + cuenta.rojo + " críticos</span></div>";
    if (criticos.length) html += '<div class="aviso error"><strong>Críticos:</strong> ' + criticos.join(" · ") + "</div>";

    html += '<div class="ejec-cols">';
    // Columna izquierda: objetivos en formato OKR (progreso por objetivo)
    html += '<div><h3>Objetivos estratégicos (OKR)</h3>';
    var porObj = gruposCMI(), orden = Object.keys(porObj).sort(), objetivos = estado.data.objetivos || {};
    if (!orden.length) html += '<p class="hint">Sin datos de CMI en este periodo.</p>';
    orden.forEach(function (obj) {
      var pcts = porObj[obj].map(cumplimientoKR).filter(function (x) { return x !== null; });
      var avg = pcts.length ? pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length : null;
      var e = avg === null ? "neutro" : bandaObjetivo(avg);
      html += '<div class="ejec-obj"><div class="eo-top">' +
        '<span class="eo-name">' + obj + " · " + (objetivos[obj] || "") + "</span>" +
        '<span class="eo-pct ' + e + '">' + (avg === null ? "s/d" : Math.round(avg) + "%") + "</span></div>" +
        '<div class="eo-bar"><div class="eo-fill ' + e + '" style="width:' + (avg === null ? 0 : Math.round(avg)) + '%"></div></div></div>';
    });
    html += "</div>";

    // Columna derecha: mapa de calor compacto con las columnas que tienen datos
    var todas = (estado.data.operativoCols || []);
    var cols = todas.filter(function (col) { return mediaOperativa(p, col.clave) !== null; });
    var medias = {};
    cols.forEach(function (col) { medias[col.clave] = mediaOperativa(p, col.clave); });
    html += '<div><h3>Unidades — indicadores clave</h3>';
    if (!cols.length) {
      html += '<p class="hint">Sin datos por unidad en este periodo.</p>';
    } else {
      html += '<div class="heat-wrap"><table class="heat"><thead><tr><th>Unidad</th>';
      cols.forEach(function (col) { html += "<th>" + col.etiqueta + "</th>"; });
      html += "</tr></thead><tbody>";
      unidadesOrdenadas(p).forEach(function (u) {
        html += "<tr><td>" + u.Unidad + "</td>";
        cols.forEach(function (col) {
          var v = numES(u[col.clave]);
          var e = v === null ? "nodata" : estadoCelda(col, v, medias);
          html += '<td class="' + e + '">' + (v === null ? "—" : fmt(v, v % 1 ? 1 : 0)) + "</td>";
        });
        html += "</tr>";
      });
      html += "</tbody></table></div>";
    }
    html += "</div></div>";
    box.innerHTML = html;
  }

  function renderSelectorPeriodo() {
    var sel = el("periodoSel");
    sel.innerHTML = "";
    ordenarPeriodos(estado.periodos).slice().reverse().forEach(function (p) {
      var o = document.createElement("option");
      o.value = p; o.textContent = p;
      if (p === estado.periodoSel) o.selected = true;
      sel.appendChild(o);
    });
  }

  function renderResumen() {
    var p = estado.periodoSel;
    var cmi = cmiDe(p);
    var cuenta = { verde: 0, ambar: 0, rojo: 0, neutro: 0 };
    var criticos = [];
    cmi.forEach(function (c) {
      var v = numES(c.Valor), e = estadoCMI(c, v);
      cuenta[e] = (cuenta[e] || 0) + 1;
      if (e === "rojo") criticos.push(c.Codigo + " · " + c.Indicador);
    });

    var html = "";
    html += card("Periodo", p || "—", "azul", cmi.length + " indicadores CMI · " + unidadesDe(p).length + " unidades");
    html += card("En meta", cuenta.verde, "verde", "indicadores en verde");
    html += card("En riesgo", cuenta.ambar, "ambar", "indicadores en ámbar");
    html += card("Críticos", cuenta.rojo, "rojo", "indicadores en rojo");
    el("resumenCards").innerHTML = html;

    // medias DASE clave
    var claves = [
      { c: "DemoraVI", l: "Demora valoración inicial", u: "días", dir: "menor_mejor", meta: 35 },
      { c: "DemoraTto", l: "Demora inicio tratamiento", u: "días", dir: "menor_mejor", meta: 7 },
      { c: "ObjAltaPct", l: "Objetivos al alta", u: "%", dir: "mayor_mejor", meta: 80 },
      { c: "CarteraPct", l: "Cumplimiento de cartera", u: "%", dir: "mayor_mejor", meta: 74.5 },
    ];
    var mh = "";
    var prev = periodoAnterior(p);
    claves.forEach(function (k) {
      var m = mediaOperativa(p, k.c);
      var e = estadoMeta(m, k.meta, k.dir);
      var mAnt = prev ? mediaOperativa(prev, k.c) : null;
      var t = (mAnt !== null && m !== null) ? tendencia(m, mAnt, k.dir) : null;
      var deltaHTML = (t && t.delta !== null && t.delta !== 0)
        ? '<div class="delta ' + t.cls + '" title="vs ' + prev + '">' + t.txt + ' ' + k.u + ' vs ' + prev + '</div>'
        : '';
      mh += '<div class="card ' + e + '"><div class="k">' + k.l + ' (media DASE)</div>' +
        '<div class="v">' + fmt(m, 2) + ' <span style="font-size:1rem;color:var(--gris)">' + k.u + '</span></div>' +
        '<div class="det">Meta: ' + (k.dir === "menor_mejor" ? "≤ " : "≥ ") + fmt(k.meta, k.meta % 1 ? 1 : 0) + " " + k.u + '</div>' +
        deltaHTML + '</div>';
    });
    el("resumenMedias").innerHTML = mh;

    var critBox = el("criticosBox");
    if (criticos.length) {
      critBox.className = "aviso error";
      critBox.innerHTML = "<strong>Indicadores críticos (" + criticos.length + "):</strong> " + criticos.join(" · ");
    } else {
      critBox.className = "aviso ok";
      critBox.innerHTML = "Sin indicadores críticos en este periodo.";
    }
  }

  function card(k, v, cls, det) {
    return '<div class="card ' + cls + '"><div class="k">' + k + '</div><div class="v">' + v +
      '</div><div class="det">' + (det || "") + "</div></div>";
  }

  // dominio (máximo del eje) para barras y medidores
  function dominio(c) {
    var vals = [numES(c.Valor), numES(c.MetaNum), numES(c.PuntoPartida)].filter(function (x) { return x !== null; });
    estado.periodos.forEach(function (per) { var x = valorCMI(per, c.Codigo); if (x !== null) vals.push(x); });
    var max = vals.length ? Math.max.apply(null, vals) : 1;
    if ((c.Unidad || "").indexOf("%") !== -1 && max <= 100) max = 100; // % a escala 0-100
    return max <= 0 ? 1 : max * 1.05;
  }

  // ===== Fichas explicativas por indicador del CMI =====
  // Qué mide · de dónde sale el dato · cómo mejorarlo. Contenido de referencia
  // (no depende de los datos cargados): el CMI estratégico es un conjunto fijo.
  var FICHAS = {
    "P1-01": { nom: "Demora de valoración inicial",
      mide: "Días que pasan desde que el paciente es derivado hasta su primera valoración por fisioterapia. Mide la accesibilidad de entrada al servicio.",
      fuente: "Agenda de citación (AP-Madrid): diferencia entre la fecha de derivación y la fecha de primera valoración; se promedia por unidad y para el conjunto de la DASE.",
      mejora: ["Optimizar las agendas y reservar huecos de primeras valoraciones", "Triaje previo para priorizar los casos urgentes", "Reasignar demanda hacia unidades con menor demora", "Revisar absentismo y citas duplicadas que bloquean huecos"] },
    "P1-02": { nom: "Demora de inicio de tratamiento",
      mide: "Días entre la valoración inicial y la primera sesión de tratamiento. Mide la rapidez en empezar a tratar tras valorar.",
      fuente: "Agenda: fecha de valoración frente a fecha de primera sesión; media por unidad y DASE.",
      mejora: ["Reservar huecos de inicio próximos a la valoración", "Protocolos de inicio precoz en patología frecuente", "Sesiones grupales para descargar la agenda individual", "Controlar la lista de espera de tratamiento por unidad"] },
    "P1-03": { nom: "Presión asistencial y frecuentación",
      mide: "Carga asistencial por fisioterapeuta y número medio de sesiones por paciente (frecuentación), así como la dispersión entre unidades.",
      fuente: "Actividad registrada (sesiones y pacientes) dividida por la plantilla equivalente; comparación entre unidades.",
      mejora: ["Estandarizar el número de sesiones por proceso (alta por objetivos)", "Reequilibrar plantilla y derivación entre unidades", "Promover el alta proactiva al cumplir objetivos", "Evitar la frecuentación clínicamente innecesaria"] },
    "P1-04": { nom: "Actividad grupal (Educación para la Salud)",
      mide: "Porcentaje de unidades que realizan actividad grupal de Educación para la Salud (escuela de espalda, ejercicio terapéutico, etc.).",
      fuente: "Registro de actividad grupal por unidad (memoria de actividad / agenda de grupos).",
      mejora: ["Implantar al menos un grupo de EpS por unidad", "Formar a los profesionales en metodología grupal", "Agendar sesiones grupales periódicas", "Registrar sistemáticamente la actividad realizada"] },
    "P2-01": { nom: "Consecución de objetivos al alta",
      mide: "Porcentaje de pacientes que alcanzan los objetivos terapéuticos pactados en el momento del alta. Mide la efectividad clínica.",
      fuente: "Registro clínico al alta: objetivos cumplidos sobre el total de altas.",
      mejora: ["Fijar objetivos SMART y funcionales al inicio del tratamiento", "Reevaluación intermedia para ajustar el plan", "Homogeneizar los criterios de alta entre profesionales", "Formación en establecimiento de objetivos"] },
    "P2-02": { nom: "Mejora del dolor al alta",
      mide: "Porcentaje de pacientes con mejoría clínicamente relevante del dolor (p. ej. escala EVA) entre el inicio y el alta.",
      fuente: "Escala de dolor (EVA) registrada al inicio y al alta; se considera la diferencia respecto al umbral de relevancia clínica.",
      mejora: ["Medir el dolor de forma sistemática al inicio y al alta", "Planes de tratamiento basados en la evidencia", "Educación en dolor y autocuidados", "Seguimiento específico de los pacientes que no responden"] },
    "P2-03": { nom: "Cumplimiento de cartera (506/414)",
      mide: "Grado de implantación de las técnicas y procesos de la cartera de servicios de fisioterapia de AP en cada unidad.",
      fuente: "Autoevaluación de cartera por unidad (técnicas disponibles sobre el catálogo); códigos 506/414.",
      mejora: ["Dotar de recursos y formación las técnicas ausentes", "Homogeneizar la cartera entre unidades", "Plan de implantación priorizado por impacto", "Revisión periódica del cumplimiento por unidad"] },
    "P2-04": { nom: "Población atendida",
      mide: "Porcentaje de la población de referencia que recibe atención de fisioterapia. Mide la cobertura del servicio.",
      fuente: "Pacientes atendidos sobre la población asignada (tarjeta sanitaria, TIS).",
      mejora: ["Mejorar la accesibilidad reduciendo las demoras", "Asegurar la derivación adecuada de patología subsidiaria", "Captación activa en procesos prevalentes", "Reducir barreras de acceso al servicio"] },
    "P3-01": { nom: "Satisfacción durante la lista de espera",
      mide: "Experiencia y satisfacción del paciente mientras espera ser atendido, especialmente tras el triaje.",
      fuente: "Encuesta de satisfacción específica durante la espera (pendiente de implantar de forma sistemática).",
      mejora: ["Implantar la encuesta de satisfacción en espera", "Información proactiva al paciente sobre su proceso", "Triaje con recomendaciones y autocuidados durante la espera", "Acortar los tiempos de espera percibidos"] },
    "P3-02": { nom: "Triaje en la primera quincena",
      mide: "Porcentaje de derivaciones a las que se realiza triaje (cribado y priorización) dentro de los primeros 15 días.",
      fuente: "Registro de triaje frente a la fecha de derivación.",
      mejora: ["Establecer un circuito de triaje sistemático", "Agenda dedicada al triaje de derivaciones", "Criterios de priorización claros y compartidos", "Formación del equipo en cribado"] },
    "P4-01": { nom: "Formación en líneas estratégicas",
      mide: "Porcentaje de profesionales formados en las líneas estratégicas del servicio (dolor, ejercicio terapéutico, EpS, etc.).",
      fuente: "Registro de formación: profesionales formados sobre el total de la plantilla.",
      mejora: ["Plan de formación anual alineado con las líneas estratégicas", "Sesiones de formación interna entre unidades", "Facilitar el acceso a cursos acreditados", "Vincular la formación a los objetivos del equipo"] },
    "P4-02": { nom: "Coordinación: circuitos de derivación",
      mide: "Número de unidades con un circuito de derivación normalizado con otros niveles y servicios (objetivo: las 19 unidades).",
      fuente: "Documentación de circuitos de derivación por unidad.",
      mejora: ["Protocolizar los circuitos con Atención Primaria y Hospitalaria", "Normalizar los criterios de derivación", "Acuerdos con los servicios implicados", "Desplegar el circuito a las 19 unidades"] }
  };

  function infoBtn(cod) {
    return FICHAS[cod]
      ? '<button class="info-btn no-print" type="button" data-ficha="' + cod +
        '" title="¿Qué mide y cómo mejorarlo?" aria-label="Qué mide el indicador ' + cod + '">ⓘ</button>'
      : "";
  }

  function abrirFicha(cod) {
    var f = FICHAS[cod], modal = el("fichaModal");
    if (!f || !modal) return;
    var reg = cmiDe(estado.periodoSel).filter(function (c) { return c.Codigo === cod; })[0];
    var e = reg ? estadoCMI(reg, numES(reg.Valor)) : "neutro";
    var objs = estado.data.objetivos || {};
    var valTxt = (reg && numES(reg.Valor) !== null)
      ? fmt(numES(reg.Valor), numES(reg.Valor) % 1 ? 2 : 0) + " " + (reg.Unidad || "") : "s/d";
    el("fichaCod").textContent = cod + (reg && reg.Objetivo ? " · " + reg.Objetivo + " " + (objs[reg.Objetivo] || "") : "");
    el("fichaTit").textContent = f.nom;
    el("fichaEstado").innerHTML =
      '<span class="pill ' + e + '"><span class="dot"></span>' + estadoLabel(e) + "</span>" +
      '<span class="ficha-val">Valor actual: <strong>' + valTxt + "</strong></span>" +
      (reg && reg.Meta ? '<span class="ficha-val">Meta: <strong>' + reg.Meta + "</strong></span>" : "");
    el("fichaMide").textContent = f.mide;
    el("fichaFuente").textContent = f.fuente;
    el("fichaMejora").innerHTML = f.mejora.map(function (m) { return "<li>" + m + "</li>"; }).join("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var x = el("fichaX"); if (x) x.focus();
  }

  function cerrarFicha() {
    var modal = el("fichaModal");
    if (modal && !modal.hidden) { modal.hidden = true; document.body.style.overflow = ""; }
  }

  function bulletBar(c) {
    var v = numES(c.Valor), e = estadoCMI(c, v), meta = numES(c.MetaNum), dom = dominio(c);
    var pct = v === null ? 0 : Math.max(0, Math.min(100, (v / dom) * 100));
    var metaPct = meta === null ? null : Math.max(0, Math.min(100, (meta / dom) * 100));
    return '<div class="barra ' + e + '">' +
      '<div class="blab"><span class="bcod">' + c.Codigo + '</span>' + infoBtn(c.Codigo) + ' ' + c.Indicador + '</div>' +
      '<div class="btrack">' +
        '<div class="bfill ' + e + '" style="width:' + pct.toFixed(1) + '%"></div>' +
        (metaPct === null ? "" : '<div class="bmeta" style="left:' + metaPct.toFixed(1) + '%" title="meta ' + (c.Meta || "") + '"></div>') +
      '</div>' +
      '<div class="bval">' + (v === null ? "—" : fmt(v, v % 1 ? 2 : 0)) + " " + (c.Unidad || "") + '</div>' +
      '</div>';
  }

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  // fracción de "logro": lleno = mejor, respetando la dirección del indicador
  function fraccionLogro(valor, dom, direccion) {
    if (valor === null) return 0;
    var f = clamp01(valor / dom);
    return direccion === "menor_mejor" ? 1 - f : f;
  }

  function gauge(c) {
    var v = numES(c.Valor), e = estadoCMI(c, v), meta = numES(c.MetaNum), dom = dominio(c);
    var perf = fraccionLogro(v, dom, c.Direccion);
    // semicírculo superior: izquierda (fr=0) -> derecha (fr=1), sweep=1 dibuja por arriba
    var cx = 100, cy = 96, r = 80;
    function punto(fr, rr) { var a = Math.PI * (1 - fr); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; }
    var L = punto(0, r), R = punto(1, r);
    // MISMO trazado para fondo y valor; el valor se revela con dasharray (overlap perfecto)
    var dPath = "M" + L[0].toFixed(1) + " " + L[1].toFixed(1) + " A" + r + " " + r + " 0 0 1 " + R[0].toFixed(1) + " " + R[1].toFixed(1);
    var valArc = perf > 0
      ? '<path class="g-val ' + e + '" d="' + dPath + '" pathLength="100" stroke-dasharray="' + (perf * 100).toFixed(2) + ' 100"/>'
      : "";
    var metaTick = "";
    if (meta !== null) {
      var fm = clamp01(c.Direccion === "menor_mejor" ? 1 - meta / dom : meta / dom);
      var pa = punto(fm, r - 11), pb = punto(fm, r + 4);
      metaTick = '<line class="g-meta" x1="' + pa[0].toFixed(1) + '" y1="' + pa[1].toFixed(1) + '" x2="' + pb[0].toFixed(1) + '" y2="' + pb[1].toFixed(1) + '"/>';
    }
    var vTxt = v === null ? "sin dato" : fmt(v, v % 1 ? 2 : 0) + (c.Unidad ? " " + c.Unidad : "");
    var aria = (c.Indicador + ". " + estadoLabel(e) + ". Valor: " + vTxt + ". Meta: " + (c.Meta || "sin meta") + ".").replace(/"/g, "'");
    var svg = '<svg viewBox="0 0 200 108" role="img" aria-label="' + aria + '">' +
      '<path class="g-bg" d="' + dPath + '"/>' + valArc + metaTick + '</svg>';
    return '<div class="gauge ' + e + '">' +
      '<div class="gcod">' + c.Codigo + infoBtn(c.Codigo) + ' <span class="badge ' + e + '">' + estadoLabel(e) + '</span></div>' +
      '<div class="gnom">' + c.Indicador + '</div>' + svg +
      '<div class="gval">' + (v === null ? "—" : fmt(v, v % 1 ? 2 : 0)) + ' <span class="uni">' + (c.Unidad || "") + '</span></div>' +
      '<div class="gmetatxt">Meta: ' + (c.Meta || "—") + '</div>' +
      '</div>';
  }

  function estadoLabel(e) {
    return e === "verde" ? "En meta" : e === "ambar" ? "En riesgo" : e === "rojo" ? "Crítico" : "Cualitativo";
  }

  function partidaTxt(c) {
    var pp = numES(c.PuntoPartida);
    return pp === null ? (c.PuntoPartida || "—") : fmt(pp, pp % 1 ? 2 : 0);
  }

  function tarjetaCMI(c, prev) {
    var v = numES(c.Valor), e = estadoCMI(c, v), meta = numES(c.MetaNum), dom = dominio(c);
    var serie = estado.periodos.map(function (per) { return valorCMI(per, c.Codigo); });
    var vAnt = prev ? valorCMI(prev, c.Codigo) : null;
    var t = (vAnt !== null && v !== null) ? tendencia(v, vAnt, c.Direccion) : null;
    var trendHTML = t ? '<span class="trend ' + t.cls + '" title="vs ' + prev + '">' + t.txt + "</span>" : "";

    var info;
    if (meta !== null && v !== null) {
      var pct = Math.max(0, Math.min(100, (v / dom) * 100));
      var metaPct = Math.max(0, Math.min(100, (meta / dom) * 100));
      info = '<div class="prog"><div class="prog-track">' +
        '<div class="prog-fill ' + e + '" style="width:' + pct.toFixed(1) + '%"></div>' +
        '<div class="prog-meta" style="left:' + metaPct.toFixed(1) + '%" title="meta"></div></div>' +
        '<div class="prog-labels"><span class="meta-d">Meta: ' + (c.Meta || "—") + "</span>" +
        '<span class="part-d">Partida ' + partidaTxt(c) + "</span></div></div>";
    } else {
      info = '<div class="meta-cual"><strong>Meta:</strong> ' + (c.Meta || "—") +
        (numES(c.PuntoPartida) !== null ? " · Partida: " + partidaTxt(c) : "") + "</div>";
    }

    var spark = serie.filter(function (x) { return x !== null; }).length >= 2 ? sparkline(serie, c.Direccion, meta) : "";
    return '<div class="ind ' + e + '">' +
      '<div class="sem"></div>' +
      '<div class="ind-top"><span class="cod">' + c.Codigo + "</span>" + infoBtn(c.Codigo) +
      '<span class="pill ' + e + '"><span class="dot"></span>' + estadoLabel(e) + "</span></div>" +
      '<div class="nom">' + c.Indicador + "</div>" +
      '<div class="valwrap"><span class="val">' + (v === null ? "—" : fmt(v, v % 1 ? 2 : 0)) +
      '</span><span class="uni">' + (c.Unidad || "") + "</span>" + trendHTML + "</div>" +
      info + spark + "</div>";
  }

  function gruposCMI() {
    var porObj = {};
    cmiDe(estado.periodoSel).forEach(function (c) { (porObj[c.Objetivo] = porObj[c.Objetivo] || []).push(c); });
    return porObj;
  }

  // ---------- vista OKR ----------
  // % de cumplimiento de la meta (respeta la dirección), acotado 0-100
  function cumplimientoKR(c) {
    var v = numES(c.Valor), meta = numES(c.MetaNum);
    if (v === null || meta === null) return null;
    var pct;
    if (c.Direccion === "menor_mejor") pct = v <= 0 ? 100 : (meta / v) * 100;
    else pct = meta <= 0 ? (v > 0 ? 100 : 0) : (v / meta) * 100;
    return Math.max(0, Math.min(100, pct));
  }
  function bandaObjetivo(pct) { return pct >= 90 ? "verde" : pct >= 60 ? "ambar" : "rojo"; }

  function donut(pct, e) {
    var r = 26, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100);
    return '<svg class="okr-ring" viewBox="0 0 64 64" role="img">' +
      '<circle class="okr-ring-bg" cx="32" cy="32" r="' + r + '"/>' +
      '<circle class="okr-ring-val ' + e + '" cx="32" cy="32" r="' + r +
      '" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) +
      '" transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="38" text-anchor="middle" class="okr-ring-txt">' + Math.round(pct) + "%</text></svg>";
  }

  function renderOKR(porObj, objetivos) {
    var orden = Object.keys(porObj).sort();
    var html = "";
    orden.forEach(function (obj) {
      var krs = porObj[obj];
      var pcts = krs.map(cumplimientoKR).filter(function (x) { return x !== null; });
      var avg = pcts.length ? pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length : null;
      var eo = avg === null ? "neutro" : bandaObjetivo(avg);
      html += '<div class="okr-obj ' + eo + '"><div class="okr-obj-head">' +
        (avg === null ? '<div class="okr-ring-wrap neutro"><span>s/d</span></div>' : donut(avg, eo)) +
        '<div class="okr-obj-meta"><div class="okr-obj-title">' + obj + " · " + (objetivos[obj] || "") + "</div>" +
        '<div class="okr-obj-sub">' + krs.length + " resultados clave" +
        (avg !== null ? " · " + Math.round(avg) + "% cumplimiento medio" : "") + "</div></div></div>" +
        '<div class="okr-krs">';
      krs.forEach(function (c) {
        var v = numES(c.Valor), e = estadoCMI(c, v), pct = cumplimientoKR(c);
        var valTxt = (v === null ? "—" : fmt(v, v % 1 ? 2 : 0)) + (c.Unidad ? " " + c.Unidad : "");
        var cuerpo = pct === null
          ? '<div class="kr-cual">Cualitativo · ' + estadoLabel(e) + "</div>"
          : '<div class="kr-bar"><div class="kr-fill ' + e + '" style="width:' + pct.toFixed(0) + '%"></div></div>';
        html += '<div class="okr-kr">' +
          '<div class="kr-head"><span class="kr-cod">' + c.Codigo + '</span>' + infoBtn(c.Codigo) +
          '<span class="kr-name">' + c.Indicador + '</span>' +
          '<span class="kr-pct ' + e + '">' + (pct === null ? "—" : Math.round(pct) + "%") + "</span></div>" +
          cuerpo +
          '<div class="kr-foot"><span>Actual: <strong>' + valTxt + "</strong></span>" +
          "<span>Meta: " + (c.Meta || "—") + "</span></div></div>";
      });
      html += "</div></div>"; // cierra .okr-krs y .okr-obj
    });
    return html;
  }

  function renderCMI() {
    var prev = periodoAnterior(estado.periodoSel);
    var objetivos = estado.data.objetivos || {};
    var porObj = gruposCMI();
    var orden = Object.keys(porObj).sort();
    var modo = estado.disenoCMI;
    if (modo === "okr") {
      el("cmiBox").innerHTML = orden.length ? renderOKR(porObj, objetivos) : '<p class="hint">Sin datos de CMI para este periodo.</p>';
      return;
    }
    var html = "";
    orden.forEach(function (obj) {
      html += '<div class="' + (modo === "barras" ? "barras-grupo" : "obj-grupo") + '">' +
        '<div class="obj-titulo">' + obj + " · " + (objetivos[obj] || "") + "</div>";
      if (modo === "barras") {
        porObj[obj].forEach(function (c) { html += bulletBar(c); });
      } else if (modo === "medidores") {
        html += '<div class="gauge-grid">';
        porObj[obj].forEach(function (c) { html += gauge(c); });
        html += "</div>";
      } else {
        html += '<div class="ind-grid">';
        porObj[obj].forEach(function (c) { html += tarjetaCMI(c, prev); });
        html += "</div>";
      }
      html += "</div>";
    });
    el("cmiBox").innerHTML = html || '<p class="hint">Sin datos de CMI para este periodo.</p>';
  }

  // estado de una celda operativa según su columna
  function estadoCelda(col, valor, medias) {
    return col.tipo === "relativo"
      ? estadoRelativo(valor, medias[col.clave], col.direccion)
      : estadoMeta(valor, col.metaNum, col.direccion);
  }

  function unidadesOrdenadas(p) {
    var sc = estado.sortCol, sd = estado.sortDir;
    return unidadesDe(p).slice().sort(function (a, b) {
      var va = sc === "Unidad" ? a.Unidad : numES(a[sc]);
      var vb = sc === "Unidad" ? b.Unidad : numES(b[sc]);
      if (va === null) return 1; if (vb === null) return -1;
      if (va < vb) return -1 * sd; if (va > vb) return 1 * sd; return 0;
    });
  }

  function renderOperativa() {
    var p = estado.periodoSel;
    var cols = estado.data.operativoCols || [];
    var medias = {};
    cols.forEach(function (col) { medias[col.clave] = mediaOperativa(p, col.clave); });
    var us = unidadesOrdenadas(p);

    if (estado.vistaUnidad === "heatmap") {
      var hh = '<thead><tr><th>Unidad</th>';
      cols.forEach(function (col) { hh += "<th>" + col.etiqueta + "</th>"; });
      hh += "</tr></thead><tbody>";
      us.forEach(function (u) {
        hh += "<tr><td>" + u.Unidad + "</td>";
        cols.forEach(function (col) {
          var v = numES(u[col.clave]);
          var e = v === null ? "nodata" : estadoCelda(col, v, medias);
          hh += '<td class="' + e + '">' + (v === null ? "—" : fmt(v, v % 1 ? 1 : 0)) + "</td>";
        });
        hh += "</tr>";
      });
      hh += "</tbody>";
      el("uniTabla").innerHTML = hh;
      el("uniTabla").className = "heat";
      return;
    }

    el("uniTabla").className = "uni";
    var th = '<th data-col="Unidad">Unidad ' + arrow("Unidad") + "</th>";
    cols.forEach(function (col) {
      th += '<th data-col="' + col.clave + '">' + col.etiqueta + " " + arrow(col.clave) + "</th>";
    });
    var body = "";
    us.forEach(function (u) {
      body += "<tr><td>" + u.Unidad + "</td>";
      cols.forEach(function (col) {
        var v = numES(u[col.clave]);
        var cls = v === null ? "nodata" : estadoCelda(col, v, medias);
        body += '<td class="cell ' + cls + '">' + (v === null ? "—" : fmt(v, v % 1 ? 2 : 0)) + "</td>";
      });
      body += "</tr>";
    });
    body += '<tr style="font-weight:700;background:var(--fila-media)"><td>Media DASE</td>';
    cols.forEach(function (col) { var m = medias[col.clave]; body += '<td class="cell">' + (m === null ? "—" : fmt(m, m % 1 ? 2 : 0)) + "</td>"; });
    body += "</tr>";

    el("uniTabla").innerHTML = "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody>";
    Array.prototype.forEach.call(el("uniTabla").querySelectorAll("th"), function (h) {
      h.addEventListener("click", function () {
        var c = h.getAttribute("data-col");
        if (estado.sortCol === c) estado.sortDir *= -1; else { estado.sortCol = c; estado.sortDir = (c === "Unidad" ? 1 : -1); }
        renderOperativa();
      });
    });
  }

  // ---------- OKR por unidad (prioridades) ----------
  var AREAS_UNI = [
    { area: "Accesibilidad y demoras", claves: ["PctAtendida", "DemoraVI", "DemoraTto", "PresionMes"] },
    { area: "Efectividad clínica", claves: ["ObjAltaPct", "DolorBajaPct"] },
    { area: "Cartera de servicios", claves: ["CarteraPct"] },
    { area: "Actividad", claves: ["PendientesVI", "SesionesIndiv", "ConsultasVI"] },
  ];
  function colConfig(clave) { return (estado.data.operativoCols || []).filter(function (c) { return c.clave === clave; })[0]; }
  function refMedia(periodo) { var m = {}; (estado.data.operativoCols || []).forEach(function (c) { m[c.clave] = mediaOperativa(periodo, c.clave); }); return m; }
  function refValor(col) { return (col.tipo === "meta" && col.metaNum != null) ? col.metaNum : null; }
  function estadoUniCelda(col, v, medias) {
    return col.tipo === "relativo" ? estadoRelativo(v, medias[col.clave], col.direccion) : estadoMeta(v, col.metaNum, col.direccion);
  }
  function cumplimientoUni(col, v, mean) {
    if (v === null) return null;
    var ref = (col.tipo === "meta" && col.metaNum != null) ? col.metaNum : mean;
    if (ref === null || ref === 0) return null;
    var pct = col.direccion === "menor_mejor" ? (v <= 0 ? 100 : ref / v * 100) : (v / ref * 100);
    return Math.max(0, Math.min(100, pct));
  }
  function deficitUni(col, v, mean) {
    if (v === null) return 0;
    var ref = (col.tipo === "meta" && col.metaNum != null) ? col.metaNum : mean;
    if (ref === null || ref === 0) return 0;
    var def = col.direccion === "menor_mejor" ? (v - ref) / Math.abs(ref) : (ref - v) / Math.abs(ref);
    return Math.max(0, def);
  }
  function objetivoTxt(col, medias) {
    var refv = refValor(col);
    if (refv !== null) return (col.direccion === "menor_mejor" ? "≤ " : "≥ ") + fmt(refv, refv % 1 ? 1 : 0);
    return "ref. media DASE " + fmt(medias[col.clave], 1);
  }

  function renderOKRUnidad() {
    var box = el("okrUniBox"); if (!box) return;
    var p = estado.periodoSel;
    var us = unidadesDe(p);
    var sel = el("okrUniSel");
    if (!us.length) {
      if (sel) sel.innerHTML = "";
      box.innerHTML = '<p class="hint">Sin datos por unidad en este periodo.</p>';
      return;
    }
    var nombres = us.map(function (u) { return u.Unidad; }).sort();
    if (!estado.unidadOKR || nombres.indexOf(estado.unidadOKR) === -1) estado.unidadOKR = nombres[0];
    if (sel) sel.innerHTML = nombres.map(function (n) { return "<option" + (n === estado.unidadOKR ? " selected" : "") + ">" + n + "</option>"; }).join("");

    var medias = refMedia(p);
    var u = us.filter(function (x) { return x.Unidad === estado.unidadOKR; })[0] || us[0];

    var inds = [];
    (estado.data.operativoCols || []).forEach(function (col) {
      var v = numES(u[col.clave]); if (v === null) return;
      inds.push({ col: col, v: v, e: estadoUniCelda(col, v, medias), cmp: cumplimientoUni(col, v, medias[col.clave]), def: deficitUni(col, v, medias[col.clave]) });
    });
    var prio = inds.filter(function (i) { return i.e === "rojo" || i.e === "ambar"; })
      .sort(function (a, b) {
        var sa = (a.e === "rojo" ? 2 : 1) + Math.min(a.def, 1), sb = (b.e === "rojo" ? 2 : 1) + Math.min(b.def, 1);
        return sb - sa;
      }).slice(0, 3);

    var html = "";
    html += '<div class="okruni-head"><div class="okruni-name">' + u.Unidad + "</div>" +
      '<div class="hint">Código ' + (u.Codigo || "—") + " · Población " + (numES(u.Poblacion) !== null ? fmt(numES(u.Poblacion), 0) : "—") +
      (u.Fisioterapeutas ? " · " + u.Fisioterapeutas + " fisioterapeutas" : "") + "</div></div>";

    html += '<h3 class="okruni-sec">Prioridades de la unidad</h3>';
    if (!prio.length) {
      html += '<div class="aviso ok">Sin brechas relevantes: los indicadores con dato están en meta.</div>';
    } else {
      html += '<div class="prio-grid">';
      prio.forEach(function (i, idx) {
        var tag = i.e === "rojo" ? "alta" : "media";
        html += '<div class="prio ' + i.e + '"><div class="prio-top">' +
          '<span class="prio-tag ' + tag + '">Prioridad ' + tag + "</span><span class=\"prio-n\">#" + (idx + 1) + "</span></div>" +
          '<div class="prio-name">' + i.col.etiqueta + "</div>" +
          '<div class="prio-vals"><span class="prio-act">' + fmt(i.v, i.v % 1 ? 2 : 0) + '</span> <span class="hint">→ objetivo ' + objetivoTxt(i.col, medias) + "</span></div>" +
          '<div class="kr-bar"><div class="kr-fill ' + i.e + '" style="width:' + (i.cmp === null ? 0 : Math.round(i.cmp)) + '%"></div></div></div>';
      });
      html += "</div>";
    }

    html += '<h3 class="okruni-sec">Resultados clave por área</h3>';
    AREAS_UNI.forEach(function (g) {
      var rows = inds.filter(function (i) { return g.claves.indexOf(i.col.clave) !== -1; });
      if (!rows.length) return;
      html += '<div class="okruni-area"><div class="obj-titulo">' + g.area + "</div>";
      rows.forEach(function (i) {
        html += '<div class="okr-kr"><div class="kr-head"><span class="kr-name">' + i.col.etiqueta + "</span>" +
          '<span class="kr-pct ' + i.e + '">' + (i.cmp === null ? "—" : Math.round(i.cmp) + "%") + "</span></div>" +
          '<div class="kr-bar"><div class="kr-fill ' + i.e + '" style="width:' + (i.cmp === null ? 0 : Math.round(i.cmp)) + '%"></div></div>' +
          '<div class="kr-foot"><span>Actual: <strong>' + fmt(i.v, i.v % 1 ? 2 : 0) + "</strong></span><span>Objetivo: " + objetivoTxt(i.col, medias) + "</span></div></div>";
      });
      html += "</div>";
    });

    // OKR definidos manualmente para la unidad (hoja OKR_Unidades), si existen
    var manual = (estado.data.okrUnidades || []).filter(function (r) {
      var per = (r.Periodo || "").toString().trim();
      var okPer = !per || per === p;
      var okUni = (r.Codigo && String(r.Codigo).trim() === String(u.Codigo).trim()) || (r.Unidad && String(r.Unidad).trim() === u.Unidad);
      return okPer && okUni;
    });
    if (manual.length) {
      html += '<h3 class="okruni-sec">OKR definidos para la unidad</h3>';
      var porObj = {};
      manual.forEach(function (r) { (porObj[r.Objetivo || "Objetivo"] = porObj[r.Objetivo || "Objetivo"] || []).push(r); });
      Object.keys(porObj).forEach(function (obj) {
        html += '<div class="okruni-area"><div class="obj-titulo">' + obj + "</div>";
        porObj[obj].forEach(function (r) {
          var v = numES(r.Valor), meta = numES(r.Meta), dir = (r.Direccion || "mayor_mejor").trim();
          var cmp = (v !== null && meta !== null) ? Math.max(0, Math.min(100, dir === "menor_mejor" ? (v <= 0 ? 100 : meta / v * 100) : v / meta * 100)) : null;
          var e = cmp === null ? "neutro" : (cmp >= 100 ? "verde" : cmp >= 70 ? "ambar" : "rojo");
          var pr = (r.Prioridad || "").toString().trim();
          html += '<div class="okr-kr"><div class="kr-head"><span class="kr-name">' + (r.KR || "") +
            (pr ? ' <span class="prio-tag ' + (pr.toLowerCase() === "alta" ? "alta" : "media") + '">' + pr + "</span>" : "") + "</span>" +
            '<span class="kr-pct ' + e + '">' + (cmp === null ? "—" : Math.round(cmp) + "%") + "</span></div>" +
            (cmp === null ? "" : '<div class="kr-bar"><div class="kr-fill ' + e + '" style="width:' + Math.round(cmp) + '%"></div></div>') +
            '<div class="kr-foot"><span>Actual: <strong>' + (v === null ? (r.Valor || "—") : fmt(v, v % 1 ? 2 : 0)) + "</strong></span><span>Meta: " + (r.Meta || "—") + "</span></div></div>";
        });
        html += "</div>";
      });
    }

    // matriz comparativa: unidades x áreas (cumplimiento medio del área) + nº prioridades
    html += '<h3 class="okruni-sec">Comparativa de prioridades por unidad</h3>' +
      '<p class="hint">Pulsa una unidad para ver su detalle. El color es el cumplimiento medio del área.</p>';
    html += '<div class="heat-wrap"><table class="heat okruni-matriz"><thead><tr><th>Unidad</th>';
    AREAS_UNI.forEach(function (g) { html += "<th>" + g.area + "</th>"; });
    html += "<th>Prioridades</th></tr></thead><tbody>";
    unidadesOrdenadas(p).forEach(function (uu) {
      var npri = 0, cells = "";
      AREAS_UNI.forEach(function (g) {
        var cs = [];
        g.claves.forEach(function (cl) {
          var col = colConfig(cl); if (!col) return;
          var v = numES(uu[cl]); if (v === null) return;
          var e = estadoUniCelda(col, v, medias);
          if (e !== "verde") npri++;
          var c = cumplimientoUni(col, v, medias[cl]); if (c !== null) cs.push(c);
        });
        if (!cs.length) { cells += '<td class="nodata">—</td>'; return; }
        var avg = cs.reduce(function (a, b) { return a + b; }, 0) / cs.length;
        var e = avg >= 90 ? "verde" : avg >= 60 ? "ambar" : "rojo";
        cells += '<td class="' + e + '">' + Math.round(avg) + "%</td>";
      });
      var clsSel = uu.Unidad === estado.unidadOKR ? "okruni-row sel" : "okruni-row";
      html += '<tr class="' + clsSel + '" data-uni="' + uu.Unidad.replace(/"/g, "") + '"><td>' + uu.Unidad + "</td>" + cells + "<td>" + npri + "</td></tr>";
    });
    html += "</tbody></table></div>";

    box.innerHTML = html;
    if (sel) sel.onchange = function () { estado.unidadOKR = this.value; renderOKRUnidad(); };
    Array.prototype.forEach.call(box.querySelectorAll(".okruni-row"), function (tr) {
      tr.addEventListener("click", function () { estado.unidadOKR = tr.getAttribute("data-uni"); renderOKRUnidad(); });
    });
  }

  function arrow(col) {
    if (estado.sortCol !== col) return '<span class="ar">↕</span>';
    return '<span class="ar">' + (estado.sortDir === 1 ? "▲" : "▼") + "</span>";
  }

  function renderTendencias() {
    var box = el("tendBox");
    var ps = estado.periodos;
    if (ps.length < 2) {
      box.innerHTML = '<div class="aviso">Carga al menos <strong>dos periodos</strong> (dos documentos del mismo origen) para comparar y ver la evolución.</div>';
      return;
    }
    if (!estado.compA || ps.indexOf(estado.compA) === -1) estado.compA = ps[ps.length - 2];
    if (!estado.compB || ps.indexOf(estado.compB) === -1) estado.compB = ps[ps.length - 1];
    var A = estado.compA, B = estado.compB;
    var opts = function (sel) {
      return ps.slice().reverse().map(function (p) {
        return '<option value="' + p + '"' + (p === sel ? " selected" : "") + ">" + p + "</option>";
      }).join("");
    };
    var html = '<div class="cmp-bar"><span>Comparar</span><select id="cmpA">' + opts(A) +
      '</select><span>con</span><select id="cmpB">' + opts(B) + "</select></div>";

    // métricas: KR del CMI + operativos (media DASE)
    var cods = {};
    cmiDe(A).concat(cmiDe(B)).forEach(function (c) { cods[c.Codigo] = c; });
    var filas = [];
    Object.keys(cods).sort().forEach(function (cod) {
      var m = cods[cod];
      filas.push({ grupo: "Indicadores estratégicos (CMI)", cod: cod, nombre: m.Indicador, dir: m.Direccion, uni: m.Unidad || "", a: valorCMI(A, cod), b: valorCMI(B, cod) });
    });
    (estado.data.operativoCols || []).forEach(function (col) {
      filas.push({ grupo: "Indicadores operativos (media DASE)", cod: "", nombre: col.etiqueta, dir: col.direccion, uni: "", a: mediaOperativa(A, col.clave), b: mediaOperativa(B, col.clave) });
    });

    var comparables = filas.filter(function (f) { return f.a !== null && f.b !== null; });
    if (!comparables.length) {
      html += '<div class="aviso">Los periodos <strong>' + A + "</strong> y <strong>" + B +
        "</strong> no comparten indicadores con datos en ambos. Compara periodos del mismo origen (p. ej. dos informes de actividad, o dos plantillas de CMI).</div>";
    } else {
      var grupos = {};
      comparables.forEach(function (f) { (grupos[f.grupo] = grupos[f.grupo] || []).push(f); });
      Object.keys(grupos).forEach(function (g) {
        html += '<h2 class="sec">' + g + '</h2><table class="cmp"><thead><tr>' +
          "<th>Indicador</th><th>" + A + "</th><th>" + B + "</th><th>Δ</th><th>Variación</th></tr></thead><tbody>";
        grupos[g].forEach(function (f) {
          var d = f.b - f.a, pct = f.a !== 0 ? (d / Math.abs(f.a)) * 100 : null;
          var plano = Math.abs(d) < 1e-9;
          var mejora = f.dir === "menor_mejor" ? d < 0 : d > 0;
          var cls = plano ? "flat" : (mejora ? "mejora" : "empeora");
          var arrow = plano ? "=" : (d > 0 ? "▲" : "▼");
          var u = f.uni ? " " + f.uni : "";
          html += "<tr><td>" + (f.cod ? '<span class="kr-cod">' + f.cod + "</span> " : "") + f.nombre + "</td>" +
            "<td>" + fmt(f.a, f.a % 1 ? 2 : 0) + u + "</td>" +
            "<td>" + fmt(f.b, f.b % 1 ? 2 : 0) + u + "</td>" +
            '<td class="cmp-d ' + cls + '">' + arrow + " " + fmt(Math.abs(d), Math.abs(d) % 1 ? 2 : 0) + "</td>" +
            '<td class="cmp-d ' + cls + '">' + (pct === null ? "—" : (d > 0 ? "+" : "") + Math.round(pct) + "%") + "</td></tr>";
        });
        html += "</tbody></table>";
      });
    }

    // Evolución (series con ≥2 puntos en todos los periodos)
    var evo = "";
    Object.keys(cods).sort().forEach(function (cod) {
      var c = cods[cod];
      var serie = ps.map(function (per) { return valorCMI(per, cod); });
      if (serie.filter(function (x) { return x !== null; }).length < 2) return;
      var meta = numES(c.MetaNum);
      evo += chartBox(cod + " · " + c.Indicador, ps[0] + " → " + ps[ps.length - 1] +
        (meta !== null ? " · meta " + fmt(meta, meta % 1 ? 1 : 0) : ""), sparkline(serie, c.Direccion, meta));
    });
    (estado.data.operativoCols || []).forEach(function (col) {
      var serie = ps.map(function (per) { return mediaOperativa(per, col.clave); });
      if (serie.filter(function (x) { return x !== null; }).length < 2) return;
      evo += chartBox(col.etiqueta + " (media DASE)", "evolución por periodo",
        sparkline(serie, col.direccion, col.metaNum !== undefined ? col.metaNum : null));
    });
    if (evo) html += '<h2 class="sec">Evolución por periodo</h2><div class="tend-grid">' + evo + "</div>";

    box.innerHTML = html;
    var sa = el("cmpA"), sb = el("cmpB");
    if (sa) sa.addEventListener("change", function () { estado.compA = this.value; renderTendencias(); });
    if (sb) sb.addEventListener("change", function () { estado.compB = this.value; renderTendencias(); });
  }

  function chartBox(titulo, sub, svg) {
    return '<div class="chartbox"><h3>' + titulo + '</h3><div class="csub">' + sub + "</div>" + svg + "</div>";
  }

  // ---------- carga de ficheros ----------
  function aviso(msg, tipo) {
    var b = el("avisoCarga");
    b.style.display = "block";
    b.className = "aviso" + (tipo ? " " + tipo : "");
    b.innerHTML = msg;
  }

  function detectarYActualizar(filas, nombre) {
    if (!filas || !filas.length) { aviso("El fichero <strong>" + nombre + "</strong> está vacío o sólo tiene cabeceras.", "error"); return false; }
    var cols = Object.keys(filas[0]);
    var esOKR = cols.indexOf("Objetivo") !== -1 && cols.indexOf("KR") !== -1;
    if (esOKR) { estado.data.okrUnidades = filas; return "OKR_Unidades"; }
    var esUni = cols.indexOf("Unidad") !== -1 && cols.indexOf("PctAtendida") !== -1 || (cols.indexOf("Unidad") !== -1 && cols.indexOf("DemoraVI") !== -1);
    var esCMI = cols.indexOf("Codigo") !== -1 && cols.indexOf("Valor") !== -1;
    if (esCMI && !esUni) {
      var faltan = CMI_REQ.filter(function (c) { return cols.indexOf(c) === -1; });
      if (faltan.length) { aviso("Hoja CMI: faltan columnas obligatorias: <strong>" + faltan.join(", ") + "</strong>.", "error"); return false; }
      estado.data.cmi = filas;
      return "CMI";
    }
    if (esUni) {
      var faltanU = UNI_REQ.filter(function (c) { return cols.indexOf(c) === -1; });
      if (faltanU.length) { aviso("Hoja Unidades: faltan columnas obligatorias: <strong>" + faltanU.join(", ") + "</strong>.", "error"); return false; }
      var avisoCols = (estado.data.operativoCols || []).map(function (c) { return c.clave; }).filter(function (c) { return cols.indexOf(c) === -1; });
      estado.data.unidades = filas;
      if (avisoCols.length) aviso("Aviso: faltan columnas de indicadores y se mostrarán como sin dato: " + avisoCols.join(", "), null);
      return "Unidades";
    }
    aviso("No se reconoce la estructura de <strong>" + nombre + "</strong>. Usa la plantilla (hojas Unidades y CMI).", "error");
    return false;
  }

  function procesarXLSX(buf, nombre) {
    try {
      var wb = XLSX.read(buf, { type: "array" });
      var encontrado = [];
      var leeHoja = function (n) {
        var nom = wb.SheetNames.filter(function (s) { return s.toLowerCase() === n.toLowerCase(); })[0];
        if (!nom) return null;
        return XLSX.utils.sheet_to_json(wb.Sheets[nom], { defval: null, raw: true });
      };
      var uni = leeHoja("Unidades"), cmi = leeHoja("CMI"), okr = leeHoja("OKR_Unidades");
      if (uni) { var r1 = detectarYActualizar(uni, "Unidades"); if (r1) encontrado.push(r1); }
      if (cmi) { var r2 = detectarYActualizar(cmi, "CMI"); if (r2) encontrado.push(r2); }
      if (okr && okr.length) { estado.data.okrUnidades = okr; encontrado.push("OKR_Unidades"); }
      if (!uni && !cmi) {
        // intentar primera hoja como genérica
        var first = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
        var r = detectarYActualizar(first, nombre);
        if (r) encontrado.push(r);
      }
      if (encontrado.length) finCarga(nombre, encontrado);
    } catch (err) {
      aviso("No se pudo leer el Excel <strong>" + nombre + "</strong>: " + err.message, "error");
    }
  }

  function parseCSV(texto) {
    texto = texto.replace(/^﻿/, "");
    // detectar delimitador
    var primera = texto.split(/\r?\n/)[0] || "";
    var delim = (primera.split(";").length > primera.split(",").length) ? ";" : ",";
    var filas = [], campo = "", fila = [], enComillas = false;
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i];
      if (enComillas) {
        if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else enComillas = false; }
        else campo += ch;
      } else {
        if (ch === '"') enComillas = true;
        else if (ch === delim) { fila.push(campo); campo = ""; }
        else if (ch === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
        else if (ch === "\r") { /* ignora */ }
        else campo += ch;
      }
    }
    if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
    if (!filas.length) return [];
    var cab = filas[0].map(function (h) { return h.trim(); });
    var out = [];
    for (var r = 1; r < filas.length; r++) {
      if (filas[r].length === 1 && filas[r][0].trim() === "") continue;
      var obj = {};
      for (var c = 0; c < cab.length; c++) obj[cab[c]] = filas[r][c] !== undefined ? filas[r][c].trim() : null;
      out.push(obj);
    }
    return out;
  }

  function procesarCSV(texto, nombre) {
    var filas = parseCSV(texto);
    var r = detectarYActualizar(filas, nombre);
    if (r) finCarga(nombre, [r]);
  }

  function finCarga(nombre, capas) {
    estado.periodoSel = null; // se recalcula al más reciente
    render();
    aviso("Cargado <strong>" + nombre + "</strong> · capas actualizadas: " + capas.join(", ") +
      ". Periodos disponibles: " + estado.periodos.join(", ") + ".", "ok");
  }

  // ---------- lectura de PDF (informe de actividad por centro) ----------
  var MESES_NOMBRE = {
    enero: "Ene", febrero: "Feb", marzo: "Mar", abril: "Abr", mayo: "May", junio: "Jun",
    julio: "Jul", agosto: "Ago", septiembre: "Sep", setiembre: "Sep", octubre: "Oct",
    noviembre: "Nov", diciembre: "Dic"
  };

  function parseIntES(s) {
    if (s === null || s === undefined) return null;
    var n = parseInt(String(s).replace(/\./g, "").replace(/\s/g, ""), 10);
    return isNaN(n) ? null : n;
  }

  function mapaCodigos() {
    var map = {};
    [DATOS_PRECARGADOS.unidades, estado.data.unidades].forEach(function (arr) {
      (arr || []).forEach(function (u) { if (u.Codigo) map[String(u.Codigo).trim()] = u.Unidad; });
    });
    return map;
  }

  function tituloCaso(s) {
    return String(s || "").toLowerCase().replace(/(^|\s)(\S)/g, function (_, sp, c) { return sp + c.toUpperCase(); }).trim();
  }

  function periodoDePDF(texto) {
    var anio = (texto.match(/A[ÑN]O\s+(\d{4})/i) || [])[1];
    var mesM = (texto.match(/ACUMULADO\s+([A-Za-zÁÉÍÓÚáéíóú]+)/i) || [])[1];
    var ab = mesM ? (MESES_NOMBRE[mesM.toLowerCase()] || mesM.slice(0, 3)) : null;
    if (ab && anio) return ab + "-" + anio;
    if (anio) return anio;
    return "PDF";
  }

  // pura y testeable: del texto del PDF -> {periodo, filas:[{Codigo,Unidad,...actividad}]}
  function parsearActividad(texto) {
    var periodo = periodoDePDF(texto);
    var lineas = texto.split(/\n+/);
    var reCentro = /CENTRO\s+(\d{6,8})\s*-\s*(?:C\.?\s*S\.?\s*)?(.+?)\s*$/i;
    var filas = [], cur = null;
    lineas.forEach(function (ln) {
      var m = ln.match(reCentro);
      if (m) {
        if (cur) filas.push(cur);
        var nombre = mapaCodigos()[m[1]] || tituloCaso(m[2]);
        cur = { Codigo: m[1], Unidad: nombre, PendientesVI: null, SesionesIndiv: null, ConsultasVI: null };
        return;
      }
      if (!cur) return;
      var num = (ln.match(/([\d.]+)\s*$/) || [])[1];
      if (num === undefined) return;
      if (/pendientes de consulta de valoraci/i.test(ln)) cur.PendientesVI = parseIntES(num);
      else if (/sesiones individuales/i.test(ln)) cur.SesionesIndiv = parseIntES(num);
      else if (/consultas de valoraci.*realizadas/i.test(ln)) cur.ConsultasVI = parseIntES(num);
    });
    if (cur) filas.push(cur);
    return { periodo: periodo, filas: filas };
  }

  function fusionarActividad(periodo, filas) {
    filas.forEach(function (f) {
      var rec = estado.data.unidades.filter(function (u) {
        return u.Periodo === periodo && (u.Codigo === f.Codigo || u.Unidad === f.Unidad);
      })[0];
      if (!rec) { rec = { Periodo: periodo, Unidad: f.Unidad, Codigo: f.Codigo }; estado.data.unidades.push(rec); }
      if (f.PendientesVI !== null) rec.PendientesVI = f.PendientesVI;
      if (f.SesionesIndiv !== null) rec.SesionesIndiv = f.SesionesIndiv;
      if (f.ConsultasVI !== null) rec.ConsultasVI = f.ConsultasVI;
    });
  }

  // reconstruye líneas a partir de los items posicionados de pdf.js
  function lineasDeTexto(tc) {
    var items = (tc.items || []).map(function (it) {
      return { s: it.str, x: it.transform[4], y: it.transform[5] };
    });
    items.sort(function (a, b) { if (Math.abs(a.y - b.y) > 2) return b.y - a.y; return a.x - b.x; });
    var lineas = [], buf = [], curY = null;
    items.forEach(function (it) {
      if (curY !== null && Math.abs(it.y - curY) > 2) { lineas.push(buf.join(" ")); buf = []; }
      buf.push(it.s); curY = it.y;
    });
    if (buf.length) lineas.push(buf.join(" "));
    return lineas.join("\n");
  }

  function procesarPDF(buf, nombre) {
    if (typeof pdfjsLib === "undefined") { aviso("La lectura de PDF no está disponible en esta versión.", "error"); return; }
    try {
      if (window.__PDFWORKER_SRC__ && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        var blob = new Blob([window.__PDFWORKER_SRC__], { type: "application/javascript" });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      }
      aviso("Leyendo PDF <strong>" + nombre + "</strong>…", null);
      pdfjsLib.getDocument({ data: buf }).promise.then(function (doc) {
        var pags = [];
        for (var i = 1; i <= doc.numPages; i++) {
          pags.push(doc.getPage(i).then(function (pg) { return pg.getTextContent().then(lineasDeTexto); }));
        }
        return Promise.all(pags);
      }).then(function (parts) {
        var r = parsearActividad(parts.join("\n"));
        if (!r.filas.length) {
          aviso("No se reconocieron centros en <strong>" + nombre + "</strong>. ¿Es el informe de actividad por centro?", "error");
          return;
        }
        fusionarActividad(r.periodo, r.filas);
        estado.periodoSel = r.periodo;
        render();
        aviso("Cargado PDF <strong>" + nombre + "</strong> · " + r.filas.length + " centros · periodo " + r.periodo +
          ". Actividad añadida: pendientes VI, sesiones individuales y consultas VI.", "ok");
      }).catch(function (err) { aviso("No se pudo leer el PDF " + nombre + ": " + err.message, "error"); });
    } catch (err) { aviso("No se pudo leer el PDF " + nombre + ": " + err.message, "error"); }
  }

  function manejarFichero(file) {
    if (!file) return;
    var nombre = file.name, ext = nombre.split(".").pop().toLowerCase();
    var reader = new FileReader();
    if (ext === "xlsx" || ext === "xls") {
      reader.onload = function (e) { procesarXLSX(new Uint8Array(e.target.result), nombre); };
      reader.onerror = function () { aviso("No se pudo leer el fichero " + nombre, "error"); };
      reader.readAsArrayBuffer(file);
    } else if (ext === "csv" || ext === "txt") {
      reader.onload = function (e) { procesarCSV(e.target.result, nombre); };
      reader.onerror = function () { aviso("No se pudo leer el fichero " + nombre, "error"); };
      reader.readAsText(file, "UTF-8");
    } else if (ext === "pdf") {
      reader.onload = function (e) { procesarPDF(new Uint8Array(e.target.result), nombre); };
      reader.onerror = function () { aviso("No se pudo leer el fichero " + nombre, "error"); };
      reader.readAsArrayBuffer(file);
    } else {
      aviso("Formato no soportado: <strong>." + ext + "</strong>. Usa .xlsx, .csv o .pdf.", "error");
    }
  }

  // hook de pruebas (no afecta a la app)
  window.__test = { parsearActividad: parsearActividad, lineasDeTexto: lineasDeTexto };

  // ---------- tema (estética) ----------
  var TEMA_KEY = "cmd_fisio_tema";
  function aplicarTema(t) {
    if (t) document.body.setAttribute("data-tema", t);
    else document.body.removeAttribute("data-tema");
  }
  function initTema() {
    var guardado = "";
    try { guardado = window.localStorage.getItem(TEMA_KEY) || ""; } catch (e) { guardado = ""; }
    aplicarTema(guardado);
    var sel = el("temaSel");
    if (sel) {
      sel.value = guardado;
      sel.addEventListener("change", function () {
        aplicarTema(this.value);
        try { window.localStorage.setItem(TEMA_KEY, this.value); } catch (e) { /* file:// sin storage */ }
      });
    }
  }

  // ---------- inicialización ----------
  function init() {
    initTema();
    // pestañas (solo las del nav principal, que tienen data-panel)
    Array.prototype.forEach.call(document.querySelectorAll(".tabs .tab"), function (t) {
      t.addEventListener("click", function () { activarTab(t.getAttribute("data-panel")); });
    });
    el("periodoSel").addEventListener("change", function () { estado.periodoSel = this.value; render(); });
    var dSel = el("disenoSel");
    if (dSel) { dSel.value = estado.disenoCMI; dSel.addEventListener("change", function () { estado.disenoCMI = this.value; renderCMI(); }); }
    Array.prototype.forEach.call(document.querySelectorAll("[data-vista]"), function (b) {
      b.addEventListener("click", function () {
        estado.vistaUnidad = b.getAttribute("data-vista");
        document.querySelectorAll("[data-vista]").forEach(function (x) { x.classList.toggle("activa", x === b); });
        renderOperativa();
      });
    });
    // botón único de configuración (panel desplegable)
    var btnCfg = el("btnConfig"), panel = el("configPanel");
    function abrirCfg(abrir) {
      panel.hidden = !abrir;
      btnCfg.setAttribute("aria-expanded", abrir ? "true" : "false");
    }
    if (btnCfg && panel) {
      btnCfg.addEventListener("click", function (e) { e.stopPropagation(); abrirCfg(panel.hidden); });
      panel.addEventListener("click", function (e) { e.stopPropagation(); });
      document.addEventListener("click", function () { if (!panel.hidden) abrirCfg(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) abrirCfg(false); });
    }

    el("btnCargar").addEventListener("click", function () { el("fileInput").click(); });
    el("fileInput").addEventListener("change", function () {
      Array.prototype.forEach.call(this.files, manejarFichero);
      this.value = "";
    });
    el("btnImprimir").addEventListener("click", function () { window.print(); });

    var dz = document.body;
    ["dragover", "dragenter"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); el("dropHint").classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); el("dropHint").classList.remove("over"); });
    });
    dz.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) Array.prototype.forEach.call(e.dataTransfer.files, manejarFichero);
    });

    // Fichas explicativas del CMI: abrir/cerrar el modal por delegación de eventos
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-ficha]") : null;
      if (btn) { e.preventDefault(); e.stopPropagation(); abrirFicha(btn.getAttribute("data-ficha")); return; }
      if (e.target.closest && e.target.closest("[data-close]")) cerrarFicha();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarFicha(); });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
