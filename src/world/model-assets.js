/**
 * Runtime model catalogue. Paths are relative to Vite's public directory.
 * Every optional model must declare a fallback and attribution/license data.
 */
export const MODEL_ASSETS = Object.freeze({
  skodaFavorit: Object.freeze({
    id: "skoda-favorit",
    path: "models/skoda-favorit/scene.gltf",
    format: "gltf",
    fallback: "procedural-hatchback",
    license: "CC-BY-NC-ND-4.0",
    attribution: Object.freeze({
      author: "Tomáš Musílek",
      title: "Škoda Favorit (rigged, lowpoly)",
      source: "https://sketchfab.com/3d-models/skoda-favorit-rigged-lowpoly-7d763d058c674070bfc44c4933559bbd"
    })
  })
});

/** Resolve a public asset path for root and project-site deployments. */
export function resolveModelAssetUrl(baseUrl, assetPath) {
  const base = String(baseUrl || "./").replace(/\/+$/, "") || "";
  const path = String(assetPath || "").replace(/^\/+/, "");
  if (!path || path.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new TypeError("Model asset path must be a safe relative public path.");
  }
  if (path.includes("\\") || path.includes("?") || path.includes("#") || /^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new TypeError("Model asset path must not contain a URL, query, fragment, or backslash.");
  }
  return base + "/" + path;
}
