# 3D model assets

## Active game asset: Škoda Favorit

The active game loads `skoda-favorit/scene.gltf` together with its sibling `scene.bin` buffer. The model is registered in `src/world/model-assets.js` and loaded relative to Vite's `BASE_URL`, so project-site deployment paths work.

A procedural green hatchback is built into the game and remains visible until the GLTF has loaded. It is also used as the fallback if loading fails.

Attribution and the license declared in the source asset metadata are recorded in `../../licenses/SKODA-FAVORIT-ATTRIBUTION.md`.

## Optional legacy house pack

`LowPoly_House_20_Pack_Selected.glb` is not included in this repository. The older, standalone generator in `src/world/world.js` can use it when supplied, and falls back to procedural low-poly houses when absent. It is not used by the active MÍR 12 map in `src/main.js`.
