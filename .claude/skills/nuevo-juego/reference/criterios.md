# Criterios de aceptación comunes

Se copian en cada spec de juego sustituyendo `<id>` y `<TÍTULO>`. Después se añaden los específicos del juego (una línea por regla de puntos, vidas, niveles y fin de partida, con valores literales).

```markdown
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [ ] `/juegos/<id>` y `/juegos/<id>/jugar` responden 200 y muestran el título <TÍTULO>.
- [ ] `lib/games/registry.ts` contiene `<id>` y su motor implementa `GameEngine` sin estado de módulo.
- [ ] Al entrar a `/juegos/<id>/jugar` se ve la pantalla de inicio con los controles y `PULSA ESPACIO PARA EMPEZAR`; la partida no empieza hasta pulsar Espacio o hacer click.
- [ ] La puntuación, las vidas y el nivel del HUD del canvas y del HUD React coinciden en todo momento.
- [ ] `PAUSA`, `P` y `Escape` congelan el juego y muestran `EN PAUSA`; `REANUDAR`, `P` o `Escape` lo reanudan sin salto de posiciones.
- [ ] Cambiar de pestaña o de ventana pausa el juego automáticamente.
- [ ] Al terminar la partida el canvas muestra el fin de partida con el puntaje y se abre el modal `FIN DEL JUEGO` con la misma puntuación.
- [ ] `FIN` abre el modal con la misma puntuación que muestran los HUD.
- [ ] `JUGAR DE NUEVO` cierra el modal y empieza una partida nueva con el estado inicial en ambos HUD.
- [ ] Con el modal abierto, el teclado no mueve ni acciona nada en el juego.
- [ ] Con sesión, `GUARDAR PUNTUACIÓN` guarda la partida, muestra `▸ PUNTUACIÓN GUARDADA · PUESTO #N_` y el jugador aparece en `/salon` (pestaña <TÍTULO>) y en `/juegos/<id>`.
- [ ] Sin sesión, el modal muestra `INICIA SESIÓN PARA GUARDAR`.
- [ ] Las flechas y Espacio no hacen scroll de la página mientras se juega.
- [ ] Navegar a otra página y volver a `/juegos/<id>/jugar` (varias veces) no duplica velocidad, input ni listeners.
- [ ] El canvas se ve nítido con `devicePixelRatio` 2 y mantiene su proporción al redimensionar la ventana.
- [ ] El canvas usa la paleta neón del Vault.
- [ ] En un dispositivo táctil sin puntero fino, la pantalla de inicio muestra `REQUIERE TECLADO`.
- [ ] ASTEROIDES y los juegos simulados siguen funcionando igual.
- [ ] No hay errores en la consola del navegador durante una partida completa.
```
