# Vincular Video de YouTube a Leccion

Referencia para agregar el video embed a una leccion existente en el curso
"Claude Code Skills" de SaaS Factory Community.

## Cuando usar esto

Daniel dira algo como:
- "ya subi el video, aqui esta el link: https://youtube.com/watch?v=..."
- "agrega el video a la leccion"
- "vincula este video"
- "ponle el video de youtube"

Solo ejecutar DESPUES de que la leccion ya exista (creada con el carousel).

## Credenciales

```bash
# Leer de claudeclaw/.env
SF_SUPABASE_URL=https://pzguhreaiadchdxdvauz.supabase.co
SF_SUPABASE_KEY=<service_role key from claudeclaw/.env>
```

## Pipeline

### 1. Buscar la leccion existente

```python
import json, urllib.request, ssl

SF_URL = "https://pzguhreaiadchdxdvauz.supabase.co"
SF_KEY = "<service_role_key>"

req = urllib.request.Request(
    f"{SF_URL}/rest/v1/lessons?course_id=eq.42603ce4-ee1c-46a7-94f4-affc65a0c2ea&select=id,title,video_embed_url&order=order_position",
    headers={
        "apikey": SF_KEY,
        "Authorization": f"Bearer {SF_KEY}",
    },
)
ctx = ssl.create_default_context()
resp = urllib.request.urlopen(req, context=ctx)
lessons = json.loads(resp.read().decode())
print(json.dumps(lessons, indent=2))
```

Identificar la leccion correcta por titulo.

### 2. Actualizar con video_embed_url

```python
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

## Como se renderiza

El video aparece ENCIMA del carousel en la leccion. El frontend auto-detecta
la plataforma y convierte a embed URL:

| Plataforma | Input | Embed |
|-----------|-------|-------|
| YouTube | `youtube.com/watch?v=ID` | `youtube.com/embed/ID` |
| YouTube | `youtu.be/ID` | `youtube.com/embed/ID` |
| Loom | `loom.com/share/ID` | `loom.com/embed/ID` |
| Vimeo | `vimeo.com/ID` | `player.vimeo.com/video/ID` |

El iframe se renderiza en 16:9 responsive con bordes redondeados y efecto glow morado.

## Notas

- Solo se soporta UN video por leccion (campo `video_embed_url` es singular)
- Si la leccion ya tiene video, el PATCH lo reemplaza
- El video se puede agregar en cualquier momento, no necesita existir al crear la leccion
