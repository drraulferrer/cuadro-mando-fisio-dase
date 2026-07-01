"""Ensambla el cuadro de mando en un único HTML autocontenido.

Inyecta en index.src.html: SheetJS (vendor), CSS, datos precargados (data.json)
y la lógica (app.js). Salida: ../cuadro-mando-fisio-dase.html
"""
import os, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VENDOR = os.path.join(ROOT, "vendor", "xlsx.full.min.js")
PDFJS = os.path.join(ROOT, "vendor", "pdf.min.js")
PDFWORKER = os.path.join(ROOT, "vendor", "pdf.worker.min.js")


def leer(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def main():
    # asegurar datos al día
    import data_source
    data_source.write_json(os.path.join(HERE, "data.json"))

    src = leer(os.path.join(HERE, "index.src.html"))
    fonts_path = os.path.join(HERE, "fonts.css")
    fonts_css = (leer(fonts_path) + "\n") if os.path.exists(fonts_path) else ""
    css = fonts_css + leer(os.path.join(HERE, "styles.css"))
    app = leer(os.path.join(HERE, "app.js"))
    data = leer(os.path.join(HERE, "data.json"))
    sheetjs = leer(VENDOR) if os.path.exists(VENDOR) else "/* SheetJS no disponible: sólo CSV */"
    pdfjs = leer(PDFJS) if os.path.exists(PDFJS) else "/* pdf.js no disponible: sin lectura de PDF */"
    # worker de pdf.js embebido como literal de cadena JS (Blob -> workerSrc, todo offline)
    if os.path.exists(PDFWORKER):
        worker_literal = json.dumps(leer(PDFWORKER)).replace("</", "<\\/")
    else:
        worker_literal = '""'

    # Reemplazos seguros (no usar str.format por las llaves de JS/CSS)
    out = src.replace("/*__CSS__*/", css)
    out = out.replace("/*__SHEETJS__*/", sheetjs)
    out = out.replace("/*__PDFJS__*/", pdfjs)
    out = out.replace("/*__PDFWORKER__*/", worker_literal)
    out = out.replace("/*__DATA__*/", data.strip())
    out = out.replace("/*__APP__*/", app)

    destino = os.path.join(ROOT, "cuadro-mando-fisio-dase.html")
    with open(destino, "w", encoding="utf-8") as f:
        f.write(out)
    print("OK ->", destino, "(%.0f KB)" % (len(out) / 1024))


if __name__ == "__main__":
    main()
