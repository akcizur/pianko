// Mobile/iOS input + visual pass.
// Loaded before main.js so the CSS/input surface is ready before bindInput attaches listeners.
const style = document.createElement("style");
style.textContent = `
  /* HUD must never steal a finger intended for the camera. */
  .hud, .crosshair, .hint, .mission-card, .status-card, .vehicle-hud { pointer-events: none !important; }

  /* Keep the touch layer above informational HUD, but below modal/gameplay panels. */
  .touch-ui { z-index: 20 !important; }
  .touch-ui, .touch-ui * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .touch-ui, .move-stick, .look-zone, .touch-actions, .touch-actions button {
    -webkit-tap-highlight-color: transparent;
  }
  .touch-ui { touch-action: none; }
  .move-stick, .look-zone, .touch-actions, .touch-actions button { touch-action: none !important; }

  /* Cleaner mobile presentation: stronger separation and a subtle cinematic light grade. */
  #screenCanvas { filter: saturate(.92) contrast(1.045) brightness(.985); }
  #game::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 52% 44%, transparent 24%, rgba(0,0,0,.07) 58%, rgba(0,0,0,.30) 100%),
      linear-gradient(180deg, rgba(170,190,205,.055), transparent 36%, rgba(210,150,90,.045) 100%);
    mix-blend-mode: multiply;
  }
  #screenCanvas { position: relative; z-index: 0; }

  @media (pointer: coarse) {
    .move-stick { width: 154px !important; height: 154px !important; }
    .stick-knob { width: 58px !important; height: 58px !important; margin: -29px 0 0 -29px !important; }
    .look-zone { top: 10% !important; bottom: 12% !important; width: 58% !important; }
    .touch-actions { z-index: 2; }
    .touch-actions button { width: 58px !important; height: 52px !important; font-size: 10px; }
  }

  @media (prefers-reduced-motion: reduce) {
    #screenCanvas { filter: none; }
  }
`;
document.head.appendChild(style);

// iOS Safari can otherwise turn an interrupted gesture into navigation/scroll/zoom.
const stopGesture = event => {
  if (event.cancelable) event.preventDefault();
};
document.addEventListener("gesturestart", stopGesture, { passive: false });
document.addEventListener("gesturechange", stopGesture, { passive: false });
document.addEventListener("gestureend", stopGesture, { passive: false });

// Release stuck controls after an orientation change or viewport interruption.
window.addEventListener("orientationchange", () => {
  document.querySelector(".move-stick")?.classList.remove("active");
  document.querySelector("[data-touch-action=run]")?.classList.remove("is-held");
}, { passive: true });
