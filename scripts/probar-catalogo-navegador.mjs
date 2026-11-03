import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {fixture, universal, brand, model} from "../tests/catalogo-fixtures.mjs";
import {formatPrice} from "../catalogo-data.mjs";

const require = createRequire(import.meta.url);
const {chromium} = require("playwright");
const base = process.env.CATALOG_TEST_URL || "http://localhost:4173";
const output = resolve(".local-qa");
const api = "https://d4ku4bhi.api.sanity.io/**";
const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true});
const errors = [];
const context = () => browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: "reduce"});
const ready = async (page) => { await page.locator("[aria-busy='false']").waitFor({timeout: 20000}); };
const visit = async (page, path = "/") => { await page.goto(base + path, {waitUntil: "domcontentloaded"}); await ready(page); };
const follow = async (page, selector) => { await page.locator(selector).click(); await ready(page); };
const screenshot = async (page, name) => { await page.screenshot({path: resolve(output, name + ".png"), fullPage: true}); };
const checkLayout = async (page) => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Horizontal overflow");
  assert.equal(await page.locator(".product-content h2, .model-choice strong, .btn").evaluateAll((nodes) => nodes.some((n) => n.scrollWidth > n.clientWidth + 2)), false, "Text overflow");
};
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
async function mock(ctx, rows, status = 200) {
  await ctx.route(api, (route) => route.fulfill({status, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({result: rows})}));
}

try {
  await mkdir(output, {recursive: true});
  if (!process.argv.includes("--mock-only")) {
    const ctx = await context();
    try {
      const page = await newPage(ctx);
      let catalogRequests = 0;
      page.on("request", (request) => { if (request.url().startsWith("https://d4ku4bhi.api.sanity.io/")) catalogRequests++; });
      const responsePromise = page.waitForResponse((r) => r.url().startsWith("https://d4ku4bhi.api.sanity.io/"), {timeout: 20000});
      await visit(page);
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      const received = (await response.json()).result;
      const product = received.find((item) => item.sku === "TEST-BOSCH-001");
      assert.ok(product, "Debe existir el producto de prueba esperado");
      const requestHeaders = await response.request().allHeaders();
      assert.equal(requestHeaders.origin, new URL(base).origin);
      assert.equal(requestHeaders.authorization, undefined);
      assert.equal(requestHeaders.cookie, undefined);
      assert.equal(response.headers()["access-control-allow-origin"], new URL(base).origin);
      console.log("CORS real:", requestHeaders.origin, "=>", response.headers()["access-control-allow-origin"]);
      assert.equal(await page.locator("#catalogo .category-card").count(), 1);
      await page.locator("#catalogo").screenshot({path: resolve(output, "catalogo-desktop.png")});
      await follow(page, "#catalogo .catalog-card-link");
      assert.equal(await page.locator(".brand-choice").count(), 1);
      assert.match(await page.locator(".brand-choice").innerText(), /Chevrolet/);
      await page.waitForFunction(() => document.querySelector(".brand-logo-slot img")?.naturalWidth > 0);
      await screenshot(page, "marcas-desktop");
      await follow(page, ".brand-choice");
      assert.equal(await page.locator(".model-choice").count(), 1);
      await page.waitForFunction(() => document.querySelector(".model-image-frame img")?.naturalWidth > 0);
      await screenshot(page, "modelos-desktop");
      await follow(page, ".model-choice");
      assert.equal(await page.locator(".type-choice").count(), 1);
      assert.match(await page.locator(".type-choice").innerText(), /Pastillas/);
      await follow(page, ".type-choice");
      const card = page.locator(".product-card");
      assert.equal(await card.count(), 1);
      assert.match(await card.innerText(), /Pastillas de freno delanteras Bosch/);
      assert.match(await card.innerText(), /BOSCH/);
      assert.equal(await card.locator(".product-price strong").innerText(), formatPrice(product.priceArs));
      assert.match(await card.innerText(), /2005–2012.*Motor 1\.6/);
      const wa = new URL(await card.locator(".js-whatsapp").getAttribute("href"));
      assert.equal(wa.pathname, "/5491135474814");
      assert.match(wa.searchParams.get("text"), /Chevrolet Corsa/);
      assert.doesNotMatch(wa.searchParams.get("text"), /categoría/);
      assert.equal(await page.locator(".breadcrumb a").count(), 5);
      assert.equal(catalogRequests, 1, "El recorrido completo debe reutilizar una consulta");
      const refreshedResponse = page.waitForResponse((r) => r.url().startsWith("https://d4ku4bhi.api.sanity.io/"));
      await page.reload({waitUntil: "domcontentloaded"});
      await ready(page);
      const refreshedProduct = (await (await refreshedResponse).json()).result.find((item) => item._id === product._id);
      assert.equal(await page.locator(".product-price strong").innerText(), formatPrice(refreshedProduct.priceArs));
      assert.equal(catalogRequests, 2, "Recargar debe consultar otra vez");
      console.log("Consultas reales: 1 por recorrido completo; 2 después de recargar.");
      await checkLayout(page);
      await screenshot(page, "productos-desktop");
      await page.setViewportSize({width: 390, height: 844});
      await checkLayout(page);
      await screenshot(page, "productos-mobile");
      await page.getByRole("button", {name: "Abrir menú"}).click();
      assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
      await visit(page, "/catalogo-productos.html?categoria=frenos&marca=Chevrolet&modelo=Corsa");
      assert.equal(await page.locator(".type-choice").count(), 1, "Legacy URL");
      await screenshot(page, "tipos-mobile");
      await visit(page);
      await checkLayout(page);
      await page.locator("#catalogo").screenshot({path: resolve(output, "catalogo-mobile.png")});
      console.log("OK: recorrido real, recursos locales, precio, compatibilidad, WhatsApp, enlaces antiguos, menú y responsive.");
    } finally { await ctx.close(); }
  }

  const ctx = await context();
  try {
    const page = await newPage(ctx);
    const shared = {...fixture, compatibilities: [...fixture.compatibilities, {vehicleBrand: brand, vehicleModel: {_id: "meriva", name: "Meriva", brandId: brand._id}}]};
    await mock(ctx, [shared, universal, {...fixture, _id: "hidden", publicationStatus: "hidden"}, {...fixture, _id: "broken", partType: null}]);
    await visit(page);
    assert.equal(await page.locator(".category-card").count(), 2);
    await visit(page, "/catalogo-modelos.html?categoria=frenos&marca=Chevrolet");
    assert.equal(await page.locator(".model-choice").count(), 2);
    await visit(page, "/catalogo-productos.html?categoria=universales");
    assert.equal(await page.locator(".product-card").count(), 1);
    assert.equal(await page.locator(".type-choice, .brand-choice, .model-choice").count(), 0);
    const message = new URL(await page.locator(".product-card .js-whatsapp").getAttribute("href")).searchParams.get("text");
    assert.doesNotMatch(message, /Motor:/);
    assert.match(message, /Lámpara de prueba/);
    await screenshot(page, "universales-simulado");
    await ctx.unroute(api);
    await mock(ctx, []);
    await visit(page);
    assert.match(await page.locator(".catalog-state").innerText(), /No hay productos publicados/);
    assert.equal(await page.locator(".category-card").count(), 0);
    await ctx.unroute(api);
    let attempts = 0;
    await ctx.route(api, (route) => route.fulfill({status: attempts++ ? 200 : 503, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({result: [fixture]})}));
    await visit(page);
    assert.match(await page.locator(".catalog-state").innerText(), /No pudimos cargar/);
    await screenshot(page, "error-simulado");
    await page.getByRole("button", {name: "Reintentar"}).click();
    await ready(page);
    assert.equal(await page.locator(".category-card").count(), 1);
    await ctx.unroute(api);
    await mock(ctx, [{...fixture, name: '<img src=x onerror="alert(1)">', priceArs: null, partBrand: null, stockStatus: null, photos: [{url: "https://cdn.sanity.io/missing-photo.jpg"}]}]);
    await ctx.route("https://cdn.sanity.io/**", (route) => route.abort());
    await visit(page, "/catalogo-productos.html?categoria=frenos&marca=Chevrolet&modelo=Corsa&tipo=pastillas");
    assert.equal(await page.locator(".product-content h2").innerText(), '<img src=x onerror="alert(1)">');
    assert.equal(await page.locator(".product-content h2 img").count(), 0);
    assert.match(await page.locator(".product-card").innerText(), /Marca a confirmar/);
    assert.match(await page.locator(".product-price strong").innerText(), /Consultar/);
    await page.waitForFunction(() => !document.querySelector(".product-media img"));
    assert.match(await page.locator(".product-media").innerText(), /Imagen no disponible/i);
    await checkLayout(page);
    await visit(page, "/catalogo-productos.html?categoria=frenos&marca=Chevrolet&modelo=Corsa&tipo=inexistente");
    assert.match(await page.locator(".catalog-state").innerText(), /Tipo de repuesto no disponible/);
    console.log("OK: universales, múltiples modelos, vacíos, error y reintento, enlaces inválidos, datos incompletos, foto rota y texto seguro.");
  } finally { await ctx.close(); }
  assert.deepEqual(errors, [], "Unhandled browser errors");
  console.log("Capturas:", output);
} finally { await browser.close(); }
