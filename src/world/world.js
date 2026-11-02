import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = `${import.meta.env.BASE_URL}models/LowPoly_House_20_Pack_Selected.glb`;
const HOUSE_COLUMNS = [-39, -13, 13, 39];
const HOUSE_ROWS = [-44, -22, 0, 22, 44];
const VERTICAL_ROADS = [-26, 0, 26];
const HORIZONTAL_ROADS = [-33, -11, 11, 33];
const PALETTE = [0xc9bca9, 0xaab9b4, 0xc6c0b2, 0xb4bdc0, 0xcab6a5, 0xa9b3a8, 0xbeb9ae, 0xb9c3c0];
const ROOF_PALETTE = [0x555b5c, 0x6b6259, 0x77746a, 0x464d51, 0x71695f, 0x555653];
const GARDEN_PALETTE = [0x727f69, 0x7b856d, 0x687963, 0x808875];

const mats = {};
function material(name, color, roughness = 0.9, extra = {}) {
  if (!mats[name]) mats[name] = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  return mats[name];
}

function makeBox(scene, name, x, y, z, width, height, depth, mat, { solid = false, colliders = null, castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.name = name;
  mesh.position.set(x, y + height / 2, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  if (solid && colliders) {
    colliders.push({
      name,
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2
    });
  }
  return mesh;
}

function makePlane(scene, name, x, z, width, depth, mat, y = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeGableRoof(width, depth, rise, color) {
  const hw = width / 2;
  const hd = depth / 2;
  const y0 = 0;
  const yr = rise;
  const positions = [
    // front triangular gable
    -hw,y0,hd,  hw,y0,hd,  0,yr,hd,
    // back triangular gable
    hw,y0,-hd, -hw,y0,-hd, 0,yr,-hd,
    // left and right roof slopes, each split into two triangles
    -hw,y0,hd, -hw,y0,-hd, 0,yr,-hd,
    -hw,y0,hd, 0,yr,-hd, 0,yr,hd,
    hw,y0,-hd, hw,y0,hd, 0,yr,hd,
    hw,y0,-hd, 0,yr,hd, 0,yr,-hd
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.93, side: THREE.DoubleSide, flatShading: true })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addWindow(scene, group, x, y, z, facing, width = 1.05, height = 1.1) {
  const frame = material("windowFrame", 0xe0ded3, 0.72);
  const glass = material("windowGlass", 0x607b83, 0.28, { metalness: 0.14, emissive: 0x17262b, emissiveIntensity: 0.12 });
  const horizontal = new THREE.Group();
  const sign = facing === "front" ? 1 : -1;
  const frameDepth = 0.13;
  const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.045), glass);
  pane.position.z = sign * 0.025;
  horizontal.add(pane);

  const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.09, height + 0.16, frameDepth), frame);
  trimLeft.position.x = -width / 2 - 0.045;
  const trimRight = trimLeft.clone();
  trimRight.position.x = width / 2 + 0.045;
  const trimTop = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.09, frameDepth), frame);
  trimTop.position.y = height / 2 + 0.045;
  const trimBottom = trimTop.clone();
  trimBottom.position.y = -height / 2 - 0.045;
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.055, height, frameDepth + 0.01), frame);
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.055, frameDepth + 0.01), frame);
  for (const piece of [trimLeft, trimRight, trimTop, trimBottom, mullion, crossbar]) {
    piece.position.z = sign * 0.04;
    horizontal.add(piece);
  }

  horizontal.position.set(x, y, z);
  if (facing === "back") horizontal.rotation.y = Math.PI;
  group.add(horizontal);
}

function addSideWindow(group, x, y, z, depth = 1.35, height = 0.95) {
  const frame = material("windowFrame", 0xe0ded3, 0.72);
  const glass = material("windowGlass", 0x607b83, 0.28, { metalness: 0.14, emissive: 0x17262b, emissiveIntensity: 0.12 });
  const windowGroup = new THREE.Group();
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.045, height, depth), glass);
  windowGroup.add(pane);
  for (const side of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.13, height + 0.16, 0.13), frame);
    trim.position.x = 0;
    trim.position.z = side * (depth / 2 + 0.045);
    windowGroup.add(trim);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, depth + 0.2), frame);
  top.position.y = height / 2 + 0.045;
  const bottom = top.clone();
  bottom.position.y = -height / 2 - 0.045;
  windowGroup.add(top, bottom);
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.13, height, 0.055), frame);
  windowGroup.add(mullion);
  windowGroup.position.set(x, y, z);
  windowGroup.rotation.y = Math.PI / 2;
  group.add(windowGroup);
}

function addDoor(scene, group, x, y, z, color, facing = "front") {
  const door = new THREE.Group();
  const frame = material("doorFrame", 0xe0d7c9, 0.8);
  const panel = material("doorPanel" + color, color, 0.84);
  const knob = material("doorKnob", 0xa6a08c, 0.42, { metalness: 0.45 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.2, 0.17), panel);
  slab.position.y = 1.1;
  door.add(slab);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.34, 0.22), frame);
  left.position.set(-0.58, 1.17, 0.025);
  const right = left.clone();
  right.position.x = 0.58;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.27, 0.12, 0.22), frame);
  top.position.set(0, 2.28, 0.025);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), knob);
  handle.position.set(0.37, 1.05, 0.115);
  door.add(left, right, top, handle);
  door.position.set(x, y, z);
  if (facing === "back") door.rotation.y = Math.PI;
  group.add(door);
}

function makeProceduralHouse(scene, index, x, z, colliders) {
  const group = new THREE.Group();
  group.name = `procedural-house-${String(index + 1).padStart(2, "0")}`;
  const archetype = index % 6;
  const width = [9.2, 10.5, 9.6, 11.2, 9.8, 10.2][archetype] * (index % 4 === 0 ? 1.04 : 1);
  const depth = [9.5, 8.7, 10.4, 9.2, 10.8, 8.9][archetype];
  const stories = archetype === 3 || archetype === 5 ? 2 : 1;
  const bodyHeight = stories === 2 ? 5.45 : 3.35;
  const roofRise = archetype === 1 ? 0 : archetype === 2 ? 1.65 : 2.1;
  const bodyColor = PALETTE[index % PALETTE.length];
  const roofColor = ROOF_PALETTE[(index * 3 + archetype) % ROOF_PALETTE.length];
  const roofMat = material("roof" + roofColor, roofColor, 0.94);
  const bodyMat = material("wall" + bodyColor, bodyColor, 0.98);
  const trim = material("creamTrim", 0xded9cc, 0.82);
  const foundation = material("foundation", 0x777c78, 0.97);
  const facing = index % 3 === 1 ? "back" : "front";
  const front = depth / 2 + 0.055;

  const slab = new THREE.Mesh(new THREE.BoxGeometry(width + 0.45, 0.26, depth + 0.45), foundation);
  slab.position.y = 0.13;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, bodyHeight, depth), bodyMat);
  body.position.y = 0.26 + bodyHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.22, depth + 0.14), trim);
  plinth.position.y = 0.33;
  group.add(plinth);

  const roofBaseY = 0.26 + bodyHeight;
  if (archetype === 1) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.28, depth + 0.5), roofMat);
    roof.position.y = roofBaseY + 0.12;
    roof.castShadow = true;
    group.add(roof);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.54, 0.48, 0.18), trim);
    parapet.position.set(0, roofBaseY + 0.36, -depth / 2 - 0.1);
    group.add(parapet);
  } else if (archetype === 2) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.73, 2.0, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = roofBaseY + 0.98;
    roof.scale.z = depth / width;
    roof.castShadow = true;
    group.add(roof);
    const eaves = new THREE.Mesh(new THREE.BoxGeometry(width + 0.55, 0.16, depth + 0.55), trim);
    eaves.position.y = roofBaseY + 0.07;
    group.add(eaves);
  } else {
    const roof = makeGableRoof(width + 0.62, depth + 0.62, roofRise, roofColor);
    roof.position.y = roofBaseY + 0.02;
    group.add(roof);
    const eaves = new THREE.Mesh(new THREE.BoxGeometry(width + 0.56, 0.16, depth + 0.56), trim);
    eaves.position.y = roofBaseY + 0.02;
    group.add(eaves);
  }

  // Main entrance and front windows.
  const doorX = archetype === 4 ? -width * 0.2 : 0;
  addDoor(scene, group, doorX, 0.42, front, [0x6a574b, 0x63736e, 0x75645a, 0x545d60][index % 4], facing);
  const windowY = 0.26 + (stories === 2 ? 2.15 : 1.95);
  const frontZ = facing === "front" ? front : -front;
  addWindow(scene, group, -width * 0.28, windowY, frontZ, facing);
  addWindow(scene, group, width * 0.28, windowY, frontZ, facing);

  if (stories === 2) {
    addWindow(scene, group, -width * 0.25, 0.26 + 4.55, frontZ, facing, 0.95, 1.0);
    addWindow(scene, group, width * 0.25, 0.26 + 4.55, frontZ, facing, 0.95, 1.0);
  }

  // Gable vents, chimney, porch and entrance steps.
  if (archetype !== 1) {
    const vent = new THREE.Mesh(new THREE.CircleGeometry(0.15, 10), material("vent", 0x6e7877, 0.85));
    vent.position.set(0, roofBaseY + roofRise * 0.62, frontZ + (facing === "front" ? 0.1 : -0.1));
    if (facing === "back") vent.rotation.y = Math.PI;
    group.add(vent);
  }

  if (index % 3 !== 1) {
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.45, 0.8), material("chimney", 0xa29e91, 0.95));
    chimney.position.set(width * 0.29, roofBaseY + roofRise + 0.18, -depth * 0.15);
    chimney.castShadow = true;
    group.add(chimney);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.95), roofMat);
    cap.position.set(chimney.position.x, chimney.position.y + 0.8, chimney.position.z);
    group.add(cap);
  }

  if (archetype === 0 || archetype === 4) {
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 1.7), roofMat);
    porchRoof.position.set(doorX, 2.82, front + 0.75);
    group.add(porchRoof);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.35, 0.15), trim);
      post.position.set(doorX + side * 1.55, 1.5, front + 1.32);
      group.add(post);
    }
  }

  const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.17, 0.45), trim);
  step.position.set(doorX, 0.32, front + 0.38);
  group.add(step);

  // Small side windows add depth while keeping the street facade legible.
  addSideWindow(group, width / 2 + 0.08, 2.0, 0, 1.35, 0.95);
  group.rotation.y = index % 4 === 2 ? Math.PI : 0;
  group.position.set(x, 0, z);
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  colliders.push({
    name: group.name,
    minX: box.min.x - 0.18,
    maxX: box.max.x + 0.18,
    minZ: box.min.z - 0.18,
    maxZ: box.max.z + 0.18
  });

  return group;
}

async function loadHousePack() {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(MODEL_URL);
    const roots = gltf.scene.children.filter(child => /^house_\d+$/.test(child.name));
    if (!roots.length) throw new Error("No house_1…house_20 roots were found in the GLB.");
    gltf.scene.updateMatrixWorld(true);
    return roots.map(root => {
      const clone = root.clone(true);
      clone.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (Array.isArray(object.material)) object.material = object.material.map(item => item.clone());
        else if (object.material) object.material = object.material.clone();
      });
      return clone;
    });
  } catch (error) {
    console.info("Optional house GLB not found; using the built-in low-poly house set.", error);
    return [];
  }
}

function placeImportedHouse(scene, model, index, x, z, colliders) {
  const group = new THREE.Group();
  group.name = `house-${String(index + 1).padStart(2, "0")}`;
  const instance = model.clone(true);
  instance.updateMatrixWorld(true);
  const sourcePosition = instance.position.clone();
  let bounds = new THREE.Box3().setFromObject(instance);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const targetWidth = [9.2, 10.1, 9.4, 10.4, 9.6][index % 5];
  const targetDepth = [9.4, 8.7, 10.2, 9.5, 10.4][index % 5];
  const fitScale = Math.min(
    targetWidth / Math.max(size.x, 0.01),
    targetDepth / Math.max(size.z, 0.01),
    1.5
  );

  // Keep each Blender object's authored scale. The source GLB stores the six
  // roots in an off-centre layout, so fit the complete world transform together.
  instance.position.set(
    (sourcePosition.x - center.x) * fitScale,
    (sourcePosition.y - bounds.min.y) * fitScale,
    (sourcePosition.z - center.z) * fitScale
  );
  instance.scale.multiplyScalar(fitScale);
  instance.rotation.y = index % 4 === 2 ? Math.PI : 0;

  // Give each placed house its own subtle facade tint without mutating templates.
  const tint = PALETTE[index % PALETTE.length];
  instance.traverse(object => {
    if (!object.isMesh || !object.material) return;
    if (Array.isArray(object.material)) {
      object.material = object.material.map(sourceMaterial => {
        const clone = sourceMaterial.clone();
        clone.color?.setHex(tint);
        return clone;
      });
    } else {
      object.material = object.material.clone();
      object.material.color?.setHex(tint);
    }
  });

  group.add(instance);
  group.position.set(x, 0, z);
  scene.add(group);
  group.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(group);
  colliders.push({
    name: group.name,
    minX: bounds.min.x - 0.22,
    maxX: bounds.max.x + 0.22,
    minZ: bounds.min.z - 0.22,
    maxZ: bounds.max.z + 0.22
  });
  return group;
}

function addRoad(scene, x, z, width, length, horizontal = false) {
  const asphalt = material("asphalt", 0x3e4546, 0.98);
  const road = makePlane(
    scene,
    "asphalt-road",
    x,
    z,
    horizontal ? length : width,
    horizontal ? width : length,
    asphalt,
    0.012
  );
  road.renderOrder = 1;

  const sidewalkMat = material("sidewalk", 0x9d9d92, 0.98);
  const curbMat = material("curb", 0xc0beb2, 0.95);
  const sidewalkWidth = 1.85;
  for (const side of [-1, 1]) {
    const offset = width / 2 + sidewalkWidth / 2;
    makePlane(
      scene,
      "sidewalk",
      x + (horizontal ? 0 : side * offset),
      z + (horizontal ? side * offset : 0),
      horizontal ? length : sidewalkWidth,
      horizontal ? sidewalkWidth : length,
      sidewalkMat,
      0.035
    );
    const curbLength = horizontal ? length : 0.22;
    const curbDepth = horizontal ? 0.22 : length;
    const curb = makeBox(
      scene,
      "road-curb",
      x + (horizontal ? 0 : side * (width / 2 + 0.1)),
      0.02,
      z + (horizontal ? side * (width / 2 + 0.1) : 0),
      curbLength,
      0.16,
      curbDepth,
      curbMat
    );
    curb.receiveShadow = true;
  }
}

function addRoadMarkings(scene) {
  const paint = material("roadPaint", 0xd0d0c1, 0.95, { roughness: 1 });
  for (const x of VERTICAL_ROADS) {
    for (let z = -56; z <= 56; z += 8) {
      makePlane(scene, "lane-marking", x, z, 0.13, 3.1, paint, 0.025);
    }
  }
  for (const z of HORIZONTAL_ROADS) {
    for (let x = -56; x <= 56; x += 8) {
      makePlane(scene, "lane-marking", x, z, 3.1, 0.13, paint, 0.025);
    }
  }

  const stop = material("stopLine", 0xe3e0d2, 1);
  for (const x of VERTICAL_ROADS) {
    for (const z of HORIZONTAL_ROADS) {
      for (const side of [-1, 1]) {
        makePlane(scene, "junction-line", x + side * 4.4, z, 0.18, 5.8, stop, 0.027);
      }
    }
  }
}

function addTree(scene, x, z, size = 1, colliders = null) {
  const trunkMat = material("treeTrunk", 0x675548, 1);
  const leaves = [
    material("treeLeavesA", 0x586d58, 1),
    material("treeLeavesB", 0x687c60, 1),
    material("treeLeavesC", 0x7b8462, 1)
  ];
  const trunk = makeBox(scene, "tree-trunk", x, 0, z, 0.35 * size, 2.0 * size, 0.35 * size, trunkMat, { solid: true, colliders });
  const canopy1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45 * size, 1), leaves[Math.abs(Math.floor(x * 0.7 + z * 0.4)) % 3]);
  canopy1.position.set(x, 3.1 * size, z);
  canopy1.scale.set(1, 1.18, 1);
  canopy1.castShadow = true;
  canopy1.receiveShadow = true;
  scene.add(canopy1);
  const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * size, 0), leaves[Math.abs(Math.floor(x * 0.2 - z)) % 3]);
  canopy2.position.set(x + 0.62 * size, 3.7 * size, z - 0.2 * size);
  canopy2.castShadow = true;
  scene.add(canopy2);
  return trunk;
}

function addStreetLamp(scene, x, z, colliders = null, lampHeads = []) {
  const pole = material("streetLampPole", 0x4b5353, 0.6, { metalness: 0.48 });
  const light = material("streetLampLight", 0xf0e4ba, 0.35, { emissive: 0x6d5832, emissiveIntensity: 0.42 });
  makeBox(scene, "street-lamp-post", x, 0, z, 0.16, 5.0, 0.16, pole, { solid: true, colliders });
  makeBox(scene, "street-lamp-arm", x + 0.7, 4.85, z, 1.4, 0.13, 0.13, pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.48), light);
  head.name = "street-lamp-head";
  head.position.set(x + 1.25, 4.72, z);
  head.castShadow = true;
  scene.add(head);
  lampHeads.push(head);
}

function addMailbox(scene, x, z, id, color) {
  const post = material("mailboxPost", 0x4f5553, 0.75);
  const box = material("mailboxBox" + color, color, 0.65, { metalness: 0.08 });
  makeBox(scene, `mailbox-post-${id}`, x, 0, z, 0.12, 0.95, 0.12, post, { solid: false });
  makeBox(scene, `mailbox-${id}`, x, 0.86, z, 0.72, 0.46, 0.52, box);
}

function addFence(scene, x, z, width, color = 0xd0ccbc) {
  const fenceMat = material("fence" + color, color, 0.95);
  const postMat = material("fencePost" + color, color, 0.95);
  const half = width / 2;
  makeBox(scene, "garden-fence-rail", x, 0.34, z, width, 0.12, 0.12, fenceMat);
  makeBox(scene, "garden-fence-rail", x, 0.72, z, width, 0.11, 0.11, fenceMat);
  const count = Math.max(2, Math.floor(width / 1.0));
  for (let i = 0; i <= count; i++) {
    const px = x - half + (width * i) / count;
    makeBox(scene, "garden-fence-post", px, 0, z, 0.12, 0.95, 0.15, postMat);
  }
}

function addSign(scene, colliders, interactables, showToast) {
  const metal = material("signMetal", 0x424b4d, 0.72, { metalness: 0.28 });
  const boardMat = material("signBoard", 0xd7ff76, 0.85, { emissive: 0x202d0e, emissiveIntensity: 0.16 });
  makeBox(scene, "district-sign-post-left", 4.3, 0, 53.6, 0.18, 2.9, 0.18, metal);
  makeBox(scene, "district-sign-post-right", 9.7, 0, 53.6, 0.18, 2.9, 0.18, metal);
  makeBox(scene, "district-sign-board", 7.0, 2.0, 53.6, 6.0, 1.25, 0.22, boardMat);

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d7ff76";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#151a12";
  ctx.font = "bold 68px monospace";
  ctx.fillText("SEVERNI CT VRT", 48, 110);
  ctx.font = "32px monospace";
  ctx.fillText("RESIDENTIAL DISTRICT  /  20 HOMES", 52, 178);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(5.72, 1.0),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  face.position.set(7.0, 2.0, 53.475);
  scene.add(face);

  interactables.push({
    id: "district-sign",
    x: 7.0,
    z: 51.5,
    range: 3.4,
    action() {
      showToast("SEVERNÍ ČTVRŤ · 20 DOMŮ · 6 VARIANT");
    }
  });
}

function addParkedCar(scene, x, z, bodyColor, colliders, index) {
  const body = material(`carBody-${bodyColor}`, bodyColor, 0.56, { metalness: 0.12 });
  const glass = material("carGlass", 0x34454c, 0.24, { metalness: 0.16 });
  const trim = material("carTrim", 0x343b3d, 0.8);
  const headlights = material("carHeadlights", 0xd9d2b9, 0.35, {
    emissive: 0x3b3524,
    emissiveIntensity: 0.28
  });
  const taillights = material("carTaillights", 0x8d4038, 0.5, {
    emissive: 0x240907,
    emissiveIntensity: 0.18
  });

  makeBox(scene, `parked-car-${index}-body`, x, 0.34, z, 1.92, 0.72, 4.1, body, {
    solid: true,
    colliders
  });
  makeBox(scene, `parked-car-${index}-cabin`, x, 1.02, z - 0.12, 1.62, 0.74, 2.35, glass);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.11, 1.48), body);
  roof.position.set(x, 1.79, z - 0.16);
  roof.castShadow = true;
  scene.add(roof);

  const wheelGeometry = new THREE.CylinderGeometry(0.39, 0.39, 0.22, 10);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeometry, trim);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x + side * 0.94, 0.43, z + end * 1.28);
      wheel.castShadow = true;
      scene.add(wheel);
    }
    makeBox(scene, `car-headlamp-${index}`, x + side * 0.64, 0.66, z + 1.96, 0.28, 0.19, 0.055, headlights);
    makeBox(scene, `car-taillamp-${index}`, x + side * 0.64, 0.66, z - 1.96, 0.28, 0.19, 0.055, taillights);
  }
}

function addDistantLandscape(scene) {
  const hillColors = [0x788674, 0x82907b, 0x707f72, 0x89917c];

  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const radius = 96 + (i % 3) * 5;
    const color = hillColors[i % hillColors.length];
    const hill = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      material(`distantHill-${color}`, color, 1)
    );
    const scale = 13 + (i % 4) * 3.4;
    hill.position.set(Math.cos(angle) * radius, 1.2, Math.sin(angle) * radius);
    hill.scale.set(scale * 1.6, scale * 0.68, scale * 1.15);
    hill.rotation.y = angle * 0.7;
    hill.receiveShadow = true;
    scene.add(hill);
  }

  // A sparse tree belt gives the neighborhood a natural silhouette beyond
  // the playable district boundary without adding unnecessary collision checks.
  const perimeterTrees = [];
  for (let x = -72; x <= 72; x += 12) {
    perimeterTrees.push([x, -77], [x, 77]);
  }
  for (let z = -65; z <= 65; z += 13) {
    perimeterTrees.push([-77, z], [77, z]);
  }

  perimeterTrees.forEach(([x, z], index) => {
    if (Math.abs(x) < 31 && Math.abs(z) < 31) return;
    addTree(scene, x, z, 0.9 + (index % 4) * 0.08, null);
  });
}

export async function buildResidentialWorld(scene, { showToast = () => {} } = {}) {
  const colliders = [];
  const interactables = [];
  const lampHeads = [];
  const optionalModels = await loadHousePack();

  scene.background = new THREE.Color(0xa8b8bf);
  scene.fog = new THREE.Fog(0xa8b8bf, 92, 176);

  const ground = makePlane(
    scene,
    "district-ground",
    0,
    0,
    160,
    160,
    material("ground", 0x77806f, 1),
    -0.06
  );

  // Broad green lots make each house read as part of a neighborhood, not a test grid.
  for (let row = 0; row < HOUSE_ROWS.length; row++) {
    for (let col = 0; col < HOUSE_COLUMNS.length; col++) {
      const x = HOUSE_COLUMNS[col];
      const z = HOUSE_ROWS[row];
      makePlane(
        scene,
        "residential-lot",
        x,
        z,
        18.0,
        17.2,
        material("yard" + GARDEN_PALETTE[(row * 3 + col) % GARDEN_PALETTE.length], GARDEN_PALETTE[(row * 3 + col) % GARDEN_PALETTE.length], 1),
        -0.015
      );
    }
  }

  // Main road network and raised pedestrian paths.
  for (const x of VERTICAL_ROADS) addRoad(scene, x, 0, 7.2, 132, false);
  for (const z of HORIZONTAL_ROADS) addRoad(scene, 0, z, 7.2, 132, true);
  addRoadMarkings(scene);

  // Small driveways, gardens and the twenty houses.
  let houseIndex = 0;
  for (let row = 0; row < HOUSE_ROWS.length; row++) {
    for (let col = 0; col < HOUSE_COLUMNS.length; col++) {
      const x = HOUSE_COLUMNS[col];
      const z = HOUSE_ROWS[row];
      const index = houseIndex++;
      const frontDirection = index % 3 === 1 ? -1 : 1;
      const driveway = material("driveway", 0x85877e, 0.98);
      makePlane(scene, "driveway", x, z + frontDirection * 5.65, 3.3, 5.0, driveway, 0.008);

      if (optionalModels.length) {
        placeImportedHouse(scene, optionalModels[index % optionalModels.length], index, x, z, colliders);
      } else {
        makeProceduralHouse(scene, index, x, z, colliders);
      }

      // Low hedges and side fence sections frame the garden without blocking paths.
      const hedgeMat = material("hedge", 0x536a56, 1);
      for (const side of [-1, 1]) {
        const hedge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 5.8), hedgeMat);
        hedge.position.set(x + side * 7.45, 0.34, z);
        hedge.castShadow = true;
        hedge.receiveShadow = true;
        scene.add(hedge);
      }
      // Two short fence sections leave a clear path to the entrance.
      addFence(scene, x - 3.2, z + 7.8 * frontDirection, 2.2, index % 2 ? 0xc8c3b6 : 0xbab7ac);
      addFence(scene, x + 3.2, z + 7.8 * frontDirection, 2.2, index % 2 ? 0xc8c3b6 : 0xbab7ac);
      addMailbox(scene, x - 5.3, z + 6.1 * frontDirection, `H${String(index + 1).padStart(2, "0")}`, index % 2 ? 0x657b76 : 0x596d78);

      // One tree and a small flower bed per lot.
      const treeX = x + (col % 2 === 0 ? 5.9 : -5.9);
      const treeZ = z + (row % 2 === 0 ? -5.7 : 5.7);
      addTree(scene, treeX, treeZ, 0.78 + (index % 3) * 0.07, colliders);
      const flowerBed = makeBox(
        scene,
        "garden-flower-bed",
        x + (col % 2 === 0 ? -5.4 : 5.4),
        0.02,
        z - frontDirection * 5.0,
        2.2,
        0.16,
        0.7,
        material("flowerBed", 0x5c624e, 1)
      );
      const flowerColors = [0xd3b9a5, 0xb8c2ad, 0xc5c4a7];
      for (let i = 0; i < 3; i++) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 7, 5),
          material("flower" + flowerColors[i], flowerColors[i], 0.82)
        );
        flower.position.set(flowerBed.position.x - 0.55 + i * 0.55, 0.28, flowerBed.position.z);
        scene.add(flower);
      }

      if (index % 4 === 0) {
        interactables.push({
          id: `home-${index + 1}`,
          x: x,
          z: z + frontDirection * 6.6,
          range: 2.5,
          action() {
            showToast(`DŮM ${String(index + 1).padStart(2, "0")} · MODEL ${optionalModels.length ? "BLENDER PACK" : "LOW-POLY"}`);
          }
        });
      }
    }
  }

  // Trees along the district edges and small street furniture.
  for (let z = -50; z <= 50; z += 20) {
    addTree(scene, -56.5, z, 0.9, colliders);
    addTree(scene, 56.5, z, 0.9, colliders);
  }
  for (let x = -50; x <= 50; x += 20) {
    addTree(scene, x, -57, 0.88, colliders);
  }

  for (const x of VERTICAL_ROADS) {
    for (const z of [-55, -22, 22, 48]) addStreetLamp(scene, x + 5.6, z, colliders, lampHeads);
  }
  for (const z of HORIZONTAL_ROADS) {
    for (const x of [-54, -8, 8, 54]) addStreetLamp(scene, x, z + 5.4, colliders, lampHeads);
  }

  // A few benches, bins and parking bays give the street scale.
  const benchWood = material("benchWood", 0x8b7966, 0.98);
  const benchMetal = material("benchMetal", 0x4e5757, 0.7, { metalness: 0.3 });
  const binMat = material("streetBin", 0x687371, 0.78);
  for (const [x, z] of [[-5.8, -6.7], [5.8, 16.8], [-31.8, 16.8], [31.8, -27.8]]) {
    makeBox(scene, "street-bench-seat", x, 0.48, z, 1.9, 0.14, 0.52, benchWood);
    makeBox(scene, "street-bench-back", x, 0.9, z - 0.2, 1.9, 0.62, 0.13, benchWood);
    for (const side of [-1, 1]) makeBox(scene, "street-bench-leg", x + side * 0.72, 0, z, 0.12, 0.48, 0.12, benchMetal);
    makeBox(scene, "street-bin", x + 1.5, 0, z + 0.7, 0.48, 0.84, 0.48, binMat, { solid: true, colliders });
  }

  // Parked cars occupy a few marked curbside bays and add street scale.
  const parkedCars = [
    [-31.9, -44, 0x87969a],
    [-20.1, 0, 0x9b8772],
    [20.1, 44, 0x687c78],
    [31.9, -22, 0xb2a99a],
    [-31.9, 22, 0x788b9b],
    [20.1, -44, 0xa17a6c]
  ];
  parkedCars.forEach(([x, z, color], index) => {
    addParkedCar(scene, x, z, color, colliders, index + 1);
  });

  // Parking spaces run alongside the outer edges of the main streets.
  const parkingLine = material("parkingPaint", 0xb3b5a9, 0.96);
  const parkingSurface = material("parkingSurface", 0x777b73, 1);
  for (const x of [-26, 26]) {
    for (const z of [-44, -22, 0, 22, 44]) {
      for (const side of [-1, 1]) {
        const bayX = x + side * 5.9;
        makePlane(scene, "parking-bay-surface", bayX, z, 2.45, 5.65, parkingSurface, 0.039);
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 5.1), parkingLine);
        mark.position.set(bayX, 0.052, z);
        scene.add(mark);
        const endMark = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.018, 0.1), parkingLine);
        endMark.position.set(x + side * 4.9, 0.052, z - 2.55);
        scene.add(endMark);
      }
    }
  }

  addSign(scene, colliders, interactables, showToast);
  addDistantLandscape(scene);

  // A low, tree-lined perimeter keeps the player inside the district.
  for (const x of [-63, 63]) {
    makeBox(scene, "district-boundary-wall", x, 0, 0, 0.45, 1.2, 130, material("boundaryWall", 0x6b756e, 1), { solid: true, colliders });
  }
  for (const z of [-63, 63]) {
    makeBox(scene, "district-boundary-wall", 0, 0, z, 126, 1.2, 0.45, material("boundaryWall", 0x6b756e, 1), { solid: true, colliders });
  }

  const totalHouses = HOUSE_COLUMNS.length * HOUSE_ROWS.length;
  return {
    colliders,
    interactables,
    totalHouses,
    usingImportedModels: optionalModels.length > 0,
    update(time) {
      // Very subtle shimmer in street fixtures, not a distracting animation.
      const phase = 0.92 + Math.sin(time * 0.00055) * 0.035;
      for (const head of lampHeads) head.material.emissiveIntensity = phase;
    },
    dispose() {
      // Shared materials and geometries are owned by the Three.js scene.
    }
  };
}
