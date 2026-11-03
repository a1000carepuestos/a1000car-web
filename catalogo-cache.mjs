import {fetchVisibleProducts, SANITY_CONFIG, VISIBLE_PRODUCTS_QUERY} from "./sanity-client.mjs";

export const CATALOG_TTL_MS = 60000;
export const CATALOG_CACHE_KEY = `a1000car:catalog:v1:${SANITY_CONFIG.projectId}:${SANITY_CONFIG.dataset}`;
const signature = `${SANITY_CONFIG.apiVersion}:published:${VISIBLE_PRODUCTS_QUERY}`;

export function canReuseCatalog({navigationType, referrer, href}) {
  if (!["navigate", "back_forward"].includes(navigationType) || !referrer) return false;
  try {
    const current = new URL(href);
    const previous = new URL(referrer);
    const directory = new URL("./", current);
    const pages = ["", "index.html", "catalogo-categoria.html", "catalogo-modelos.html", "catalogo-productos.html"];
    return previous.origin === current.origin && pages.some((page) => new URL(page, directory).pathname === previous.pathname);
  } catch { return false; }
}

// Storage spans same-tab page loads; the TTL never slides forward on a cache hit.
// Reloads and external entries discard storage before any lookup.
export function createCatalogLoader({storage, reuse = false, now = Date.now, fetchProducts = fetchVisibleProducts} = {}) {
  let memory;
  let pending;
  let firstLoad = true;
  const clear = () => { try { storage?.removeItem(CATALOG_CACHE_KEY); } catch {} };
  const valid = (entry) => entry?.signature === signature && Array.isArray(entry.products) && Number.isFinite(entry.createdAt) && now() >= entry.createdAt && now() - entry.createdAt < CATALOG_TTL_MS;
  return function loadCatalog() {
    if (pending) return pending;
    if (valid(memory)) return Promise.resolve(memory.products);
    if (firstLoad) {
      firstLoad = false;
      if (reuse) {
        try { memory = JSON.parse(storage?.getItem(CATALOG_CACHE_KEY) || "null"); } catch {}
        if (valid(memory)) return Promise.resolve(memory.products);
      }
    }
    memory = undefined;
    clear();
    pending = Promise.resolve().then(fetchProducts).then((products) => {
      if (!Array.isArray(products)) throw new Error("Respuesta de catálogo inválida.");
      memory = {signature, createdAt: now(), products};
      try { storage?.setItem(CATALOG_CACHE_KEY, JSON.stringify(memory)); } catch {}
      return products;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}

let browserLoader;
export function loadCatalogProducts() {
  if (!browserLoader) {
    let storage;
    try { storage = window.sessionStorage; } catch {}
    browserLoader = createCatalogLoader({storage, reuse: canReuseCatalog({
      navigationType: performance.getEntriesByType("navigation")[0]?.type,
      referrer: document.referrer,
      href: location.href,
    })});
  }
  return browserLoader();
}
