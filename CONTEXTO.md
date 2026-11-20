# CONTEXTO — carolina-ar (antes florida-ar)

> Memoria viva del proyecto para personas e IAs: qué es, cómo va, qué se decidió y qué sigue.
> Última actualización: 2026-11-20 13:38 · rama main · commit c5c94fe · sin versión
> Cómo mantenerlo: AGENTS.md → «Al terminar un bloque de trabajo».

<!-- hilo:estado:inicio -->
## Estado actual
- **Qué es:** juego web de realidad aumentada para una feria universitaria sobre **Carolina del Norte** (antes Florida): un cofre abre 7 minijuegos arcade y cada uno da 1 estrella.
- **Fase:** cambio de estado terminado (2026-11-20). Misma mecánica de la versión de Florida (1.4.3, con el arreglo de `ctx.pop`), con mundos, textos, colores y datos de Carolina del Norte.
- **Idioma:** inglés al abrir (siempre), español opcional con el selector de la intro o en ⚙️ (`i18n.js`).
- **Los 7 juegos:** ✈️ Kitty Hawk · Primer vuelo de los hermanos Wright (reemplazó al duelo de magos; solo celular, no está en el menú del Quest) · 🤖 Research Triangle · drones (oleadas y jefe) · 🏙️ Charlotte (5 íconos en 60 s) · 🚤 Outer Banks (tour en lancha, 5 paradas) · 🏀 Charlotte Hornets · 🏈 Carolina Panthers (gol de campo) · ⚽ Charlotte FC (penales).
- **Claves internas sin cambiar** (para no romper `xr.js`, récords ni el modo pies): `orlando` = Kitty Hawk (primer vuelo), `heroes` = Research Triangle, `city` = Charlotte, `miami` = Outer Banks, `heat` = Hornets, `fg` = Panthers, `penalty` = Charlotte FC.
- **Verificado:** sintaxis de todos los .js; en Chrome automático (iPhone emulado, SwiftShader) los 7 juegos cargan sin errores, con sus tarjetas, y se revisaron capturas de los faros, el monumento Wright, el barco pirata, las postales y Uptown Charlotte.
- **Sin probar:** iPhone real, Quest real, mano y pie (MediaPipe no carga en el entorno de prueba).
- **Siguiente paso:** probar en el celular el tour (2 minutos, 5 preguntas) y los demás juegos.
<!-- hilo:estado:fin -->

## 1. Propósito y alcance
- **Problema / para quién:** proyecto de Cielo (Ingeniería Multimedia, Universidad Simón Bolívar, Cúcuta) para mostrar en una feria: visitantes que juegan 1–3 minutos por minijuego con su celular. Prioridad: iPhone 15 Pro Max con Safari.
- **Incluye:** intro «Welcome to Florida!», cofre con 7 portales (Orlando, Héroes, Miami urbano, tour acuático, Miami Heat, Touchdown NFL, Penales MLS), medallas y récords guardados en el celular, y el Modo Quest (en desarrollo).
- **No incluye (por ahora):** servidor ni cuentas (todo corre en el navegador); logos o diseños protegidos (Miami Heat, Harry Potter, Marvel, Thor, Capitán América); seguimiento del pie dentro del Quest.

## 2. Stack y entorno
| Capa | Tecnología | Versión | Nota |
|---|---|---|---|
| Base | HTML + CSS + JavaScript (sitio estático, módulos ES, sin compilación) | — | |
| 3D | Three.js (importmap desde jsDelivr) | 0.160.0 | FBXLoader y GLTFLoader para los modelos |
| Mano | MediaPipe Tasks Vision (HandLandmarker, desde jsDelivr) | 0.10.x | ver `VER` en `handTracking.js` |
| Cuerpo (sensor de pies) | MediaPipe Tasks Vision · PoseLandmarker lite (desde jsDelivr) | 0.10.14 | solo en `sensor.html`, en la PC |
| Conexión PC ↔ visor | PeerJS (WebRTC; su servidor público solo presenta a los dos por el código) | 1.5.4 | `FEET.PEER` en `xr.js` y `PEER` en `sensor.js` |
| Fuentes | Google Fonts: Press Start 2P y Baloo 2 | — | |

| Acción | Comando |
|---|---|
| Previsualizar | abrir `index.html` con Live Preview o `npx serve .` (la cámara exige HTTPS o localhost) |
| Modo depuración | añadir `?debug` a la URL (expone `window.__fl`) |

- **Entorno:** navegador móvil con HTTPS (cámara, giroscopio y Wake Lock). No hay dependencias que instalar.
- **Despliegue:** GitHub Pages desde `cielocaicon-ship-it/florida-ar` (rama main) → https://cielocaicon-ship-it.github.io/florida-ar/. La versión de Florida sigue en `colmenaressan27/florida-ar`.

## 3. Mapa del código
<!-- Solo lo que no es obvio: dónde vive cada pieza importante y cómo se conectan. -->
```text
index.html          pantallas (intro, cámara, controles, menú ⚙️, tarjetas) e importmap de Three.js
CSS/style.css       estilo «arcade tropical» (tokens, botones, intro, HUD, recuadro de cámara)
game.js             punto de entrada: escena 3D, puntero unificado (táctil, ratón, índice), giroscopio, sonidos, capa arcade, modo pie y bucle principal
scenes.js           cofre (hub), Orlando (duelo por gestos), Miami Heat y utilidades 3D compartidas; catálogo GAMES
scenes2.js          Miami urbano, Isla de Héroes, fútbol americano, penales y tour acuático; catálogo GAMES2 (tiene prioridad sobre GAMES)
models.js           carga y ajuste de los 14 FBX de assets/modelos/ (TEXTURAS, SIN_USO)
footTracking.js     patada por movimiento con la cámara trasera (KICK)
handTracking.js     dedo índice con MediaPipe
sensor.html         sensor de pies en una PC aparte (MediaPipe Pose): detecta la patada y la envía al visor por PeerJS con código de 4 dígitos; el video no sale de la PC
sensor.js           lógica de sensor.html (detección de patada y conexión PeerJS)
xr.js               Modo Quest: sesión WebXR, manos, menú 3D, paneles canvas y confort (se conecta a game.js con ganchos)
gestures.js         reconocedor de figuras de Orlando: zigzag, línea y círculo (GEST)
assets/modelos/     FBX con nombres genéricos (los que usa el juego)
Modelos texturizados/  FBX originales de Cielo (no se usan en el juego; no subir: nombres de marcas)
JUEGO.md            biblia del juego: arte, game feel, decisiones de diseño
```

## 4. Convenciones
- Código, comentarios y textos en español. Los textos en fuente pixel van sin tildes (`pxText`), porque «Press Start 2P» no las trae.
- Cada minijuego es una función `(ctx, opt)` que devuelve `{ start, update, dispose, tap/onDown/onMove/onUp… }`; se registra en `GAMES`/`GAMES2` con `pix`, `tag`, `how` y `fact`.
- Los ajustes que Cielo puede tocar van en constantes con nombre al inicio de cada sección (`KICK`, `KICKCAM`, `FLOOR`, `GEST`, `DUEL`, `HZ`, `STY`, `POST_X`, `QUEST`, `XZ`, `XO`, `XH`, `XC`, `XW`, `SHORE`), con un comentario en español.
- En el visor, `spot.y` es la altura del piso donde estás parado; `gamePoint(dx, y, dz)` usa `y` sobre ese piso.
- Nada de recursos protegidos: modelos y texturas originales o dibujados por código; sonidos sintetizados con Web Audio.
- Commits: los hace Cielo (mensajes cortos tipo «1.0.2», «1.1»).

## 5. Decisiones
| Fecha | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| 2026-11-18 | Patear con la cámara trasera y el celular en la mano; balón anclado al piso con el giroscopio | con la cámara frontal había que alejar el celular | cámara frontal con detección de cuerpo |
| 2026-11-18 | Estilo «arcade tropical» y rediseño por fases (detalle en JUEGO.md) | elegido por Cielo | — |
| 2026-11-18 | Fase 2: penales con 3 porteros y esquina x2; postes que se mueven; Orlando por gestos; Héroes con oleadas y jefe; Miami urbano igual; tour acuático como antes | respuesta de Cielo al plan | viento en fútbol americano |
| 2026-11-19 | Modo Quest como modo aparte y opcional; vuelve WebXR solo para el visor | Cielo quiere jugar en un Meta Quest 3S sin cambiar los modos actuales | reemplazar los modos del celular |
| 2026-11-19 | En el Quest: deportes en realidad mixta y mundos en VR («según el juego»); menú 3D flotante con el índice como cursor; patada con la mano | elegido por Cielo; el Quest no sigue los pies | control amarrado al tobillo (queda para después) |
| 2026-11-19 | Paneles 3D del Modo Quest dibujados con canvas, sin librería de UI | menos dependencias y control total del diseño | librería three-mesh-ui |
| 2026-11-19 | Modo Quest aislado en `xr.js`, con ganchos (`inXR()`, `onStart`/`onEnd`, grupo `rig`) en `game.js` | no tocar los modos del celular | mezclar la lógica XR dentro de cada minijuego |
| 2026-11-19 | Penales y fútbol americano en el Quest: ventana al estadio con stencil y marco neón en el cuarto | el estadio flotando en el cuarto atravesaba las paredes | estadio flotando en el cuarto |
| 2026-11-19 | Miami Heat en el Quest: tiro con física real y ayuda parcial (ASSIST) hacia un arco *(reemplazada el 2026-11-20 por la barra de tiro)* | el medidor de tiro del celular no encaja con la mano | medidor de tiro del celular |
| 2026-11-20 | Miami Heat en el Quest: barra de tiro por tiempo estilo 2K (verde entra, amarillo pega en el aro, fuera falla), agarre con la palma, zonas con puntos y clavada | física pura con ayuda parcial se sentía difícil e incómodo (pedido de Cielo) | física pura (ASSIST) |
| 2026-11-20 | Modo «🦶 Con mis pies (PC)»: `sensor.html` con MediaPipe Pose en una PC aparte; la patada llega al visor por PeerJS/WebRTC con código de 4 dígitos; el video no sale de la PC | Cielo quiere patear con el cuerpo usando la cámara de la PC, como modo adicional | seguimiento de piernas del propio Quest (no es real); servidor propio |
| 2026-11-20 | Nombres «Touchdown NFL» y «Penales MLS»; marcas solo como texto, sin logos | pedido de Cielo | nombres anteriores («Fútbol americano», «Penales») |
| 2026-11-20 | Mundos en el Quest (Orlando, Héroes) en VR completa con manos virtuales de puntos, no en realidad mixta | los mundos son escenas propias; la realidad mixta no encajaba | realidad mixta para los mundos |
| 2026-11-20 | Orlando en el Quest: hechizos dibujados con la pinza sostenida (gestures.js sobre el plano de la vista), no detección automática por velocidad | evita hechizos falsos al mover la mano | detección por velocidad, como en el celular |
| 2026-11-20 | Héroes en el Quest: bloqueo con escudo en la mano izquierda y esquivar moviéndose, sin botón de cubrirse | más físico y acorde al visor | botón de cubrirse |
| 2026-11-20 | Orilla (tour acuático y Miami urbano): el mar pasa bajo la arena con olas que nunca la alcanzan, más una rampa de arena mojada inclinada (`shoreRamp()`) | superficies casi paralelas (agua y arena) se mezclan; la rampa da una línea de orilla limpia que se mueve con las olas | cortar el plano del mar en la orilla (el borde quedaba flotando o dejaba huecos) |
| 2026-11-20 | Tour acuático en el visor: el vehículo te lleva moviendo el grupo de la cámara con `ride()`, sin recentrar la cabeza cada cuadro | recentrar cada cuadro anularía el movimiento real de la cabeza y marearía | mover el mundo en vez de ti (rompía chispas y textos) |
| 2026-11-20 | Carril del tour en el visor: inclinar el cuerpo como principal, con ◀ ▶ y palanca de respaldo | deja las manos libres para las fotos y es más inmersivo | carril según la posición de la mano (chocaba con apuntar a los animales) |
| 2026-11-20 | Miami urbano en el visor: apuntar y juntar los dedos (pinza) atrae el objeto a la mano | los objetos están a 9–16 m y el cuarto real es pequeño | caminar o teletransportarse hasta cada objeto (60 s no alcanzan) |
| 2026-11-20 | Cambio de estado: Florida → Carolina del Norte, conservando las 7 mecánicas y las claves internas | a Cielo le cambiaron el estado asignado; reutilizar lo que ya funciona en celular y Quest | rehacer juegos desde cero |
| 2026-11-20 | Tour Outer Banks con «todo lo reconocido del estado»: faros (Currituck, Bodie Island, Cabo Hatteras, Ocracoke), caballos de Corolla, monumento Wright, Jockey's Ridge, barco de Barba Negra y 11 vallas-postal (Biltmore, Monte Mitchell, NASCAR, Krispy Kreme, Pepsi, Raleigh, Duke vs. UNC, Venus atrapamoscas, batata, Blue Ridge Parkway, Research Triangle) | pedido de Cielo | solo la costa |
| 2026-11-20 | Orlando → Blue Ridge (leyenda de las luces de Brown Mountain), Héroes → Research Triangle Park, Miami urbano → Uptown Charlotte | temas reales del estado que encajan con cada mecánica | vuelo de los hermanos Wright y carrera NASCAR como juegos nuevos (quedan en el tour y en Charlotte) |

## 6. Pendientes
- [x] Publicado en `cielocaicon-ship-it/florida-ar` (el ID de PeerJS cambió a `carolina-ar-` + código).
- [ ] Probar en celular real el tour Outer Banks (1250 m, 5 paradas) y Uptown Charlotte.
- [x] Modo Quest, VR-1: base (WebXR, manos, menú 3D, paneles, confort, calidad).
- [x] Modo Quest, VR-2: Miami Heat, Penales y Fútbol americano en realidad mixta (sin probar en Quest real).
- [x] Modo Quest: Orlando e Isla de Héroes en VR (sin probar en Quest real).
- [ ] Probar Orlando e Héroes en Quest 3S real (reconocimiento de figuras y XO.PX; tamaño del escudo XH.SHIELD_R y puntería).
- [x] Modo Quest: Miami urbano y tour acuático en el visor (2026-11-20, sin probar en Quest real).
- [ ] Hacer commit y push pronto: el sitio publicado (1.4.2) tiene el fallo de `ctx.pop`.
- [ ] Probar en Quest 3S real Miami urbano y tour acuático (mareo, inclinación `XW.LEAN`, marco de fotos, flecha `XC`).
- [ ] Revisar en el celular que la orilla nueva se vea bien.
- [ ] Probar en iPhone real y en Quest 3S real (patada, mano, gestos, giroscopio).
- [ ] Probar VR-1 y VR-2 en Quest 3S real; ajustar HANDKICK (`xr.js`) y XRB (`scenes.js`).
- [ ] Probar el Miami Heat nuevo en Quest 3S real (barra, zonas, clavada).
- [ ] Probar el modo «Con mis pies (PC)» con una PC (ajustar KICKCAM); revisar si la red de la feria permite PeerJS (si no, hotspot de celular).
- [ ] Confirmar el origen del balón «Trionda Ball 2026» (posibles derechos).
- [ ] No subir la carpeta «Modelos texturizados» (nombres de marcas y duplicados).

## 7. Problemas conocidos y trampas
- Hay dos juegos con la clave `miami`: el de `scenes.js` no se usa, porque `GAMES2.miami` (tour acuático de scenes2.js) lo reemplaza.
- En Chrome automático (SwiftShader) el juego corre más lento que en un celular (`dt` limitado a 0.05 s): las pruebas deben esperar estados del juego, no tiempos fijos.
- Los FBX no traen texturas (rutas de otro PC); los colores se fijan en `models.js`.
- En el Quest, una página web no puede usar las cámaras del visor de forma confiable: el detector de patada del celular no sirve allí.
- Modo Quest: verificado solo con emulador IWER 2.8 (Quest 3) en Chrome automático. VR-1: 15/15 comprobaciones. VR-2: 18/18 deportes en dos corridas. Regresión de penales y fútbol americano en iPhone emulado sin errores. No probado en Quest real.
- Sesión 2026-11-20 (Miami Heat nuevo, modo pies y renombres): nada se probó, ni con emulador; solo se revisó la sintaxis (pedido de Cielo).
- Sesión 2026-11-20 (Orlando e Héroes en VR): nada se probó, ni con emulador; solo sintaxis (pedido de Cielo).
- «Touchdown» no es técnicamente lo que pasa en el juego (es un gol de campo); se usó por pedido de Cielo.
- Modo pies: PeerJS depende de un servicio externo gratuito y de internet.
- Fallo de `ctx.pop` de 1.4.2: corregido en el código local; falta publicar (commit y push).
- Riesgo de mareo en el tour en el visor (primer juego con movimiento continuo).
- En el tour del visor, si te quedas inclinado más de 4 s y luego vuelves al centro, puede cambiar de carril al lado contrario.

## 8. Bitácora
<!-- Entradas nuevas ARRIBA. Aquí se conservan las últimas 8; las anteriores se archivan solas en .hilo/historial.md -->
### 2026-11-20 · v2.1.0 · Claude (chat)
- Se quitó el duelo de magos (Blue Ridge): la clave `orlando` ahora es «Kitty Hawk — El primer vuelo» (`firstFlight` en `scenes2.js`, ajustes en `FLY`): pilotas el Wright Flyer por 10 aros. Se quitó la leyenda de hechizos de `index.html`; en el Quest el menú tiene 3 mundos.
- Tour Outer Banks mejorado: guía que anuncia cada lugar (`GUIDE`), el bote va más lento cerca de los lugares famosos, menos boyas (ninguna cerca de las paradas) y medalla al final (preguntas, fotos y corazones).
- Idiomas: nuevo `i18n.js` con el diccionario español → inglés (`EN`). Traduce tarjetas, avisos, pistas, letreros 3D (canvas) y la página; empieza siempre en inglés; selector 🇺🇸/🇪🇸 en la intro y en ⚙️.
- Verificado en Chrome automático: carga en inglés sin textos en español pendientes en los juegos recorridos; el cambio a español funciona.
### 2026-11-20 · v2.0.0 · Claude (chat)
- Cambio de estado a Carolina del Norte sobre la versión 1.4.3 (zip de Cielo). Intro «Welcome to North Carolina!», final, menú del cofre (Aventura · Viaje · Deportes), menú Quest, sensor de pies y textos de cada juego.
- `scenes2.js`: tour Outer Banks (`waterTour`, END 1250, 5 paradas con preguntas, caballos, pelícanos, faros, monumento Wright con Wright Flyer volando, Jockey's Ridge con alas delta, barco pirata, casas sobre pilotes, `POSTALES`); Uptown Charlotte (`city`: parque, rascacielos, torre con corona, tren ligero, Salón de la Fama NASCAR; objetos 🏁 🍩 🥤 🏀 👑); Research Triangle (`heroes`: laboratorios de vidrio, pinos, armas renombradas); Panthers y Charlotte FC (colores y textos).
- `scenes.js`: Blue Ridge (`orlando`: cordilleras azules, árboles de otoño, luces de Brown Mountain, guardián, varitas de árboles del estado); Hornets (`heat`: cancha turquesa y morada, público y vallas). Se quitó la entrada vieja `GAMES.miami`.
- Verificado en Chrome automático: los 7 juegos cargan sin errores. No probado en iPhone ni Quest reales.
### 2026-11-20 · v1.4.3 · Claude Code
- Arreglo urgente en `game.js` (objeto ctx): en 1.4.2 un comentario `//` a mitad de línea anulaba `pop`, `shake`, `slowmo`, `best` y `fx` (57 llamadas); los juegos se caían en el celular y en el visor. Corregido; `ctx.teleport` ahora recibe también la altura del piso (y).
- Orilla del tour acuático (`scenes2.js`, constante `SHORE` y `shoreRamp()`): el mar pasaba bajo la arena y sus olas la cubrían en parches. Mar a −0.4 m, olas más bajas, rampa de arena mojada bajo el agua y manatíes mar adentro. Miami urbano usa lo mismo; afecta también al celular.
- Modo Quest completo: los 7 juegos se eligen en el visor; el menú tiene una fila de 4 mundos en VR (se quitaron «Próximamente»). `xr.js`: `spot.y`, `ride()` (vehículo sin fundido ni recentrar la cabeza) y `xrRayLen(inp)` opcional en las escenas.
- Miami urbano en el visor (`scenes2.js`, `XC`): apareces en la acera de Ocean Drive; apuntar y juntar los dedos atrae el objeto a la mano; flecha 3D hacia el más cercano; 60 s.
- Tour acuático en el visor (`scenes2.js`, `XW`): esperas en un muelle y avanza solo; carril por inclinación del cuerpo, o ◀ ▶ o palanca; fotos apuntando al animal y pinza; contra el mareo, vista sin balanceo y 80 % de velocidad.
- `README.md` actualizado. Verificación: solo `node --check` de xr.js, game.js, scenes.js y scenes2.js; sin pruebas (ni emulador ni dispositivo), por pedido de Cielo.
### 2026-11-20 · sin versión · Claude Code
- Orlando en el visor (`scenes.js`, bloque XO): vitrina de varitas flotante, varita en la mano derecha, hechizos dibujados en el aire con la pinza sostenida (`gestures.js` proyecta el trazo al plano de la vista), palma abierta = escudo y leyenda de hechizos en 3D con demostración en chispas. Se aparece frente al mago con fundido.
- Isla de Héroes en el visor (`scenes2.js`, bloque XH): vitrina de poderes y botones, arma en la mano derecha (apuntar y pinza para atacar, escudo con gesto), escudo de energía en la mano izquierda que bloquea bolas rojas, y esquivar moviéndose («¡ESQUIVADA!»). Ambas escenas usan la posición real de la cabeza en el mundo.
- `xr.js`: manos dibujadas con puntos de luz cuando el mundo tapa el cuarto, detección de mano abierta, leyenda 3D reutilizable (`legend`), rayo para apuntar si la escena lo pide (`xrRays`), y menú con la fila «Mundos · realidad virtual» (Orlando, Héroes) y «Próximamente» (Miami urbano, tour acuático).
- `README.md` actualizado. No probado: solo revisión de sintaxis, por pedido de Cielo (ni emulador).
### 2026-11-20 · sin versión · Claude Code
- Miami Heat en el visor rehecho (`scenes.js`, bloque XZ/XRB): agarre con la palma (sin pinza), dribleo que empuja hacia el piso y rebota a la altura de la mano, y barra de tiro estilo 2K junto al balón (verde entra, amarillo pega en el aro, fuera falla).
- Zonas de tiro (bandeja, doble, triple, clavada) con puntos por zona; la clavada sube el balón y lo baja fuerte cerca del aro. Al cambiar de zona el juego gira al jugador hacia el aro (teleport con mirada en `xr.js`).
- Modo «🦶 Con mis pies (PC)» para Touchdown NFL y Penales MLS: nuevos `sensor.html` y `sensor.js` (MediaPipe Pose en la PC; la patada llega al visor por PeerJS con código de 4 dígitos). En `xr.js` el balón queda en el piso y la tarjeta ofrece «Con la palma» o «Con mis pies».
- Renombres en `scenes2.js` (GAMES2: short, title, pix): «Penales» → «Penales MLS», «Fútbol americano» → «Touchdown NFL». `README.md` actualizado.
- No probado: solo se revisó la sintaxis, por pedido de Cielo (ni emulador).
### 2026-11-19 · sin versión · Claude Code
- Modo Quest VR-2 en `xr.js`: fútbol americano y penales con una «ventana» al estadio en el cuarto (stencil, marco neón). El balón flota a la altura de la cintura y se golpea con la palma: velocidad = fuerza, lado = dirección, detección por barrido entre cuadros.
- Miami Heat en el visor (`scenes.js`, `XRB`): aro en el cuarto sin arena; agarrar con pinza, driblar soltándolo hacia el piso y lanzar con el brazo, con ayuda hacia un tiro en arco (≥40° de caída).
- `scenes2.js` (penales y fútbol americano: `xrWorld` y teleport) y `game.js` (enter/ready en el visor): sin intros de cámara en el visor; cambiar de posición es un salto con fundido. Botonera izquierda: 🏠 Menú y 🌍 Estadio/Cancha completo.
- `README.md` actualizado. Los modos del celular no cambian.
- Verificado solo con emulador IWER 2.8 en Chrome automático: 18/18 deportes (dos corridas) y 15/15 menú; regresión en iPhone emulado (penales y fútbol americano en oro) sin errores. No probado en Quest real.
### 2026-11-19 · sin versión · Claude Code
- Modo Quest VR-1 (pasos 1-4): nuevo `xr.js` con sesión immersive-ar (respaldo immersive-vr), botón 🥽 en «¿Cómo juegas?» solo para visores con WebXR, dedo índice y rayo con pinza/gatillo, menú 3D flotante con 3 deportes y 4 «Próximamente».
- Tarjetas, avisos, pops y cuenta regresiva en 3D; confort (fundido, destello tenue, vibración en vez de sacudida); calidad (sin sombras, foveado, 72 fps); menú con seguimiento perezoso.
- `game.js`: grupo `rig`, ganchos `inXR()`, `clearScene`, `onStart`/`onEnd`. Los modos del celular no cambian.
- `index.html` (`#optQuest`), `CSS/style.css` (`.opt.quest`), `README.md` (sección Modo Quest y ajustes QUEST).
- Tocar un deporte abre por ahora una tarjeta «llega en la siguiente entrega».
- Verificado solo con emulador IWER 2.8 (Quest 3) en Chrome automático: 15/15 comprobaciones; regresión en iPhone emulado sin errores. No probado en Quest real.
### 2026-11-19 · sin versión · hilo:init
- Se crea la memoria del proyecto (CONTEXTO.md, AGENTS.md, CLAUDE.md, .hilo/) a partir del estado actual del repositorio.
- Antes de esto (commits 1.0.1 → 1.1): rediseño arcade (fase 1), patada con cámara trasera y balón anclado al piso, fase 2 de minijuegos (gestures.js nuevo).
- Cielo aprobó el Modo Quest: según el juego, patada con la mano, menú 3D flotante, empezar por los 3 deportes, como modo aparte.
