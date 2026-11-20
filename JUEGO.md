# JUEGO — Carolina AR Adventure (antes Florida)

> 2026-11-20: el juego pasó de Florida a Carolina del Norte. Las mecánicas de abajo siguen iguales; cambian mundos y textos: Orlando → Blue Ridge (Brown Mountain), Isla de Héroes → Research Triangle, Miami urbano → Charlotte, Tour acuático → Outer Banks (5 paradas), Miami Heat → Charlotte Hornets, Touchdown NFL → Carolina Panthers, Penales MLS → Charlotte FC.

> Biblia del juego: fuente de verdad de concepto, arte y sensaciones. Si algo del código la contradice, gana la biblia (o se actualiza primero la biblia).

## 1. Concepto
- **En una frase:** un cofre mágico en realidad aumentada abre 7 portales a minijuegos arcade sobre Florida; cada uno se gana en 1–3 minutos y da una estrella.
- **Pilares (3):** se entiende en 10 segundos · se siente bien al tocarlo (juice) · se juega con el cuerpo (mano o pie frente a la cámara trasera).
- **Bucle principal:** portal → título pixel + jingle → intro de cámara → instrucciones → 3-2-1-¡YA! → reto con combos → resultado con medalla → estrella.
- **Plataforma y controles:** web móvil (prioridad iPhone 15 Pro Max, Safari, vertical) y computador. Táctil, mano (índice frente a la cámara trasera) y pie (celular en la mano apuntando a tus zapatos). Siempre hay alternativa táctil.

## 2. Dirección de arte — «Arcade tropical»
- **Estilo:** menús y textos de juego con tipografía pixel; mundos 3D low-poly brillantes; paneles de vidrio azul noche.
- **Referencias:** máquinas arcade de los 90, postales «Welcome to Florida», atardeceres de Miami Beach.
- **Paleta (hex):**
  - Fondo noche `#0b1026` · panel `#141a3d` · texto `#ffffff` · texto secundario `#c9d1ff`
  - Atardecer: rosado `#ff4fa3` → naranja `#ff8a00` · sol `#ffd54a` · mar `#24d1ff`
  - Estados: éxito `#3ddc84` · aviso `#ffd54a` · error `#ff4d5e` · fuego `#ff6a1a`
  - Botones claros (sol, naranja, rosado, mar) llevan texto oscuro `#1a0b2e` (contraste 6:1 a 13:1).
- **Tipografía:** títulos y mensajes de juego «Press Start 2P» (pixel, en mayúsculas); interfaz y textos largos «Baloo 2» (redondeada y legible); respaldo `system-ui`.
- **Formas:** esquinas redondeadas grandes (16–28 px), botones gordos tipo arcade con sombra inferior que se hunde al presionar.
- **UI/HUD:** barra superior mínima (volver, progreso ⭐, cámara, sonido, ⚙️). El resto de ajustes vive en el menú ⚙️.

## 3. Game feel
| Parámetro | Valor | Nota |
|---|---|---|
| Título pixel al entrar | 2.2 s, saltable con un toque | jingle original de 8 bits |
| Cuenta regresiva | 3-2-1-¡YA!, 0.6 s por paso | solo en juegos de reto directo |
| Screen shake (máx.) | 0.035 rad de rotación de cámara, trauma que decae 1.6/s | se apaga con «Reducir efectos» |
| Cámara lenta | 0.35× durante 0.5 s en tiros perfectos | se apaga con «Reducir efectos» |
| Mensajes | «¡PERFECTO!», «¡SWISH!», «¡EN LLAMAS!» en pixel, 1.1 s | entrada con rebote |
| Partículas | chispas compartidas (pool de `Sparks`) | colores de la paleta |
| Vibración | 30–80 ms en golpes y patadas | opcional del sistema |

## 4. Audio
- **Efectos:** sintetizados con Web Audio (originales, sin archivos). Jingles de 8 bits para entrar, moneda, cuenta regresiva, perfecto y fuego.
- El audio arranca solo después del primer toque (la intro es muda hasta «Toca para empezar»).

## 5. Accesibilidad del juego
- [x] Alternativa táctil en todos los juegos · [x] «Reducir efectos» (shake, cámara lenta) en ⚙️ y automático con `prefers-reduced-motion`
- [x] Estados no solo por color (texto + ícono) · [x] botones ≥ 44 px · [x] nunca más de 3 destellos por segundo

## 6. Rendimiento
- **Meta:** 60 fps en iPhone 15 Pro Max; calidad Baja para equipos lentos.
- La detección de la patada usa diferencias de imagen a 96 px de ancho (sin inteligencia artificial), ~1 ms por cuadro.

## 7. Contenido y estado
| Juego | Estado |
|---|---|
| Miami Heat | Fase 1: driblar, tiro con medidor (zona verde), racha EN LLAMAS, medalla por tiempo |
| Penales | Fase 2: 3 porteros (🐢 lento, 🎲 adivinador que se inclina hacia su lado, 🐆 felino), esquina dorada x2 en cada tiro, medalla por puntos |
| Fútbol americano | Fase 2: en cada ronda 3 jugadores empujan los postes a la izquierda o a la derecha (la cámara sube para verlo) |
| Orlando | Fase 2: duelo por gestos. La runa del mago pide ⚡ zigzag (rompe su barrera), ➖ línea (desarme) o ⭕ círculo (escudo que rebota su bola). Combos y fase de furia |
| Isla de Héroes | Fase 2: oleadas de 1, 2 y 2 drones que disparan (🛡️ CUBRIRSE o palma abierta), jefe final con burbuja a media vida, 3 ❤️ |
| Miami urbano | Sin cambios (decisión de Cielo) |
| Tour acuático | Como antes de la actualización: lancha y moto hechas por código (los FBX de lancha y moto no se cargan) |

## 8. Decisiones
| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-11-18 | Estilo «Arcade tropical» | elegido por Cielo; alegre y legible en celular |
| 2026-11-18 | Patear con la cámara trasera y el celular en la mano (piso real abajo, estadio 3D arriba) | patear lejos del celular con la cámara frontal era incómodo |
| 2026-11-18 | La patada se detecta por movimiento sobre el balón, no con detección de cuerpo | con la cámara hacia los pies no se ve el cuerpo entero |
| 2026-11-18 | Baloncesto: tocar = driblar, mantener y soltar en verde = tirar | imita la mecánica real (driblar, subir, soltar arriba) |
| 2026-11-18 | Se mantienen 6 aciertos (duelo), 5 canastas y 1 estrella por juego | decisiones previas de Cielo |
| 2026-11-18 | El balón para patear queda anclado a tu piso real (giroscopio) y se recoloca tocando el piso; el detector descuenta el temblor del celular | con el balón pegado a la pantalla, mover el celular impedía patear |
| 2026-11-18 | Los textos en fuente pixel van sin tildes (la ñ sí se conserva) | «Press Start 2P» no trae Á, Ó, Ú: mezclaba dos fuentes |
| 2026-11-18 | El zoom con dos dedos queda bloqueado | en un juego táctil el gesto de zoom rompe los controles |
| 2026-11-18 | Medallas: baloncesto por tiempo (≤45 s oro, ≤75 s plata); penales y fútbol americano por intentos | recompensa extra sin cambiar la condición de la estrella |
| 2026-11-18 | Fase 2 elegida por Cielo: penales con porteros y esquina x2; postes que se mueven empujados (no viento); Orlando por gestos; Héroes con oleadas y jefe; Miami urbano igual; tour acuático como antes | respuesta de Cielo al plan de la fase 2 |
| 2026-11-18 | Penales: ningún portero que se lanza alcanza el ángulo (esquinas de arriba); medalla oro ≥500 pts, plata ≥400 pts o 3 de 3 | da una salida al portero felino y premia la esquina dorada |
| 2026-11-18 | Orlando: los hechizos se llaman Rayo, Desarme y Escudo (sin nombres de Harry Potter); con la mano hay 30 % más de tiempo por runa | evitar nombres protegidos; dibujar en el aire es más lento |
| 2026-11-18 | Héroes: la estrella pide los 5 drones y además el jefe; medalla por corazones (3 oro, 2 plata, 1 bronce) | el jefe es el clímax aprobado; se mantienen los 5 drones |
