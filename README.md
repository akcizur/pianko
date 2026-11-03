# MÍR 12 · Rok 1975

Příběhová RPG/FPS hra v Three.js, zasazená do normalizačního Československa. Hratelná čtvrť kombinuje panelovou zástavbu, starší činžovní domy, brutalistní obchodní dům, tramvajový most, obyvatele s vlastními trasami a dobové městské detaily. Hra používá hranatý low-poly vzhled a černobílý VHS styl rozhraní.

## Hratelný svět

- Sídliště Mír s paneláky, starší zástavbou, obchodním domem, ulicí, tramvají Tatra T3, zaparkovanými vozy a chodci.
- Průchozí osmipatrový panelák se vstupním vestibulem, centrálním schodištěm, mezipodestami a chodbami.
- Dva rozměrnější byty na každém patře, po jednom na každé straně chodby. Každý byt má oddělenou obytnou část s kuchyňským koutem, ložnici a koupelnu. Bytové dveře se otevírají interakcí.
- Interiéry obsahují parkety a dlažbu, příčky s průchody, zárubně, pootevřené koupelnové dveře, vanu, toaletu, umyvadlo, kuchyňskou linku, lednici, jídelní stůl, židle, sedačku, postel, skříně, radiátory a lokální teplé osvětlení.
- Zelený hatchback Škoda má pozemní jízdní režim i hover režim. Ve vzduchu se vysunou trysky a skryjí kola; výška, rychlost a baterie se zobrazují v HUD.
- Příběhová kampaň má pět hlavních kroků, tahové souboje, vedlejší úkol se sešitem střihů, skrýše a dva možné závěry.

## Ovládání

| Vstup | Akce |
| --- | --- |
| W / S nebo šipky nahoru / dolů | Plyn a zpomalení, po zastavení také zpátečka |
| A / D nebo šipky vlevo / vpravo | Řízení vozu a směr letu |
| V | Přepnout pohled řidiče / třetí osobu |
| Myš při zamčeném ukazateli | Plynulé směrové řízení vozidla |
| Levá páčka gamepadu | Plyn a řízení |
| Pravá páčka gamepadu | Směrové řízení vozidla / rozhled pěšky |
| Shift | Běh pěšky; ve voze stoupání |
| Ctrl | Klesání ve voze |
| Space | Skok pěšky |
| E | Interakce, otevření dveří, nástup a výstup z vozu |
| T | Vytáhnout / uklidit telefon do ruky |
| I | Otevřít / zavřít inventář |
| 1–4 / Enter | Akce v tahovém souboji |
| Esc | Pauza a uvolnění myši |
| Dotyk | Levý joystick pro pohyb, pravá oblast pro rozhled/řízení, akční tlačítka |
| Gamepad | Levá páčka pohyb/řízení, pravá páčka směr, RT stoupání, LT klesání, A potvrzení, X interakce, Start pauza |

Pozemní režim používá model předních řiditelných kol, rozvor, podélnou a boční rychlost, valivý odpor, aerodynamický odpor, přilnavost pneumatik a brzdění před zpátečkou. Směr karoserie, kol, kamery a trajektorie je sjednocený. Hover režim má samostatný vektorový tah: W zrychluje dopředu, S dává zpětný tah, A/D mění směr letu a vůz plynule zachovává setrvačnost. Vertikální tah, omezení výšky a spotřeba baterie jsou nezávislé; při slabé baterii zahájí nouzové klesání. Ve vozidle klávesa V přepíná pohled řidiče v kabině a kameru třetí osoby za autem; zaměřovač se ve voze skryje. Zbraň není zobrazena v pohledu první osoby; klávesa T vytahuje ruční telefon a I otevírá inventář.

## Spuštění a sestavení

Vyžaduje Node.js 20 nebo novější. Instalace a spuštění:

    npm ci
    npm test
    npm run dev

Produkční sestavení a lokální náhled:

    npm run build
    npm run preview

GitHub Pages workflow je v .github/workflows/pages.yml.

## Struktura projektu

    src/
      core/
        game-audio.js
        input-controller.js
        player-controller.js
        story-rules.js
        vehicle-controller.js
      world/
        apartment-interior.js
      main.js
    public/models/skoda-favorit/
    tests/
      apartment-interior.test.js
      input-controller.test.js
      player-controller.test.js
      story-rules.test.js
      vehicle-controller.test.js

## Technické poznámky

vehicle-controller.js odděluje fyziku jízdy a letu od vykreslovací smyčky. Řeší akceleraci, brzdění před zpátečkou, rychlostně závislé zatáčení, tlumení výšky, baterii, otočenou kolizní obálku a subkrokované kolize s možností klouzání podél překážky. apartment-interior.js vytváří dispozice a vybavení bytů odděleně od generování fasády. Pevné příčky a hlavní vybavení mají kolizní objemy, průchody místnostmi zůstávají volné.

Automatické testy se spouštějí příkazem npm test. Kontrola syntaxe JavaScriptu nevyžaduje spuštění grafického enginu; plný vizuální playtest se provádí v prohlížeči s WebGL.
