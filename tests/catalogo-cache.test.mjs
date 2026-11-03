import test from "node:test";
import assert from "node:assert/strict";
import {createCatalogLoader, canReuseCatalog, CATALOG_TTL_MS, CATALOG_CACHE_KEY} from "../catalogo-cache.mjs";
import {productImageUrl} from "../catalogo-images.mjs";

function storage() {
  const data = new Map();
  return {getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key)};
}
test("cinco páginas internas reutilizan una sola consulta", async () => {
  const store = storage(); let count = 0;
  const fetchProducts = async () => { count++; return [{name: "Producto"}]; };
  for (let page = 0; page < 5; page++) {
    const load = createCatalogLoader({storage: store, reuse: page > 0, fetchProducts});
    assert.equal((await load())[0].name, "Producto");
  }
  assert.equal(count, 1);
});
test("recargar ignora la copia anterior y recibe el cambio publicado", async () => {
  const store = storage(); let version = "anterior"; let count = 0;
  const fetchProducts = async () => { count++; return [{name: version}]; };
  await createCatalogLoader({storage: store, fetchProducts})();
  version = "nuevo";
  assert.equal((await createCatalogLoader({storage: store, reuse: false, fetchProducts})())[0].name, "nuevo");
  assert.equal(count, 2);
});
test("vence a los 60 segundos sin extenderse por la navegación", async () => {
  const store = storage(); let time = 1000; let count = 0;
  const options = {storage: store, reuse: true, now: () => time, fetchProducts: async () => { count++; return []; }};
  await createCatalogLoader(options)();
  time += CATALOG_TTL_MS - 1;
  await createCatalogLoader(options)();
  assert.equal(count, 1);
  time++;
  await createCatalogLoader(options)();
  assert.equal(count, 2);
});
test("recarga fallida no muestra ni conserva datos anteriores; permite reintento", async () => {
  const store = storage();
  await createCatalogLoader({storage: store, fetchProducts: async () => [{name: "viejo"}]})();
  let fail = true;
  const load = createCatalogLoader({storage: store, fetchProducts: async () => { if (fail) throw Error("sin conexión"); return []; }});
  await assert.rejects(load(), /sin conexión/);
  assert.equal(store.getItem(CATALOG_CACHE_KEY), undefined);
  fail = false;
  assert.deepEqual(await load(), []);
});
test("sin storage, con JSON corrupto o cambio de consulta se vuelve a consultar", async () => {
  const denied = {getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); }};
  assert.deepEqual(await createCatalogLoader({storage: denied, reuse: true, fetchProducts: async () => []})(), []);
  const store = storage();
  for (const value of ["malformed", JSON.stringify({signature: "vieja", createdAt: Date.now(), products: []})]) {
    store.setItem(CATALOG_CACHE_KEY, value);
    assert.deepEqual(await createCatalogLoader({storage: store, reuse: true, fetchProducts: async () => [1]})(), [1]);
  }
});
test("deduplica consultas concurrentes y reutiliza memoria en el mismo documento", async () => {
  let count = 0;
  const load = createCatalogLoader({fetchProducts: async () => { count++; return []; }});
  await Promise.all([load(), load(), load()]); await load();
  assert.equal(count, 1);
});
test("solo reutiliza navegación entre páginas del catálogo del mismo origen", () => {
  const base = {navigationType: "navigate", href: "https://example.com/catalogo-modelos.html", referrer: "https://example.com/catalogo-categoria.html?categoria=frenos"};
  assert.equal(canReuseCatalog(base), true);
  for (const update of [{navigationType: "reload"}, {referrer: ""}, {referrer: "https://other.com/index.html"}, {referrer: "https://example.com/otra-app/index.html"}, {navigationType: undefined}]) assert.equal(canReuseCatalog({...base, ...update}), false);
});
test("fotografías dimensionadas sin recortes; no altera imágenes locales ni SVG", () => {
  const url = new URL(productImageUrl("https://cdn.sanity.io/images/p/production/image-2000x1000.jpg"));
  assert.equal(url.searchParams.get("fit"), "max");
  assert.equal(url.searchParams.get("h"), "480");
  assert.equal(url.searchParams.get("w"), "1200");
  assert.equal(url.searchParams.get("auto"), "format");
  assert.equal(productImageUrl("assets/car.png"), "assets/car.png");
  assert.equal(productImageUrl("https://cdn.sanity.io/images/p/production/logo.svg"), "https://cdn.sanity.io/images/p/production/logo.svg");
});
