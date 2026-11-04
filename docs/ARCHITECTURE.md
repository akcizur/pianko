# MÍR 12: architektura projektu

Tento dokument popisuje skutečně aktivní implementaci hry, nikoli návrh druhé hry nebo seznam neexistujících systémů.

## Runtime a tok řízení

1. \`index.html\` poskytuje herní plochu, HUD, menu, dialogy, inventář, soubojové a dotykové ovládání.
2. \`src/main.js\` je současný composition root. Vytváří Three.js renderer, scénu, aktivní městskou čtvrť, budovy, vozidlo, postavy, UI vazby a herní smyčku.
3. \`src/core/\` obsahuje logiku, která má zůstat nezávislá na vykreslovací vrstvě: pohyb hráče, vstupy, audio, pravidla úkolů, fyziku vozidla a ukládání.
4. \`src/world/\` obsahuje čistou geometrii a navigační výpočty, dispozice interiérů, výtah, animaci dveří, stav budov, kameru a katalog modelů.
5. \`tests/\` ověřuje matematiku, stavové automaty, interakce a integrační hranice bez potřeby WebGL.

\`main.js\` je zatím větší než cílová orchestrace. Nové systémy proto nepatří přímo do něj, pokud nemají pouze propojit existující moduly. Přesun samotného generování paneláku do samostatné factory je další bezpečná fáze, až budou její vstupy a výstupy pokryté integračními testy.

## Aktivní data města

\`src/world/district-layout.js\` je jediný zdroj pravdy pro 12 průchozích budov aktivní čtvrti. Vrací neměnné deskriptory s identitou, souřadnicemi, rozměry, orientací, typem a fasádou. Modul nevytváří Three.js objekty a lze jej testovat deterministicky.

\`src/world/building-geometry.js\` převádí parametry budovy na polohy stěn, otvorů, desek, schodiště, výtahové šachty a zábradlí. \`building-navigation.js\` řeší výšku hráče na schodech a mezipodestách. Tyto výpočty jsou záměrně oddělené od vykreslování.

Generátor v \`src/world/world.js\` je starší samostatná experimentální obytná čtvrť. Aktivní \`main.js\` jej nevolá. Nesmí se automaticky připojovat ke scéně MÍR 12, dokud nebude navržen jako alternativní mapa s vlastními hranicemi, navigací a kolizemi.

## Herní subsystémy

| Oblast | Modul | Odpovědnost |
| --- | --- | --- |
| Hráč | \`src/core/player-controller.js\` | Pohyb, kamera, kolize, skok a dosah interakce |
| Vstup | \`src/core/input-controller.js\` | Klávesnice, myš, dotyk, gamepad a uvolňování vstupů |
| Vozidlo | \`src/core/vehicle-controller.js\` | Pozemní/hover dynamika, AABB a subkrokované kolize |
| Kamera auta | \`src/world/vehicle-camera.js\` | Kabina, chase kamera a tlumené sledování |
| Budovy | \`src/world/building-geometry.js\` | Dispozice a konstrukční rozměry |
| Interiéry | \`src/world/apartment-interior.js\` | Místnosti, povrchy a vybavení |
| Výtah | \`src/world/building-elevator.js\` | Pohyb mezi patry, dveře a stav pasažéra |
| Stav světa | \`src/world/building-state.js\` | Serializace a obnova dveří |
| Příběh | \`src/core/story-rules.js\` | Čistá pravidla vedlejšího úkolu a setkání |
| Ukládání | \`src/core/persistence.js\` | Bezpečné čtení a zápis JSON do localStorage |
| Modely | \`src/world/model-assets.js\` | Cesty, licence, atribuce a záložní modely |

## Modely a fallbacky

Model Škody Favorit se načítá z \`public/models/skoda-favorit/scene.gltf\` a používá připojený \`scene.bin\`. Procedurální hatchback v \`main.js\` zůstává viditelný, dokud se GLTF úspěšně nenačte. Při chybě načtení zůstane procedurální varianta aktivní.

\`src/world/model-assets.js\` je katalog veřejných cest relativních k \`import.meta.env.BASE_URL\`. Tím se zachovává provoz na GitHub Pages v kořenové i projektové cestě. \`npm run check:models\` ověřuje přítomnost souborů, referencované buffery, základní integritu glTF a shodu licenčních metadat.

Volitelný balíček domů \`LowPoly_House_20_Pack_Selected.glb\` není v repozitáři. Je zmiňován pouze starším samostatným generátorem \`src/world/world.js\`, nikoli aktivní mapou.

## Persistence a kompatibilita

Save klíč \`mir12-save-v1\` a nastavení \`mir12-save-v1-settings\` zůstávají beze změny. \`readStoredJson\` vrací fallback při prázdném, poškozeném nebo zablokovaném úložišti. \`writeStoredJson\` vrací \`false\` při chybě kvóty nebo serializace. Tato vrstva nemění strukturu existujících save dat.

## Pravidla pro další vývoj

- Simulační a geometrické výpočty udržovat jako deterministické moduly bez přímé závislosti na DOM nebo rendereru.
- Rozměry budov a pozice města měnit pouze v deskriptorech a geometrických funkcích, ne pomocí dodatečných posunů v animační smyčce.
- Každý volitelný 3D model musí mít katalogový záznam, lokální soubory, atribuci/licenci, kontrolu integrity a viditelný fallback.
- Nové interakce musí používat existující kontrakt interactable (\`id\`, \`label\`, \`x\`, \`z\`, \`range\`, \`enabled\`, \`action\`) a projít kontrolou dosahu i výšky.
- Animace dveří a výtahu musí aktualizovat i kolizní objemy, ne pouze transformace meshů.
- Ukládání musí být zpětně kompatibilní a nesmí shodit start hry, pokud prohlížeč storage blokuje.
- Před sloučením změn musí projít \`npm ci\`, \`npm test\`, \`npm run check:models\` a \`npm run build\`.
- WebGL playtest zůstává nutný pro vizuální kontrolu, průchodnost prostorů, měřítko modelů, kamery a chování světel.

## Další architektonické kroky

1. Vytáhnout \`buildWalkablePanelak\` do factory s explicitním kontextem rendereru, materiálů, kolizí a audio callbacků.
2. Rozdělit generování fasády, schodiště/výtahu a bytových interiérů na samostatné factories bez duplikace geometrie.
3. Přesunout definice úkolů, NPC tras, obyvatel a spawn bodů do datových manifestů s referenčními testy.
4. Zavést browser smoke test pro start menu, nový save, nastoupení do vozidla, vstup do domu, výtah a střechu.
5. Další modely tramvaje, nábytku, obyvatel a domů přidávat jako licencované assety s kontrolou a procedurálním fallbackem.
