# Publicar Carousel en SaaS Factory Classroom

Referencia para el Paso 2 del pipeline video-visuals: tomar imagenes ya generadas
en `contenido-videos/proyectos/` y publicarlas como carousel dentro de una leccion
del curso "Claude Code Skills" en SaaS Factory Community.

## Cuando usar esto

Daniel dira algo como:
- "publica el carousel"
- "sube las imagenes al curso"
- "crea la leccion con las imagenes"
- "genera el carousel en claude code skills"

Solo ejecutar DESPUES de que las imagenes ya existan en `generadas/`.

## Credenciales

```bash
# Leer de claudeclaw/.env
SF_SUPABASE_URL=https://pzguhreaiadchdxdvauz.supabase.co
SF_SUPABASE_KEY=<service_role key from claudeclaw/.env>
```

## Curso destino

| Campo | Valor |
|-------|-------|
| Curso | Claude Code Skills |
| course_id | `42603ce4-ee1c-46a7-94f4-affc65a0c2ea` |
| Bucket | `post-attachments` |
| Path prefix | `carousel/<nombre-proyecto>/` |

## Pipeline paso a paso

### 1. Subir PNGs al bucket post-attachments

```bash
SF_URL="https://pzguhreaiadchdxdvauz.supabase.co"
SF_KEY="<service_role_key>"
BUCKET="post-attachments"
PROJECT="nombre-del-proyecto"  # ej: claude-code-skills
IMG_DIR="contenido-videos/proyectos/YYYY-MM-DD-titulo/generadas"

for img in $(ls "$IMG_DIR"/*.png | sort); do
  FILENAME=$(basename "$img")
  curl -s -X POST "$SF_URL/storage/v1/object/$BUCKET/carousel/$PROJECT/$FILENAME" \
    -H "Authorization: Bearer $SF_KEY" \
    -H "Content-Type: image/png" \
    -H "x-upsert: true" \
    --data-binary "@$img"
done
```

Las URLs publicas seran:
```
$SF_URL/storage/v1/object/public/post-attachments/carousel/$PROJECT/$FILENAME
```

### 2. Construir HTML del carousel TipTap

El carousel es un nodo TipTap con esta estructura HTML:

```html
<div data-type="carousel" data-images="[IMAGES_JSON_ESCAPED]" data-size="large"></div>
```

Donde `IMAGES_JSON_ESCAPED` es un JSON array de URLs con comillas escapadas como `&quot;`.

Ejemplo:
```html
<div data-type="carousel" data-images="[&quot;https://...01.png&quot;,&quot;https://...02.png&quot;]" data-size="large"></div>
```

Tamanos disponibles: `small` (max-w-md), `medium` (max-w-2xl), `large` (w-full).
Para imagenes de video siempre usar `large`.

### 3. Crear la leccion via REST API

Usar Python para manejar el JSON escaping correctamente:

```python
import json, urllib.request, ssl

images = [
    "https://...supabase.co/.../01-nombre.png",
    "https://...supabase.co/.../02-nombre.png",
    # ... todas las imagenes en orden
]

images_json = json.dumps(images)
images_escaped = images_json.replace('"', '&quot;')
content = f'<div data-type="carousel" data-images="{images_escaped}" data-size="large"></div>'

payload = json.dumps({
    "course_id": "42603ce4-ee1c-46a7-94f4-affc65a0c2ea",
    "title": "Titulo del Video",
    "content": content,
    "published": True,
    "order_position": 0,  # ajustar segun lecciones existentes
})

req = urllib.request.Request(
    f"{SF_URL}/rest/v1/lessons",
    data=payload.encode(),
    headers={
        "apikey": SF_KEY,
        "Authorization": f"Bearer {SF_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
    method="POST",
)
ctx = ssl.create_default_context()
resp = urllib.request.urlopen(req, context=ctx)
lesson = json.loads(resp.read().decode())
print(f"Lesson created: {lesson[0]['id']}")
```

### 4. Agregar video embed (opcional, paso siguiente)

Si Daniel quiere vincular el video de YouTube a la leccion:

```python
# Despues de crear la leccion, actualizar con video_embed_url
import json, urllib.request, ssl

lesson_id = "ID_DE_LA_LECCION"
video_url = "https://www.youtube.com/watch?v=VIDEO_ID"

payload = json.dumps({"video_embed_url": video_url})

req = urllib.request.Request(
    f"{SF_URL}/rest/v1/lessons?id=eq.{lesson_id}",
    data=payload.encode(),
    headers={
        "apikey": SF_KEY,
        "Authorization": f"Bearer {SF_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
    method="PATCH",
)
ctx = ssl.create_default_context()
resp = urllib.request.urlopen(req, context=ctx)
print(resp.read().decode())
```

El video se embebera automaticamente encima del contenido de la leccion.
Formatos soportados: YouTube, Loom, Vimeo.

## Convenciones de naming

| Campo | Formato | Ejemplo |
|-------|---------|---------|
| Bucket path | `carousel/<slug-proyecto>/` | `carousel/claude-code-skills/` |
| Titulo leccion | Titulo del video en espanol | "Claude Code Skills - Introduccion" |
| Imagenes | Orden numerico `01-nombre.png` | Mismo nombre que en `generadas/` |

## CRITICO: El content es HTML, NUNCA TipTap JSON

El campo `lessons.content` almacena **HTML plano**, NO JSON de TipTap.

**CORRECTO:**
```html
<div data-type="carousel" data-images="[&quot;https://...&quot;]" data-size="large"></div>
```

**INCORRECTO (NUNCA hacer esto):**
```json
{"type": "doc", "content": [{"type": "carousel", "attrs": {"images": [...]}}]}
```

Si guardas JSON stringificado, TipTap lo renderiza como texto plano en la UI.
El parseHTML del CarouselExtension busca `<div data-type="carousel">` en el HTML.

## Notas

- Las imagenes NO se comprimen al subir via curl (solo el frontend comprime via `uploadPostAttachment`)
- El bucket `post-attachments` ya es publico, no requiere auth para leer
- El curso "Claude Code Skills" esta en draft (`published: false`), las lecciones individuales pueden ser `published: true`
- Para obtener el `order_position` correcto, consultar lecciones existentes primero
- Si la leccion ya existe, usar PATCH en lugar de POST para actualizar el content
- El upload path puede ser `{userId}/{timestamp}-{name}` o `carousel/{project}/{name}` — ambos funcionan
