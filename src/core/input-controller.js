// Unified keyboard, mouse, touch and Gamepad API input.
// Input sources are tracked independently so one device cannot cancel another.
export function bindInput({
  element,
  controller,
  state = { started: true, paused: false },
  onInteract = () => {},
  onPauseChange = () => {},
  onVehicleLook = () => {},
  onCombatAction = () => {},
  onDialogueAction = () => {},
  onMenuAction = () => {},
  onTogglePhone = () => {},
  onToggleInventory = () => {},
  onToggleVehicleView = () => {},
  touchRoot = document
}) {
  if (!element || !controller) {
    throw new TypeError("bindInput requires a render element and player controller.");
  }

  const { player, keysDown } = controller;
  const movementCodes = [
    "KeyW", "KeyA", "KeyS", "KeyD",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
  ];
  const sources = {
    keyboard: Object.create(null),
    touchButtons: Object.create(null),
    gamepad: Object.create(null)
  };
  const knownCodes = new Set([...movementCodes, "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight"]);
  const listeners = [];
  const runPointers = new Map();
  const jumpPointers = new Map();
  const sensitivity = {
    mouseX: 0.001,
    mouseY: 0.0009,
    touchX: 0.003,
    touchY: 0.002,
    gamepadLook: 2.2
  };

  let lookPointer = null;
  let previousGamepadButtons = [];
  let animationFrame = 0;
  let destroyed = false;

  const moveStick = touchRoot.getElementById?.("moveStick") ?? touchRoot.querySelector?.("#moveStick");
  const lookZone = touchRoot.getElementById?.("touchLookZone") ?? touchRoot.querySelector?.("#touchLookZone");
  let touchMove = { x: 0, y: 0 };
  const touchControlsEnabled = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  let movementJoystick = null;
  if (moveStick && touchControlsEnabled) {
    import("nipplejs").then(({ default: nipplejs }) => {
      if (destroyed) return;
      movementJoystick = nipplejs.create({
        zone: moveStick,
        mode: "static",
        position: { left: "50%", top: "50%" },
        size: 128,
        threshold: 0.1,
        fadeTime: 120,
        restOpacity: 0.52,
        restJoystick: true,
        color: {
          back: "rgba(10, 14, 16, 0.44)",
          front: "rgba(230, 237, 235, 0.30)"
        }
      });
      movementJoystick.on("start", () => moveStick.classList.add("active"));
      movementJoystick.on("move", event => {
        if (!state.started || state.paused || state.combat || state.dialogue || state.inventory) {
          touchMove = { x: 0, y: 0 };
          controller.setAnalogMove?.(0, 0);
          return;
        }
        const vector = event.data?.vector ?? { x: 0, y: 0 };
        const x = clamp(Number(vector.x) || 0, -1, 1);
        const y = clamp(Number(vector.y) || 0, -1, 1);
        const magnitude = Math.hypot(x, y);
        const deadZone = 0.12;
        const scale = magnitude <= deadZone ? 0 : Math.min(1, (magnitude - deadZone) / (1 - deadZone)) / Math.max(magnitude, 0.001);
        touchMove = { x: x * scale, y: y * scale };
        controller.setAnalogMove?.(touchMove.x, touchMove.y);
      });
      movementJoystick.on("end", () => {
        touchMove = { x: 0, y: 0 };
        controller.setAnalogMove?.(0, 0);
        moveStick.classList.remove("active");
      });
    }).catch(error => {
      console.warn("NippleJS touch joystick could not be initialized.", error);
    });
  }
  const resumeButton = touchRoot.getElementById?.("resumeButton") ?? touchRoot.querySelector?.("#resumeButton");

  function listen(target, type, callback, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setKey(code, pressed, source = "keyboard") {
    if (!sources[source]) sources[source] = Object.create(null);
    knownCodes.add(code);
    sources[source][code] = Boolean(pressed);
    keysDown[code] = Object.values(sources).some(sourceKeys => Boolean(sourceKeys[code]));
  }

  function clearSource(source) {
    const sourceKeys = sources[source];
    if (!sourceKeys) return;
    for (const code of Object.keys(sourceKeys)) {
      sourceKeys[code] = false;
      keysDown[code] = Object.values(sources).some(entry => Boolean(entry[code]));
    }
  }

  function endLook(event) {
    if (!lookPointer || (event && event.pointerId !== lookPointer.id)) return;
    const pointerId = lookPointer.id;
    lookPointer = null;
    lookZone?.classList.remove("active");
    try {
      if (lookZone?.hasPointerCapture?.(pointerId)) lookZone.releasePointerCapture(pointerId);
    } catch {}
  }

  function clearInput() {
    for (const source of Object.keys(sources)) clearSource(source);
    for (const code of knownCodes) keysDown[code] = false;
    runPointers.clear();
    jumpPointers.clear();
    touchRoot.querySelector?.('[data-touch-action="run"]')?.classList.remove("is-held");
    touchMove = { x: 0, y: 0 };
    controller.setAnalogMove?.(0, 0);
    endLook();
  }

  function setPaused(paused) {
    if (state.paused === paused) return;
    state.paused = paused;
    if (paused) {
      clearInput();
      if (document.pointerLockElement === element) document.exitPointerLock?.();
    }
    onPauseChange(paused);
  }

  function togglePause() {
    setPaused(!state.paused);
  }

  function requestPointerLock() {
    if (state.paused || !state.started || !element.requestPointerLock) return;
    const result = element.requestPointerLock();
    if (result?.catch) result.catch(() => {});
  }

  function onKeyDown(event) {
    const target = event.target;
    if (target instanceof Element && (
      target.matches("input, textarea, select") || target.isContentEditable
    )) return;

    if (event.code === "Escape") {
      if (state.inventory) { event.preventDefault(); event.stopImmediatePropagation(); onToggleInventory(); return; }
      if (!state.started || state.dialogue) return;
      event.preventDefault(); event.stopImmediatePropagation(); togglePause(); return;
    }
    if (event.code === "KeyV") {
      if (!event.repeat && state.started && !state.paused && !state.combat && !state.dialogue && state.inVehicle) {
        event.preventDefault();event.stopImmediatePropagation();onToggleVehicleView();
      }
      return;
    }
    if (event.code === "KeyT" || event.code === "KeyI") {
      if (!event.repeat && state.started && !state.paused && !state.combat && !state.dialogue &&
          (!state.inVehicle || event.code === "KeyI") && (!state.inventory || event.code === "KeyI")) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.code === "KeyT") onTogglePhone(); else onToggleInventory();
      }
      return;
    }
    if (event.code === "Enter" && state.paused) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPaused(false);
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (state.inventory) return;
      if (state.inVehicle) setKey("Space", !state.paused);
      else if (!event.repeat && !state.paused) controller.jump?.();
      return;
    }
    if (event.code === "KeyE") {
      if (!event.repeat && !state.paused && !state.dialogue && !state.inventory) onInteract();
      return;
    }
    if (movementCodes.includes(event.code)) {
      event.preventDefault();
      setKey(event.code, !state.paused && !state.combat && !state.dialogue && !state.inventory);
      return;
    }
    if (["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight"].includes(event.code)) {
      if (event.code.startsWith("Control")) event.preventDefault();
      setKey(event.code, !state.paused && !state.combat && !state.dialogue && !state.inventory);
    }
  }

  function onKeyUp(event) {
    if (movementCodes.includes(event.code)) event.preventDefault();
    if (knownCodes.has(event.code)) setKey(event.code, false);
  }

  listen(window, "keydown", onKeyDown, { capture: true });
  listen(window, "keyup", onKeyUp, { capture: true });
  listen(window, "blur", clearInput);
  listen(window, "pagehide", clearInput);
  // A rotation can interrupt an active iOS pointer without a reliable pointerup.
  listen(window, "orientationchange", clearInput);
  listen(document, "visibilitychange", () => {
    if (document.hidden) clearInput();
  });

  listen(element, "click", () => {
    if (matchMedia("(pointer:fine)").matches && !document.pointerLockElement) requestPointerLock();
  });

  listen(document, "mousemove", event => {
    if (document.pointerLockElement !== element || state.paused) return;
    if (state.inVehicle) {
      if (state.started) onVehicleLook(event.movementX * sensitivity.mouseX, event.movementY * sensitivity.mouseY, "mouse");
      return;
    }
    player.yaw -= event.movementX * sensitivity.mouseX;
    player.pitch = clamp(player.pitch - event.movementY * sensitivity.mouseY, -0.95, 1.3);
  });

  if (lookZone) {
    listen(lookZone, "pointerdown", event => {
      if (event.pointerType === "mouse" || state.paused || lookPointer) return;
      event.preventDefault();
      lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      lookZone.setPointerCapture?.(event.pointerId);
      lookZone.classList.add("active");
    });
    // Keep camera drag alive if Safari temporarily retargets the captured finger.
    listen(window, "pointermove", event => {
      if (!lookPointer || lookPointer.id !== event.pointerId) return;
      if (event.cancelable) event.preventDefault();
      const dx = event.clientX - lookPointer.x;
      const dy = event.clientY - lookPointer.y;
      lookPointer.x = event.clientX;
      lookPointer.y = event.clientY;
      if (state.inVehicle) {
        if (state.started) onVehicleLook(dx * sensitivity.touchX, dy * sensitivity.touchY, "touch");
        return;
      }
      player.yaw -= dx * sensitivity.touchX;
      player.pitch = clamp(player.pitch - dy * sensitivity.touchY, -0.95, 1.25);
    }, { passive: false, capture: true });
    listen(window, "pointerup", endLook, true);
    listen(window, "pointercancel", endLook, true);
    listen(lookZone, "lostpointercapture", endLook);
  }

  const touchButtons = touchRoot.querySelectorAll?.("[data-touch-action]") ?? [];
  for (const button of touchButtons) {
    const action = button.dataset.touchAction;

    if (["jump", "interact", "pause", "phone", "inventory", "view"].includes(action)) {
      const releaseJump = event => {
        if (event && !jumpPointers.has(event.pointerId)) return;
        if (event) jumpPointers.delete(event.pointerId);
        else jumpPointers.clear();
        for (const code of ["Space", "ShiftLeft"]) setKey(code, [...jumpPointers.values()].includes(code), "touchButtons");
      };
      listen(button, "pointerdown", event => {
        if (event.pointerType === "mouse" || state.paused || !state.started) return;
        event.preventDefault();
        if (action === "jump" && !state.combat && !state.dialogue && !state.inventory) {
          if (state.inVehicle) {
            jumpPointers.set(event.pointerId, "ShiftLeft");
            setKey("ShiftLeft", true, "touchButtons");
            button.setPointerCapture?.(event.pointerId);
          } else controller.jump?.();
        }
        if (action === "interact" && !state.combat && !state.dialogue && !state.inventory) onInteract();
        if (action === "pause") togglePause();
        if (action === "phone" && !state.combat && !state.dialogue && !state.inventory) onTogglePhone();
        if (action === "inventory" && !state.combat && !state.dialogue) onToggleInventory();
        if (action === "view" && state.inVehicle && !state.combat && !state.dialogue) onToggleVehicleView();
      });
      if (action === "jump") {
        listen(button, "pointerup", releaseJump);
        listen(button, "pointercancel", releaseJump);
        listen(button, "lostpointercapture", releaseJump);
      }
    }

    if (action === "run") {
      const releaseRun = event => {
        if (event && !runPointers.has(event.pointerId)) return;
        if (event) runPointers.delete(event.pointerId);
        else runPointers.clear();
        for (const code of ["ShiftLeft", "ControlLeft"]) setKey(code, [...runPointers.values()].includes(code), "touchButtons");
        button.classList.toggle("is-held", runPointers.size > 0);
      };
      listen(button, "pointerdown", event => {
        if (event.pointerType === "mouse" || state.paused) return;
        event.preventDefault();
        const code=state.inVehicle?"ControlLeft":"ShiftLeft";
        runPointers.set(event.pointerId,code);
        setKey(code, true, "touchButtons");
        button.classList.add("is-held");
        button.setPointerCapture?.(event.pointerId);
      });
      listen(button, "pointerup", releaseRun);
      listen(button, "pointercancel", releaseRun);
      listen(button, "lostpointercapture", releaseRun);
    }
  }

  listen(resumeButton, "click", () => setPaused(false));

  function deadZone(value) {
    const magnitude = Math.abs(value || 0);
    return magnitude < 0.16 ? 0 : Math.sign(value) * ((magnitude - 0.16) / 0.84);
  }

  function pollGamepad() {
    if (destroyed) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(item => item?.connected);

    if (pad) {
      const pressed = index => Boolean(pad.buttons[index]?.pressed);
      const edge = index => pressed(index) && !previousGamepadButtons[index];

      if (state.paused) {
        controller.setAnalogMove?.(0, 0);
        clearSource("gamepad");
        if (edge(0) || edge(9)) setPaused(false);
      } else if (!state.started) {
        controller.setAnalogMove?.(0, 0);
        clearSource("gamepad");
        if (edge(12)) onMenuAction("up");
        if (edge(13)) onMenuAction("down");
        if (edge(0)) onMenuAction("confirm");
        if (edge(1)) onMenuAction("back");
        if (edge(14)) onMenuAction("left");
        if (edge(15)) onMenuAction("right");
      } else if (state.inventory) {
        controller.setAnalogMove?.(0, 0);
        clearSource("gamepad");
      } else if (state.dialogue) {
        controller.setAnalogMove?.(0, 0);
        clearSource("gamepad");
        if (edge(12)) onDialogueAction("up");
        if (edge(13)) onDialogueAction("down");
        if (edge(0)) onDialogueAction("confirm");
        if (edge(1)) onDialogueAction("back");
        if (edge(9)) togglePause();
      } else if (state.combat) {
        controller.setAnalogMove?.(0, 0);
        setKey("ShiftLeft", false, "gamepad");
        if (edge(12)) onCombatAction("up");
        if (edge(13)) onCombatAction("down");
        if (edge(0)) onCombatAction("confirm");
        if (edge(1)) onCombatAction("guard");
        if (edge(2)) onCombatAction("attack");
        if (edge(3)) onCombatAction("aim");
        if (edge(5)) onCombatAction("heal");
        if (edge(9)) togglePause();
      } else {
        const leftX = deadZone(pad.axes[0]);
        const leftY = deadZone(pad.axes[1]);
        controller.setAnalogMove?.(leftX, -leftY);

        const rightX = deadZone(pad.axes[2]);
        const rightY = deadZone(pad.axes[3]);
        if (state.inVehicle) {
          if (state.started) onVehicleLook(rightX * sensitivity.gamepadLook / 60, rightY * sensitivity.gamepadLook / 60, "gamepad");
        } else {
          player.yaw -= rightX * sensitivity.gamepadLook / 60;
          player.pitch = clamp(player.pitch + rightY * sensitivity.gamepadLook / 60, -0.95, 1.25);
        }

        if (edge(0) && !state.inVehicle) controller.jump?.();
        if (edge(2)) onInteract();
        if (edge(9) || edge(1)) togglePause();
        if (state.inVehicle) {
          setKey("ShiftLeft",pressed(7),"gamepad");
          setKey("ControlLeft",pressed(6),"gamepad");
        } else {
          setKey("Space",false,"gamepad");
          setKey("ControlLeft",false,"gamepad");
          setKey("ShiftLeft", pressed(6) || pressed(7), "gamepad");
        }
      }

      previousGamepadButtons = pad.buttons.map(button => button.pressed);
    } else {
      clearSource("gamepad");
      previousGamepadButtons = [];
      const canMove = state.started && !state.paused && !state.combat && !state.dialogue && !state.inventory;
      controller.setAnalogMove?.(canMove ? touchMove.x : 0, canMove ? touchMove.y : 0);
    }

    animationFrame = requestAnimationFrame(pollGamepad);
  }

  listen(window, "gamepaddisconnected", () => {
    clearSource("gamepad");
    controller.setAnalogMove?.(0, 0);
  });

  animationFrame = requestAnimationFrame(pollGamepad);

  return {
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    clear: clearInput,
    setMouseSensitivity(value) {
      sensitivity.mouseX = clamp(Number(value) || 0.001, 0.00035, 0.0025);
      sensitivity.mouseY = sensitivity.mouseX * 0.9;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      clearInput();
      movementJoystick?.destroy();
      for (const dispose of listeners) dispose();
    }
  };
}
