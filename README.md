<<<<<<< HEAD
# MÍR 12 — Rok 1975

Příběhová RPG FPS hra v Three.js, zasazená do Československa roku 1975. Základ ovládání hráče a vstupních zařízení vychází z [akcizur/14](https://github.com/akcizur/14); město, vozidla, postavy a kampaň jsou vytvořené pro tento projekt.

Sídliště Mír staví vedle sebe panelovou výstavbu, oprýskanou starší zástavbu a brutalistní obchodní dům. Ulice doplňují tramvaj Tatra T3, hlídková Škoda 100, zelený hranatý hatchback, procházející obyvatelé, výlohy, prádlo na balkonech a plakát Spartakiády; kolem chodců lze projít, nebo s nimi prohodit pár dobových vět. Obyvatelé mají vlastní trasy a zastávky, neútočí a pokračují ve svém denním rytmu. Hratelný hatchback má prosklenou kabinu s viditelným interiérem, zavazadly, světly, nárazníky, koly a registračními značkami; umí vzlétnout až do 42 metrů, ve vzduchu dosahuje 72 km/h a jeho baterie se dobíjí po přistání. Telemetrie zobrazuje výšku, rychlost a stav baterie. Průchozí osmipatrový panelák má vstupní vestibul, centrální schodiště s mezipodestami a chodbu se čtyřmi byty na patře. Bytové dveře se otevírají do oddělených dispozic s kuchyněmi, obytnými částmi, koupelnami, radiátory a nábytkem; fasáda má skleněná okna, parapety, lodžie, zábradlí a svody. Model zůstává v hranaté pixelové estetice hry, zatímco rozměry průchodů, pater a dispozice vycházejí z obytného domu. Procedurální zvuk přidává déšť a elektrický šum města, kroky, střelbu, zásahy, dveře, rozhraní a motor vozu; lze ho vypnout v nastavení. Hlavní menu i herní rozhraní mají černobílý VHS vzhled.

## Spuštění

Vyžaduje Node.js 20+.

```sh
=======
# Severní čtvrť — FPS World

A browser-based low-poly residential district built with Three.js and the standalone FPS controller in this repository.

## World

- 20 separate residential lots arranged in a 4 × 5 district.
- A road grid, asphalt, lane markings, raised curbs, sidewalks and parking bays.
- 20 individual low-poly houses with varied silhouettes, roof styles, facades, porches, doors, windows and chimneys.
- Small yards, fences, hedges, flowerbeds, mailboxes and trees.
- Parked low-poly cars in marked bays and a low-poly tree/hill belt beyond the district edge.
- Street lamps, benches, bins and a district entrance sign.
- Per-house and prop collision boxes, plus district boundary walls.
- Optional import of the supplied Blender house pack as a GLB file. If it is not present, the built-in procedural house set is used automatically.

## Run

Requirements: Node.js 20 or newer.

~~~sh
>>>>>>> 1586982803960b26bef375c749702cba0d795a90
npm install
npm run dev
```

<<<<<<< HEAD
## Hratelná kampaň

Projdi pěti kroky příběhu: dostaň se přes hlídku k telefonní rozvodně, obnov linku, promluv s mechanickou Mirou, zachraň kurýra s páskou z nepovoleného koncertu a dones ji ke krátkovlnnému vysílači. Závěr má dvě volby — předat pásku Evě, nebo rozmnožit její kopie pro samizdat. Souboje dávají XP a Kčs; XP zvyšují úroveň, maximum HP a energie. Mira prodává obvazy a nabízí vylepšení vz. 61 i ochranné podšívky bundy. Ve třech zásobovacích skrýších můžeš najít obvazy, poukázku na Kčs a zkušenosti; jejich nalezení se ukládá. Mimo hlavní příběh můžeš pomoct Anně vrátit Ivaně zapomenutý sešit střihů z vestibulu domu.

- **WASD / šipky / levý joystick**: pohyb; při jízdě plyn a zatáčení
- **Myš / pravý joystick**: rozhled pěšky; směrování kamery při jízdě
- **Space**: skok pěšky
- **Shift**: běh pěšky; ve voze stoupání
- **Ctrl**: klesání ve voze
- **E**: interakce, otevření vstupních dveří, nástup/výstup, rozhovor, zahájení souboje, použití terminálu
- **1–4** nebo **Enter**: akce v tahovém souboji
- **Gamepad**: levá páčka pohyb/řízení, pravá rozhled, směrový kříž výběr; **A** potvrdit, **X** interakce, **RT** stoupat ve voze, **LT** klesat, **RB** obvazy; **Start** pauza. Ovládá také menu, rozhovory a tahové souboje.
- **Esc**: pauza a uvolnění myši
- **Dotyk/gamepad**: základní pohyb a akce z controlleru `akcizur/14`

Hra ukládá pozici, stav úkolu, postavu, vůz i zvolený konec do lokálního save slotu. Jde o rozpracovaný kampaňový prototyp; další čtvrti, postavy, zvuk, animace a vedlejší úkoly jsou dalšími kroky vývoje.
=======
Build and preview the static site:

~~~sh
npm test
npm run build
npm run preview
~~~

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D or arrows | Move |
| Shift | Sprint |
| Space | Jump |
| Mouse | Look (click the world to capture the pointer) |
| E | Interact with nearby home markers / district sign |
| Escape | Pause / resume |
| Touch | Left joystick to move, drag right side to look, action buttons |
| Gamepad | Left stick move, right stick look, A jump, X interact, triggers sprint, Start / B pause |

## Optional Blender model pack

Place the exported model at:

~~~text
public/models/LowPoly_House_20_Pack_Selected.glb
~~~

The supplied pack exports six scene roots named `house_1`, `house_2`, `house_3`, `house_4`, `house_6` and `house_8`. The world reuses these six authored variants across all twenty lots, fits the source transforms to a consistent house footprint, grounds each model and applies a per-lot facade tint. The built-in procedural houses remain available as a fallback, so the world starts even when the GLB is not present. The GLB is an optional local asset and must be copied to the path above before it can appear in the deployed world.

## Project layout

~~~text
src/
  core/
    player-controller.js
    input-controller.js
  world/
    world.js
  main.js
public/
  models/
    LowPoly_House_20_Pack_Selected.glb  (optional)
tests/
  player-controller.test.js
~~~

The movement controller is kept separate from the world builder so another level can reuse the same FPS movement, touch, keyboard, mouse and gamepad input.

## Source relationship

The first-person movement architecture is based on the approach in [akcizur/DFLAT](https://github.com/akcizur/DFLAT). This repository is a reusable controller and test world, not the DFLAT game.
>>>>>>> 1586982803960b26bef375c749702cba0d795a90
