import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_ASSETS, resolveModelAssetUrl } from "../src/world/model-assets.js";

test("Favorit model has a documented runtime fallback and attribution", () => {
  const model = MODEL_ASSETS.skodaFavorit;
  assert.equal(model.id, "skoda-favorit");
  assert.equal(model.path, "models/skoda-favorit/scene.gltf");
  assert.equal(model.fallback, "procedural-hatchback");
  assert.equal(model.license, "CC-BY-NC-ND-4.0");
  assert.equal(model.attribution.author, "Tomáš Musílek");
  assert.ok(model.attribution.source.startsWith("https://sketchfab.com/"));
});

test("model URLs resolve for root, project-site and relative deployments", () => {
  assert.equal(resolveModelAssetUrl("/", "models/car/scene.gltf"), "/models/car/scene.gltf");
  assert.equal(resolveModelAssetUrl("/pianko/", "models/car/scene.gltf"), "/pianko/models/car/scene.gltf");
  assert.equal(resolveModelAssetUrl("./", "models/car/scene.gltf"), "./models/car/scene.gltf");
  assert.equal(resolveModelAssetUrl("", "models/car/scene.gltf"), "./models/car/scene.gltf");
});

test("model URL resolver rejects traversal and malformed paths", () => {
  for (const path of ["", "../secret.gltf", "models/../secret.gltf", "https://example.com/car.gltf", "models/car.gltf?raw=1", "models\\car.gltf"]) {
    assert.throws(() => resolveModelAssetUrl("/", path), TypeError);
  }
});
