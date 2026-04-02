# Asset Catalog — Referencias Visuales Globales

Catalogo de assets reutilizables para generacion de imagenes de video.
Todos los archivos viven en `contenido-videos/assets/`.

**Ruta base:** `/Users/danielcarreon/Developer/software/business-os/contenido-videos/assets`

## Logos

Logos de herramientas y marcas que aparecen frecuentemente en videos.
Usar con `--refs` cuando la imagen necesite representar una herramienta especifica.

| Asset | Archivo | Usar cuando... |
|-------|---------|----------------|
| Antigravity | `logos/antigravity.png` | El video menciona Antigravity, Google AI, o la herramienta de deployment |
| Claude Code | `logos/claude-code.png` | El video menciona Claude Code, Anthropic, o el agente de terminal |

**Como usarlos:**
```bash
npx tsx scripts/generate-image.ts \
  --prompt "PROMPT" \
  --refs /Users/danielcarreon/Developer/software/business-os/contenido-videos/assets/logos/antigravity.png \
  --output /ruta/generadas/XX-nombre.png \
  --aspect 16:9
```

Se pueden combinar multiples logos como referencia (hasta 10):
```bash
--refs .../assets/logos/antigravity.png .../assets/logos/claude-code.png
```

## Daniel — Sistema de Avatar 2D

Assets 2D de Daniel generados y aprobados (Mar 14, 2026). Dos modos de uso:
**Modo 1 (Default):** Asset pre-generado como `--refs` → el modelo COPIA el estilo.
**Modo 2:** Foto original como `--refs` + estilo descrito en prompt → mas flexible para expresiones.

| Asset | Archivo | Estilo | Usar cuando... |
|-------|---------|--------|----------------|
| Foto original | `daniel/cuello-tortuga.png` | Foto real | Modo 2: referencia facial para generacion dinamica |
| **Default** | `daniel/2d-style-sketchnote.png` | Sketchnote, barba ligera, pelo claro, mas joven/accesible | **70% de casos:** Daniel en infografias, presentando conceptos |
| Barba cerrada | `daniel/2d-bust.png` | Sketchnote, marcador grueso, lapiz de color, barba cerrada densa | Cuando Daniel debe verse mas maduro/serio |
| Tinta + acuarela | `daniel/2d-style-tinta-acuarela.png` | Tinta china fina + lavados acuarela, barba cerrada | Estilo premium/editorial, presentaciones elegantes |

### Pipeline: Avatar Pre-generado (Modo 1, Default)

1. Pasar `2d-style-sketchnote.png` + `cuello-tortuga.png` como `--refs`
2. En el prompt: `"personaje Daniel EXACTAMENTE como la ilustracion 2D de referencia (pelo castaño oscuro, barba ligera, cuello tortuga negro)"`
3. Describir EXPRESION FACIAL especifica al contexto
4. Indicar POSICION y DIRECCION de la mano

### Pipeline: Generacion Dinamica (Modo 2)

1. Pasar solo `cuello-tortuga.png` como `--refs`
2. Describir rasgos completos + estilo deseado en el prompt
3. Mas flexible para expresiones y poses unicas

### Cuando NO usar la referencia de Daniel

- Personajes genericos (estudiantes, developers) — dejarlos como doodles sin referencia
- Imagenes puramente conceptuales sin personas
- Cuando Daniel explicitamente pida NO aparecer

## Agentes AI — Levy, Trinity, Sensei

Assets de los 3 agentes AI de SaaS Factory. Usar cuando la imagen necesite representar a los agentes como personajes.

| Asset | Archivo | Descripcion | Usar cuando... |
|-------|---------|-------------|----------------|
| **Levy** | `agents/levy-sf.png` | Robot AI morado-azul, chip SF en la frente, ojos brillantes | Levy aparece como personaje: estrategia, bienvenida, motivacion |
| **Sensei** | `agents/sensei.png` | Agente tecnico/maestro | Sensei aparece: arquitectura, codigo, debugging, enseñanza tecnica |
| **Trinity** | `agents/trinity.png` | Agente de soporte | Trinity aparece: soporte, navegacion, pagos, onboarding |

### Como Incluir Agentes en Imagenes

1. Pasar el asset del agente como `--refs`
2. En el prompt describir como personaje doodle basado en la referencia
3. Describir POSE y CONTEXTO especifico

**Ejemplos de prompt:**

- Levy: `"personaje robot AI estilo doodle basado en la referencia (cabeza metalica azul-morada, chip SF en la frente, ojos brillantes), señalando con confianza hacia..."`
- Sensei: `"personaje agente tecnico estilo doodle basado en la referencia, explicando un diagrama de arquitectura con..."`
- Trinity: `"personaje agente de soporte estilo doodle basado en la referencia, ayudando a un usuario con..."`

**Multiples agentes en una imagen:**
```bash
--refs .../assets/agents/levy-sf.png .../assets/agents/sensei.png .../assets/agents/trinity.png
```

### Cuando Incluir Agentes

| Incluir (SI) | Excluir (NO) |
|--------------|--------------|
| Presentando el ecosistema de agentes | Diagramas tecnicos puros |
| Comparando roles (quien hace que) | Listas de features sin contexto |
| Interaccion agente-usuario | Conceptos abstractos sin personajes |
| Explicando como funciona el soporte AI | Timelines o flujos de sistema |

### Reglas de Posicionamiento (mismas que Daniel)
- Agente va a la IZQUIERDA cuando señala contenido a la DERECHA
- Agente va a la DERECHA cuando mira/señala contenido a la IZQUIERDA
- NUNCA poner al agente en el centro bloqueando el contenido principal
- Si hay multiples agentes, distribuirlos sin superposicion

## Estilos

Imagenes de ejemplo que definen el estilo visual deseado. Utiles como `--refs`
cuando el modelo necesite un recordatorio del estilo sketchnote correcto.

| Asset | Archivo | Descripcion |
|-------|---------|-------------|
| (por agregar) | `styles/sketchnote-example.png` | Ejemplo del estilo sketchnote deseado |

## Reglas de Uso

1. **Assets globales vs proyecto:** Si un logo/recurso se usara en MULTIPLES videos, va en `assets/`. Si es exclusivo de un video, va en `proyectos/YYYY-MM-DD-xxx/referencias/`.

2. **Siempre `--refs`, nunca `--image`:** Los assets de referencia se pasan con `--refs` (el modelo los usa como guia visual). `--image` es para EDITAR una imagen existente (transformarla directamente).

3. **Combinar referencias:** Se pueden pasar multiples refs. Ejemplo: logo + foto de Daniel + ejemplo de estilo = el modelo entiende el contexto completo.

4. **Actualizar este catalogo:** Cada vez que se agregue un asset nuevo a `contenido-videos/assets/`, agregar su entrada aqui con archivo, descripcion y regla de uso.
