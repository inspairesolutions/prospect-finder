# Web analyzer (Python)

Usado por `POST /api/prospects/[id]/analyze` en la app Next.js.

## Requisitos

- Python 3.10+
- Dependencias en `requirements.txt` (incluye Playwright)

## Instalación local

```bash
cd web-analyzer
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/playwright install chromium
```

El script `./analyze` usa el `venv` si existe; si no, `python3` del sistema.

## Configuración

En la raíz del proyecto, variable opcional (por defecto `./web-analyzer`):

`WEB_ANALYZER_PATH=/ruta/absoluta/al/analyzer`

## Arquitectura

```
Next.js API route  →  exec: web-analyzer/analyze <url> --json --no-link-check
                     →  stdout (JSON)  →  Prisma (webAnalysis, …)
```
