# carolina-ar — Carolina AR Adventure

Juego web de realidad aumentada sobre **Carolina del Norte** para la feria: un cofre mágico abre 7 minijuegos y cada uno da una estrella.

| Juego | Qué es |
|---|---|
| ✨ Blue Ridge | Duelo por gestos contra el guardián de las luces de Brown Mountain |
| 🤖 Research Triangle | Drones de un laboratorio fuera de control: oleadas y jefe |
| 🏙️ Charlotte | Encuentra 5 íconos del estado en Uptown en 60 s |
| 🚤 Outer Banks | Tour en lancha: faros, caballos salvajes, hermanos Wright, Barba Negra, postales del estado y 5 preguntas |
| 🏀 Charlotte Hornets | Baloncesto arcade |
| 🏈 Carolina Panthers | Gol de campo con el pie |
| ⚽ Charlotte FC | Penales con el pie |

Las claves internas de los juegos no cambiaron desde la versión de Florida: `orlando` = Blue Ridge, `heroes` = Research Triangle, `city` = Charlotte, `miami` = Outer Banks, `heat` = Hornets, `fg` = Panthers, `penalty` = Charlotte FC. Logos de equipos: no se usan (solo nombres y colores).

## Créditos de modelos 3D (carpeta `assets/`)

- `Michelle.glb`: personaje y animación de Mixamo (Adobe), tomado de los ejemplos de three.js.
- `Flamingo.glb` y `Parrot.glb`: aves animadas de mirada (ro.me), tomadas de los ejemplos de three.js. Uso académico, sin fines comerciales.

## Modelos del proyecto (carpeta `assets/modelos/`, formato FBX)

Varitas, martillo, arco, escudo, lancha, moto acuática, tabla de surf, balones (baloncesto, fútbol americano y fútbol), arco de fútbol, postes de fútbol americano y tableros de baloncesto (con y sin red).

- Se cargan y ajustan en `models.js` (orientación, tamaño y materiales). Los FBX no incluyen las imágenes de textura, así que los colores salen del modelo y los diseños (balones, tabla, escudo, red, tablero) se dibujan por código con diseños originales.
- Para cambiar un modelo: exporta desde Blender un FBX con el mismo nombre de archivo y reemplázalo en `assets/modelos/`.
- Para usar tus propias imágenes de textura: cópialas a `assets/modelos/texturas/` y regístralas en `TEXTURAS`, al inicio de `models.js`.
- La lancha y la moto acuática FBX no se usan por ahora (el tour acuático usa sus vehículos hechos por código). Para volver a usarlas, quítalas de `SIN_USO` en `models.js`.

## Ajustes de juego (si algo se siente difícil o fácil)

- Tour Outer Banks: largo `END`, paradas y preguntas `STOPS`, vallas del estado `POSTALES` en `scenes2.js`.

- Patada con el pie: `KICK` en `footTracking.js`.
- Gestos de Orlando (⚡ zigzag, ➖ línea, ⭕ círculo): `GEST` en `gestures.js`; tiempos del duelo: `DUEL` en `scenes.js`.
- Héroes (vida de drones y jefe, cada cuánto disparan): `HZ` en `scenes2.js`.
- Penales (los 3 porteros): `STY` en `scenes2.js`. Postes que se mueven en fútbol americano: `POST_X`, `PUSH_SP` y `CAM_LIFT` en `scenes2.js`.
- 🥽 Modo Quest (visor Meta Quest): `QUEST` en `xr.js` (distancia del menú, sensibilidad del toque con el dedo, calidad y cuadros por segundo).
  Golpe con la palma en Penales MLS y Touchdown NFL: `HANDKICK` en `xr.js`. Tamaño de la ventana al estadio: `WINDOW` en `xr.js`.
  Miami Heat en el visor: zonas de tiro `XZ` y barra de tiro, agarre, dribleo y clavada `XRB` en `scenes.js`.
  Patada con los pies (cámara de la PC): `KICKCAM` en `sensor.js`.
  Orlando en el visor (trazo en el aire, escudo con la palma, vitrina de varitas): `XO` en `scenes.js`. Isla de Héroes en el visor (escudo de la mano izquierda, golpe en la cabeza, lanzar el escudo): `XH` en `scenes2.js`.
  Miami urbano en el visor (altura de la acera, rapidez con que el objeto vuela a tu mano, flecha): `XC` en `scenes2.js`. Tour acuático en el visor (velocidad, cuánto inclinarte para cambiar de carril, cuánto se mece el vehículo): `XW` en `scenes2.js`.
- Orilla del mar en Miami urbano y el tour acuático (altura del mar, tamaño de las olas y rampa de arena mojada): `SHORE` en `scenes2.js`. La cresta de las olas (`SEA_Y + AMP × 0.58`) debe quedar bajo 0 para que el agua no atraviese la arena.

## 🥽 Modo Quest (Meta Quest 3S)

- Abre el enlace del juego en el navegador del visor (Meta Quest Browser). En «¿Cómo juegas?» aparece **🥽 Modo Quest** (solo en visores; en el celular no sale).
- Ves tu cuarto (realidad mixta) con un menú flotante. **Toca** los botones con el dedo índice, o **apunta de lejos y junta el índice con el pulgar** (pinza). Con los controles, apunta y usa el gatillo.
- **Penales MLS y Touchdown NFL:** el estadio se abre como una ventana frente a ti y el balón flota frente a tu cintura. Golpéalo con la palma: más rápido = más fuerte, hacia arriba = más alto y hacia un lado = apuntas a ese lado.
- **Miami Heat:** el aro aparece en tu cuarto. Toca el balón con la palma para agarrarlo y empújalo hacia el piso para driblar (el rebote vuelve a tu mano). Para tirar, súbelo sobre tu cabeza: aparece una barra (estilo 2K) y lo lanzas cuando la marca está en el VERDE. Tiras desde la bandeja, el doble y el triple; en la última zona puedes hacer una clavada (sube el balón y bájalo fuerte hacia el aro).
- **🦶 Patear con tus pies (Penales MLS y Touchdown NFL):** en la tarjeta del juego elige «Con mis pies (PC)». En una PC con cámara abre `sensor.html` (la misma dirección del juego, terminada en `/sensor.html`), escribe el código que muestra el visor y pon la PC frente a ti, a 2 o 3 m, que te vea de cuerpo entero. El balón queda en tu piso y lo pateas de verdad. El video no sale de la PC; la PC y el visor se encuentran con PeerJS (servicio gratuito) y necesitan internet. Si la red de la universidad no los deja conectarse, comparte internet desde un celular a los dos.
- A tu izquierda hay dos botones: 🏠 Menú y 🌍 Estadio (o Cancha) completo, que cambia la ventana por el estadio entero.
- **Orlando (mundo en VR):** toca la varita que quieras en la vitrina y aparece en tu mano derecha. Junta índice y pulgar y dibuja en el aire la figura de la runa (zigzag = rayo, línea = desarme, círculo = escudo); al soltar los dedos sale el hechizo. Tu palma abierta hacia el mago también hace escudo. A tu derecha está la leyenda: toca un hechizo para ver cómo se dibuja.
- **Isla de Héroes (mundo en VR):** toca el poder que quieras (rayo, flecha o escudo). Apunta con la mano derecha al dron del aro rojo y junta los dedos para atacar (el escudo también se lanza con el gesto). Tu mano izquierda lleva un escudo de energía: ponlo frente a las bolas rojas, o esquívalas moviéndote.
- En los mundos tu cuarto no se ve, así que tus manos aparecen como puntos de luz.
- **Miami urbano (mundo en VR):** apareces en la acera de Ocean Drive mirando la playa. Gira para buscar los 5 objetos (uno está detrás de ti); si el más cercano no está a la vista, una flecha amarilla frente a ti lo señala. Apunta con la mano a un objeto y junta los dedos: vuela hasta tu mano.
- **Tour acuático (mundo en VR):** esperas en un muelle; al elegir lancha o moto de agua quedas de pie en ella y avanza sola (la playa a tu derecha). Para cambiar de carril inclina el cuerpo a un lado; también sirven los botones ◀ ▶ de tu derecha o la palanca del control. Para fotografiar un animal, apúntalo (aparece un marco 📸) y junta los dedos. En el visor va al 80 % de la velocidad del celular y tu vista no se mece, para marear menos.
- Para probar en el computador sin visor: el emulador de Meta, Immersive Web Emulator (extensión de Chrome).
