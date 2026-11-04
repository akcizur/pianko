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

  const validIndex = (list, index) => Number.isInteger(index) && index >= 0 && index < (list?.length ?? 0);
  for (const [index, node] of (source.nodes ?? []).entries()) {
    if (node.mesh !== undefined && !validIndex(source.meshes, node.mesh)) {
      throw new Error(asset.id + ": node " + index + " references a missing mesh.");
    }
    if (node.skin !== undefined && !validIndex(source.skins, node.skin)) {
      throw new Error(asset.id + ": node " + index + " references a missing skin.");
    }
    for (const child of node.children ?? []) {
      if (!validIndex(source.nodes, child) || child === index) {
        throw new Error(asset.id + ": node " + index + " has an invalid child reference.");
      }
    }
  }

  const componentByteSize = new Map([[5120,1],[5121,1],[5122,2],[5123,2],[5125,4],[5126,4]]);
  const typeComponents = new Map([["SCALAR",1],["VEC2",2],["VEC3",3],["VEC4",4],["MAT2",4],["MAT3",9],["MAT4",16]]);
  for (const [index, accessor] of (source.accessors ?? []).entries()) {
    if (!Number.isInteger(accessor.count) || accessor.count < 1 ||
        !componentByteSize.has(accessor.componentType) || !typeComponents.has(accessor.type)) {
      throw new Error(asset.id + ": accessor " + index + " has an invalid count, componentType, or type.");
    }
    if (accessor.bufferView !== undefined && !validIndex(source.bufferViews, accessor.bufferView)) {
      throw new Error(asset.id + ": accessor " + index + " references a missing bufferView.");
    }
    if (accessor.sparse) {
      if (!Number.isInteger(accessor.sparse.count) || accessor.sparse.count < 1 || accessor.sparse.count > accessor.count ||
          !validIndex(source.bufferViews, accessor.sparse.indices?.bufferView) ||
          !validIndex(source.bufferViews, accessor.sparse.values?.bufferView) ||
          !componentByteSize.has(accessor.sparse.indices?.componentType) ||
          ![5121,5123,5125].includes(accessor.sparse.indices.componentType)) {
        throw new Error(asset.id + ": accessor " + index + " has invalid sparse data.");
      }
    }
  }

  for (const [meshIndex, mesh] of (source.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      for (const [semantic, accessorIndex] of Object.entries(primitive.attributes ?? {})) {
        if (!validIndex(source.accessors, accessorIndex)) {
          throw new Error(asset.id + ": mesh " + meshIndex + " attribute " + semantic + " is invalid.");
        }
      }
      if (primitive.indices !== undefined && !validIndex(source.accessors, primitive.indices)) {
        throw new Error(asset.id + ": mesh " + meshIndex + " primitive " + primitiveIndex + " has invalid indices.");
      }
      if (primitive.material !== undefined && !validIndex(source.materials, primitive.material)) {
        throw new Error(asset.id + ": mesh " + meshIndex + " primitive " + primitiveIndex + " has invalid material.");
      }
    }
  }

  for (const [animationIndex, animation] of (source.animations ?? []).entries()) {
    for (const [samplerIndex, sampler] of (animation.samplers ?? []).entries()) {
      if (!validIndex(source.accessors, sampler.input) || !validIndex(source.accessors, sampler.output)) {
        throw new Error(asset.id + ": animation " + animationIndex + " sampler " + samplerIndex + " has invalid accessors.");
      }
    }
    for (const [channelIndex, channel] of (animation.channels ?? []).entries()) {
      if (!validIndex(animation.samplers, channel.sampler) ||
          !validIndex(source.nodes, channel.target?.node) ||
          !["translation","rotation","scale","weights"].includes(channel.target?.path)) {
        throw new Error(asset.id + ": animation " + animationIndex + " channel " + channelIndex + " is invalid.");
      }
    }
  }

  for (const [index, image] of (source.images ?? []).entries()) {
    if (image.uri) {
      const imagePath = resolveInside(modelDirectory, image.uri, asset.id + " image " + index);
      await stat(imagePath);
    } else if (image.bufferView !== undefined && !validIndex(source.bufferViews, image.bufferView)) {
      throw new Error(asset.id + ": image " + index + " references a missing bufferView.");
    }
  }

  const extras = source.asset?.extras ?? {};
  if (extras.license && !extras.license.startsWith(asset.license)) {
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
