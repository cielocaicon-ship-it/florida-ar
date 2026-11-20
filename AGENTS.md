# AGENTS.md — florida-ar

Instrucciones para cualquier agente de IA (Claude, Codex, Cursor, Copilot, Gemini…) y para las personas que trabajen en este proyecto.

## Antes de empezar
1. Lee la sección **Estado actual** de [`CONTEXTO.md`](CONTEXTO.md). Lee el resto solo si tu tarea lo necesita.
2. Respeta las **Convenciones** y **Decisiones** registradas allí. Si tu cambio contradice una decisión, dilo antes de hacerlo.

## Comandos
- Previsualizar: abrir `index.html` con Live Preview o `npx serve .`

## Al terminar un bloque de trabajo
Actualiza `CONTEXTO.md` editando secciones puntuales (no lo reescribas entero):
1. **Estado actual** (máx. 8 viñetas): qué funciona, qué está en curso, siguiente paso, bloqueos.
2. **Bitácora**: entrada nueva ARRIBA con el formato `### AAAA-MM-DD · vX.Y.Z · <autor o herramienta>` y 3–6 viñetas: qué cambió, por qué y archivos clave.
3. **Decisiones**: una fila por decisión de arquitectura, diseño o dependencias, con el porqué y la alternativa descartada.
4. **Pendientes** y **Problemas conocidos**: marca lo resuelto y añade lo nuevo.
5. Si cambiaste stack, comandos o estructura, actualiza esas secciones.

Reglas: solo hechos verificables, sin relleno; nunca escribas secretos ni valores de `.env`; la bitácora conserva las últimas entradas y las antiguas viven en `.hilo/historial.md`.
