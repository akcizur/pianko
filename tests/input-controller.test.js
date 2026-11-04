import test from "node:test";
import assert from "node:assert/strict";
import { bindInput } from "../src/core/input-controller.js";

class EventHub {
  listeners = new Map();
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(type, callbacks);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, event) { for (const callback of this.listeners.get(type) ?? []) callback(event); }
}

class MockElement extends EventHub {
  constructor(action = "") {
    super();
    this.dataset = action ? { touchAction: action } : {};
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.style = {};
    this.isContentEditable = false;
  }
  matches() { return false; }
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() { return false; }
}

function installHarness(onVehicleLook = () => {}, onTogglePhone = () => {}, onToggleInventory = () => {}, onToggleVehicleView = () => {}) {
  const names = ["window", "document", "Element", "navigator", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const window = new EventHub();
  const jump = new MockElement("jump");
  const run = new MockElement("run");
  const interact = new MockElement("interact");
  const pause = new MockElement("pause");
  const phone = new MockElement("phone");
  const inventory = new MockElement("inventory");
  const view = new MockElement("view");
  const look = new MockElement();
  const root = new EventHub();
  root.getElementById = () => null;
  root.querySelector = selector => selector === "#touchLookZone" ? look : selector.includes("data-touch-action") ? run : null;
  root.querySelectorAll = () => [jump, run, interact, pause, phone, inventory, view];
  root.pointerLockElement = null;
  root.hidden = false;
  const frames = [];
  let gamepad = null;
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: root });
  Object.defineProperty(globalThis, "Element", { configurable: true, value: MockElement });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { getGamepads: () => gamepad ? [gamepad] : [] } });
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: callback => (frames.push(callback), frames.length) });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: () => {} });

  const element = new MockElement();
  const state = { started: true, paused: false, combat: false, dialogue: false, inVehicle: true };
  const controller = { player: { yaw: 0, pitch: 0 }, keysDown: Object.create(null), setAnalogMove() {}, jump() {} };
  const input = bindInput({ element, controller, state, touchRoot: root, onVehicleLook, onTogglePhone, onToggleInventory, onToggleVehicleView });
  return {
    state, controller, input, window, root, element, look, jump, run, interact, pause, phone, inventory, view, frames,
    setGamepad(value) { gamepad = value; },
    restore() {
      input.destroy();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    }
  };
}

test("vehicle flight uses Shift/Ctrl on keyboard, touch and gamepad", () => {
  const h = installHarness();
  try {
    const keyEvent = code => ({ code, target: null, repeat: false, preventDefault() {}, stopImmediatePropagation() {} });
    h.window.emit("keydown", keyEvent("ShiftLeft"));
    assert.equal(h.controller.keysDown.ShiftLeft, true);
    h.window.emit("keyup", keyEvent("ShiftLeft"));
    h.window.emit("keydown", keyEvent("ControlRight"));
    assert.equal(h.controller.keysDown.ControlRight, true);
    h.window.emit("keyup", keyEvent("ControlRight"));

    h.jump.emit("pointerdown", { pointerType: "touch", pointerId: 1, preventDefault() {} });
    h.run.emit("pointerdown", { pointerType: "touch", pointerId: 2, preventDefault() {} });
    assert.equal(h.controller.keysDown.ShiftLeft, true);
    assert.equal(h.controller.keysDown.ControlLeft, true);
    h.jump.emit("pointerup", { pointerId: 1 });
    h.run.emit("pointerup", { pointerId: 2 });
    assert.equal(h.controller.keysDown.ShiftLeft, false);
    assert.equal(h.controller.keysDown.ControlLeft, false);

    const buttons = Array.from({ length: 10 }, () => ({ pressed: false }));
    h.setGamepad({ connected: true, axes: [0, 0, 0, 0], buttons });
    const tick = () => h.frames.shift()();
    tick();
    buttons[7].pressed = true;
    tick();
    assert.equal(h.controller.keysDown.ShiftLeft, true, "right trigger raises the car");
    buttons[7].pressed = false;
    buttons[6].pressed = true;
    tick();
    assert.equal(h.controller.keysDown.ShiftLeft, false);
    assert.equal(h.controller.keysDown.ControlLeft, true, "left trigger lowers the car");
  } finally {
    h.restore();
  }
});


test("vehicle look reports mouse, touch and gamepad as distinct steering sources", () => {
  const calls = [];
  const h = installHarness((...args) => calls.push(args));
  try {
    h.root.pointerLockElement = h.element;
    h.root.emit("mousemove", { movementX: 8, movementY: 2 });
    assert.equal(calls.at(-1)[2], "mouse");
    h.look.emit("pointerdown", { pointerType: "touch", pointerId: 7, clientX: 10, clientY: 10, preventDefault() {} });
    h.window.emit("pointermove", { pointerType: "touch", pointerId: 7, clientX: 15, clientY: 12, cancelable: true, preventDefault() {} });
    assert.equal(calls.at(-1)[2], "touch");
    h.setGamepad({ connected: true, axes: [0, 0, 0.5, 0], buttons: Array.from({ length: 10 }, () => ({ pressed: false })) });
    h.frames.shift()();
    assert.equal(calls.at(-1)[2], "gamepad");
  } finally { h.restore(); }
});

test("T opens the held phone and I opens or closes inventory",()=>{
 let phoneToggles=0,inventoryToggles=0;
 const h=installHarness(()=>{},()=>phoneToggles++,()=>inventoryToggles++);
 try{
  h.state.inVehicle=false;
  const event=(code,repeat=false)=>({code,target:null,repeat,preventDefault(){},stopImmediatePropagation(){}});
  h.window.emit("keydown",event("KeyT"));h.window.emit("keydown",event("KeyT",true));
  h.window.emit("keydown",event("KeyI"));
  assert.equal(phoneToggles,1);assert.equal(inventoryToggles,1);
  h.state.inventory=true;h.window.emit("keydown",event("KeyI"));
  assert.equal(inventoryToggles,2);
  h.window.emit("keydown",event("KeyW"));
  assert.equal(h.controller.keysDown.KeyW,false);
 }finally{h.restore();}
});

test("V switches view only while driving and ignores key repeat",()=>{
 let views=0;const h=installHarness(()=>{},()=>{},()=>{},()=>views++);
 try{
  const key=(code,repeat=false)=>({code,target:null,repeat,preventDefault(){},stopImmediatePropagation(){}});
  h.window.emit("keydown",key("KeyV"));assert.equal(views,1);
  h.window.emit("keydown",key("KeyV",true));assert.equal(views,1);
  h.state.inVehicle=false;h.window.emit("keydown",key("KeyV"));assert.equal(views,1);
  h.state.inVehicle=true;h.state.paused=true;h.window.emit("keydown",key("KeyV"));assert.equal(views,1);
 }finally{h.restore();}
});


test("mobile utility buttons open phone, inventory and vehicle view",()=>{
 let phoneToggles=0,inventoryToggles=0,views=0;
 const h=installHarness(()=>{},()=>phoneToggles++,()=>inventoryToggles++,()=>views++);
 try{
  const tap=button=>button.emit("pointerdown",{pointerType:"touch",pointerId:44,preventDefault(){}});
  h.state.inVehicle=false;
  tap(h.phone);tap(h.inventory);tap(h.view);
  assert.equal(phoneToggles,1);
  assert.equal(inventoryToggles,1);
  assert.equal(views,0,"vehicle camera is unavailable while walking");
  h.state.inVehicle=true;
  tap(h.view);
  assert.equal(views,1,"the view button calls the vehicle camera action");
  tap(h.pause);
  assert.equal(h.state.paused,true,"the pause control opens pause state");
 }finally{h.restore();}
});
