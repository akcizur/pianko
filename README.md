# MÍR 12 — Gameplay Core

Čistý FPS gameplay základ bez 3D levelu, prostředí, budov, interiérů a vozidlového modelu.

## Zachováno
- FPS pohyb, běh, skok a kamera.
- Klávesnice, myš, touch joystick / look zóna a Gamepad API.
- Pauza, základní menu a syntetizované zvukové efekty.
- Oddělené gameplay moduly pro hráče, vstupy, audio, příběhová pravidla a fyziku vozidla.

## Odstraněno
- Veškerý obsah `src/world/`.
- 3D model Škody Favorit a jeho GLTF/GLB assety.
- Generování městského světa, budov, bytů, výtahů, dveří a prostředí.
- Testy vázané na geometrii, interiéry, výtahy, dveře a model vozidla.

## Spuštění
```bash
npm ci
npm test
npm run dev
npm run build
```

## Struktura
```
src/
  core/
    game-audio.js
    input-controller.js
    player-controller.js
    story-rules.js
    vehicle-controller.js
  main.js
tests/
  input-controller.test.js
  player-controller.test.js
  story-rules.test.js
```

Scéna je záměrně prázdná. Žádný 3D level ani dekorativní náhradní svět se nenačítá.
