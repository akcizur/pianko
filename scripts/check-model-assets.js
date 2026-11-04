import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL_ASSETS } from "../src/world/model-assets.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(projectRoot, "public");

function resolveInside(root, relativePath, label) {
  if (typeof relativePath !== "string" || !relativePath || isAbsolute(relativePath)) {
    throw new Error(label + ": expected a relative file path.");
  }
  const target = resolve(root, relativePath);
  const fromRoot = relative(root, target);
  if (fromRoot === ".." || fromRoot.startsWith(".." + sep) || isAbsolute(fromRoot)) {
    throw new Error(label + ": path escapes its asset directory.");
  }
  return target;
}

async function checkAsset(asset) {
  const modelPath = resolveInside(publicRoot, asset.path, asset.id);
  const source = JSON.parse(await readFile(modelPath, "utf8"));

  if (asset.format !== "gltf" || source.asset?.version !== "2.0") {
    throw new Error(asset.id + ": expected a glTF 2.0 JSON asset.");
  }
  if (!Array.isArray(source.scenes) || source.scenes.length === 0 ||
      !Array.isArray(source.nodes) || source.nodes.length === 0 ||
      !Array.isArray(source.meshes) || source.meshes.length === 0) {
    throw new Error(asset.id + ": scene graph or mesh data is missing.");
  }
  if (source.scene !== undefined && (!Number.isInteger(source.scene) || !source.scenes[source.scene])) {
    throw new Error(asset.id + ": default scene index is invalid.");
  }
  for (const [sceneIndex, scene] of source.scenes.entries()) {
    for (const nodeIndex of scene.nodes ?? []) {
      if (!Number.isInteger(nodeIndex) || !source.nodes[nodeIndex]) {
        throw new Error(asset.id + ": scene " + sceneIndex + " references a missing node.");
      }
    }
  }

  const modelDirectory = dirname(modelPath);
  const bufferFiles = [];
  for (const [index, buffer] of (source.buffers ?? []).entries()) {
    if (!buffer.uri || /^[a-z][a-z\d+.-]*:/i.test(buffer.uri)) {
      throw new Error(asset.id + ": buffer " + index + " must use a local URI.");
    }
    const bufferPath = resolveInside(modelDirectory, buffer.uri, asset.id + " buffer " + index);
    const info = await stat(bufferPath);
    if (info.size < buffer.byteLength) {
      throw new Error(asset.id + ": buffer " + buffer.uri + " is shorter than its declared byteLength.");
    }
    bufferFiles.push({ path: buffer.uri, bytes: info.size });
  }

  for (const [index, view] of (source.bufferViews ?? []).entries()) {
    const buffer = source.buffers?.[view.buffer];
    if (!buffer || !Number.isInteger(view.byteLength) || view.byteLength < 0 ||
        (view.byteOffset ?? 0) + view.byteLength > buffer.byteLength) {
      throw new Error(asset.id + ": bufferView " + index + " points outside its buffer.");
    }
  }

  const extras = source.asset?.extras ?? {};
  if (extras.license && extras.license !== asset.license) {
    throw new Error(asset.id + ": catalogue license does not match the glTF metadata.");
  }
  if (asset.attribution?.author && extras.author && !extras.author.includes(asset.attribution.author)) {
    throw new Error(asset.id + ": catalogue author does not match the glTF metadata.");
  }
  if (!asset.fallback) throw new Error(asset.id + ": an optional model must declare a fallback.");

  return {
    id: asset.id,
    meshes: source.meshes.length,
    materials: source.materials?.length ?? 0,
    animations: source.animations?.length ?? 0,
    buffers: bufferFiles
  };
}

let failed = false;
for (const asset of Object.values(MODEL_ASSETS)) {
  try {
    const result = await checkAsset(asset);
    const buffers = result.buffers.map(buffer =>
      buffer.path + " (" + buffer.bytes.toLocaleString("en-US") + " B)"
    ).join(", ");
    console.log("✓ " + result.id + ": " + result.meshes + " meshes, " +
      result.materials + " materials, " + result.animations + " animations; " +
      (buffers || "no external buffers"));
  } catch (error) {
    failed = true;
    console.error("✗ " + asset.id + ": " + error.message);
  }
}
if (failed) process.exitCode = 1;
