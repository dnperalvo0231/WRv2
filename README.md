# Dashboard semanal · Campo Singue (Gente Oil Ecuador)

Página web vertical, interactiva y a color que resume el *Weekly Operation Report* a partir del Excel semanal.
Se publica gratis con **GitHub Pages**; no necesita servidor ni base de datos.

```
index.html                       versión vertical (fondo de color)
horizontal.html                  versión horizontal blanca, 2 pestañas (estilo reporte A4)
assets/style.css · app.js        diseño y gráficos de la versión vertical
assets/horizontal.css · .js      diseño y gráficos de la versión horizontal
data/data.js · data.json         datos generados desde el Excel (no editar a mano)
data/manual/                     semanas cargadas a mano (la del PDF de Power BI)
data/notes.json                  texto de "Novedades de la semana"
scripts/excel_to_json.py         convierte el Excel en datos
excel/                           aquí se sube el Excel de cada semana
img/                             aquí van los gráficos BMP de OFM
.github/workflows/               automatiza la actualización
```

## 1. Publicar (una sola vez, ~5 min)
1. En GitHub: **New repository** (por ejemplo `singue-dashboard`). Si el reporte es interno, usa un repositorio **privado** (GitHub Pages privado requiere plan de pago; en plan gratis el sitio es público, así que no subas datos confidenciales).
2. **Add file → Upload files** y arrastra todo el contenido de esta carpeta (incluida `.github`).
3. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/singue-dashboard/`.

## 2. Rutina semanal
1. Sube el nuevo Excel a la carpeta `excel/` (Add file → Upload files).
2. La acción **Actualizar dashboard** (pestaña *Actions*) lo lee y actualiza `data/`. Tarda ~1 min.
3. Sube los gráficos de OFM a `img/` con los nombres de `img/LEEME.txt`.
4. Recarga la página. El selector de arriba muestra todas las semanas acumuladas.

Sin GitHub Actions también funciona en tu PC: `pip install -r requirements.txt` y
`python scripts/excel_to_json.py "excel/WOR 231026-291026.xlsx" data/data.json`.
Para ver la página en local, abre `index.html` (necesita internet para cargar Chart.js).

## 2b. Versión horizontal (`horizontal.html`)
Fondo blanco, basada en el reporte A4 y dividida en dos pestañas (la URL recuerda la pestaña: `#produccion` / `#operaciones`):
1. **Producción y cumplimiento:** tabla diaria, indicadores (incluye *Fulfillment* = promedio del mes vs plan), serie diaria 2026, forecast con % de cumplimiento, pérdidas y gráfico OFM de producción.
2. **Instalaciones, pozos y novedades:** agua, gas combustible, entrega, run life y novedades de pozos y campo, más los gráficos OFM de presión y transferencia.

Selector de semana arriba, botón **Imprimir** (cada pestaña sale en una hoja A4 horizontal) y enlace a la versión vertical. Los colores se editan al inicio de `assets/horizontal.css`.
Los recuadros "HSE, Phys. Security, Facilities, Geosciences, Drilling" se llenan en `data/notes.json` con la clave `areas` de la semana.
Los textos de cada sección (agua, gas, entrega, levantamiento, pérdidas) van en `comments` de la misma semana en `data/notes.json`.

## 3. Qué lee del Excel
Hojas y rangos fijos; si cambias el formato del Excel, avisa para ajustar el script.

| Hoja | Se usa para |
|---|---|
| Production and Pumping | filas 5–11 (semana) y bloques "Monthly" (serie diaria 2026) |
| FORECAST | real vs plan mensual, cumplimiento |
| RLD | run life por pozo, objetivo, % upthrust/en rango (celdas E25:E27) |
| BSW | agua inyectada y presión de A10/A11, ppm SST y aceite |
| GAS | combustible, producido y quemado |
| Produccion Losses | pérdidas con fecha dentro de la semana |

**Datos manuales** (arriba de `scripts/excel_to_json.py`): `UPTHRUST` (pozos en upthrust) y `SHUTDOWN` (pozos apagados) no están en el Excel como lista; edítalos cuando cambien.
**Novedades**: se escriben en `data/notes.json` con la clave `AAAA-MM-DD_AAAA-MM-DD` de la semana.

## 4. Colores y marca
Edita las variables al inicio de `assets/style.css` (`--bg1`, `--bg2`, `--bg3`, `--accent`…).
Si agregas `img/logo.png`, aparece en el encabezado.
