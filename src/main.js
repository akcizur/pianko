import * as THREE from "three";
import { createPlayerController } from "./core/player-controller.js";
import { bindInput } from "./core/input-controller.js";
import { createGameAudio } from "./core/game-audio.js";

const $ = (id) => document.getElementById(id);
const mount = $("game");
const menu = $("menuScreen");
const pauseScreen = $("pauseScreen");
const hint = $("hint");
const coordinates = $("coordinates");
const audio = createGameAudio();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08090b);
const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.35 : 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = "screenCanvas";
renderer.domElement.setAttribute("aria-label", "MÍR 12 — FPS gameplay");
renderer.domElement.tabIndex = 0;
mount.appendChild(renderer.domElement);

const state = { started: false, paused: false, combat: false, dialogue: false, inVehicle: false, inventory: false };
const controller = createPlayerController({
  camera,
  colliders: [],
  interactables: [],
  state,
  ui: { showToast: (message) => { hint.textContent = message; } },
  navigation: { bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 } }
});
controller.setSpawn({ x: 0, z: 0, yaw: 0 });

function setPaused(paused) {
  state.paused = paused;
  pauseScreen.hidden = !paused;
  if (paused) input.clear();
  else renderer.domElement.focus();
}
function startGame() {
  menu.hidden = true;
  state.started = true;
  audio.unlock();
  renderer.domElement.focus();
  if (matchMedia("(pointer: fine)").matches) renderer.domElement.requestPointerLock?.().catch?.(() => {});
}
const input = bindInput({
  element: renderer.domElement,
  controller,
  state,
  onInteract: () => { hint.textContent = "V této gameplay-only verzi není připojen herní svět ani objekty k interakci."; },
  onPauseChange: setPaused,
  onTogglePhone: () => { hint.textContent = "Telefon není součástí čistého FPS základu."; },
  onToggleInventory: () => { hint.textContent = "Inventář není součástí čistého FPS základu."; },
  touchRoot: document
});

$("resumeButton").addEventListener("click", () => input.resume());
$("pauseMenuButton").addEventListener("click", () => {
  input.resume();
  state.started = false;
  menu.hidden = false;
  if (document.pointerLockElement) document.exitPointerLock?.();
});
for (const button of document.querySelectorAll("[data-menu]")) {
  button.addEventListener("click", () => {
    const action = button.dataset.menu;
    if (action === "continue" || action === "new") startGame();
    if (action === "controls") {
      $("menuMain").hidden = true;
      $("menuControls").hidden = false;
    }
    if (action === "back") {
      $("menuMain").hidden = false;
      $("menuControls").hidden = true;
    }
  });
}
$("menuControlsBack").addEventListener("click", () => {
  $("menuMain").hidden = false;
  $("menuControls").hidden = true;
});
window.addEventListener("pointerdown", () => audio.unlock(), { once: true, capture: true });
window.addEventListener("keydown", () => audio.unlock(), { once: true, capture: true });

function resize() {
  const width = Math.max(1, mount.clientWidth);
  const height = Math.max(1, mount.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(mount);
resize();

let previousTime = performance.now();
let nextStep = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  if (state.started && !state.paused) {
    controller.update(dt);
    const player = controller.player;
    coordinates.textContent = `X ${player.x.toFixed(2)} · Z ${player.z.toFixed(2)}`;
    const moving = Math.hypot(controller.getAnalogMove().x, controller.getAnalogMove().y) > 0.1 ||
      Object.values(controller.keysDown).some(Boolean);
    if (moving && now > nextStep) {
      audio.step();
      nextStep = now + ((controller.keysDown.ShiftLeft || controller.keysDown.ShiftRight) ? 340 : 500);
    }
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  input.destroy();
  resizeObserver.disconnect();
  renderer.dispose();
});
