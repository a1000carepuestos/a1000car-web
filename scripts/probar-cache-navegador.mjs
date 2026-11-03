import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fixture} from "../tests/catalogo-fixtures.mjs";
import {CATALOG_CACHE_KEY, CATALOG_TTL_MS} from "../catalogo-cache.mjs";
const {chromium} = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({channel: "chrome", headless: true});
const base = process.env.CATALOG_TEST_URL || "http://localhost:4173";
const ready = (page) => page.locator("[aria-busy='false']").waitFor();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  let calls = 0;
  let price = 1700;
  let fail = false;
  await context.route("https://d4ku4bhi.api.sanity.io/**", (route) => {
    calls++;
    return route.fulfill({status: fail ? 503 : 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({result: [{...fixture, priceArs: price}]})});
  });
  await page.goto(base, {waitUntil: "domcontentloaded"}); await ready(page);
  price = 2200;
  for (const selector of [".catalog-card-link", ".brand-choice", ".model-choice", ".type-choice"]) {
    await page.locator(selector).click(); await ready(page);
  }
  assert.equal(calls, 1);
  assert.match(await page.locator(".product-price strong").innerText(), /1\.700/);
  const href = await page.locator(".product-card .js-whatsapp").getAttribute("href");
  await page.reload({waitUntil: "domcontentloaded"}); await ready(page);
  assert.equal(calls, 2);
  assert.match(await page.locator(".product-price strong").innerText(), /2\.200/);
  assert.equal(await page.locator(".product-card .js-whatsapp").getAttribute("href"), href);
  fail = true;
  await page.reload({waitUntil: "domcontentloaded"}); await ready(page);
  assert.equal(calls, 3);
  assert.equal(await page.locator(".product-card").count(), 0);
  assert.match(await page.locator(".catalog-state").innerText(), /No pudimos cargar/);
  fail = false; price = 3300;
  await page.getByRole("button", {name: "Reintentar"}).click(); await ready(page);
  assert.equal(calls, 4);
  assert.match(await page.locator(".product-price strong").innerText(), /3\.300/);
  await page.evaluate(({key, ttl}) => {
    const entry = JSON.parse(sessionStorage.getItem(key));
    entry.createdAt -= ttl + 1;
    sessionStorage.setItem(key, JSON.stringify(entry));
  }, {key: CATALOG_CACHE_KEY, ttl: CATALOG_TTL_MS});
  await page.getByRole("link", {name: "Elegir otro tipo de repuesto"}).click(); await ready(page);
  assert.equal(calls, 5, "Una copia vencida debe renovarse");
  console.log("OK: 5 pantallas = 1 consulta; reload = dato nuevo; error sin datos viejos; reintento; TTL vencido.");
  await context.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(window, "sessionStorage", {get() { throw new Error("Storage bloqueado"); }}));
  await blocked.route("https://d4ku4bhi.api.sanity.io/**", (route) => route.fulfill({contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({result: [fixture]})}));
  const fallback = await blocked.newPage();
  await fallback.goto(base, {waitUntil: "domcontentloaded"}); await ready(fallback);
  await fallback.locator(".catalog-card-link").click(); await ready(fallback);
  assert.equal(await fallback.locator(".brand-choice").count(), 1);
  await blocked.close();
  console.log("OK: storage bloqueado no rompe el catálogo.");
} finally { await browser.close(); }
