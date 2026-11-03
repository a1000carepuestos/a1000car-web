import test from "node:test";
import assert from "node:assert/strict";
import {fetchVisibleProducts, VISIBLE_PRODUCTS_QUERY} from "../sanity-client.mjs";

test("solicita solo productos visibles y publicados sin credenciales", async () => {
  const product = {_id: "p1", name: "Pastillas", compatibilities: [{vehicleModel: {name: "Corsa"}}]};
  let request;
  const result = await fetchVisibleProducts({fetchImpl: async (url, options) => {
    request = {url: new URL(url), options};
    return {ok: true, json: async () => ({result: [product]})};
  }});
  assert.equal(request.url.origin, "https://d4ku4bhi.api.sanity.io");
  assert.equal(request.url.pathname, "/v2026-03-01/data/query/production");
  assert.equal(request.url.searchParams.get("perspective"), "published");
  assert.equal(request.url.searchParams.get("query"), VISIBLE_PRODUCTS_QUERY);
  assert.match(VISIBLE_PRODUCTS_QUERY, /publicationStatus == "visible"/);
  assert.match(VISIBLE_PRODUCTS_QUERY, /!\(_id in path\("drafts\.\*\*"\)\)/);
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.headers.Authorization, undefined);
  assert.deepEqual(result, [product]);
});

test("acepta una lista vacía", async () => {
  const products = await fetchVisibleProducts({fetchImpl: async () => ({ok: true, json: async () => ({result: []})})});
  assert.deepEqual(products, []);
});

test("informa errores HTTP", async () => {
  await assert.rejects(fetchVisibleProducts({fetchImpl: async () => ({ok: false, status: 403})}), /HTTP 403/);
});

test("rechaza respuestas con un formato inesperado", async () => {
  await assert.rejects(fetchVisibleProducts({fetchImpl: async () => ({ok: true, json: async () => ({result: null})})}), /inesperada/);
});
