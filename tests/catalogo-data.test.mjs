import test from "node:test";
import assert from "node:assert/strict";
import {fixture, universal, brand, model, category} from "./catalogo-fixtures.mjs";
import {prepareProducts, categoriesOf, inCategory, brandsOf, modelsOf, forVehicle, typesOf, findEntity, findCategory, catalogHref, directCategory, formatPrice, productMessage, compatibilityText} from "../catalogo-data.mjs";

test("excluye ocultos, borradores y rutas incompletas sin inventar opciones", () => {
  const rows = [fixture, {...fixture, _id: "hidden", publicationStatus: "hidden"}, {...fixture, _id: "drafts.x"}, {...fixture, _id: "broken", category: null}, {...fixture, _id: "no-car", compatibilities: null}, null];
  assert.deepEqual(prepareProducts(rows).map((p) => p._id), [fixture._id]);
  assert.deepEqual(prepareProducts(null), []);
  assert.deepEqual(categoriesOf(prepareProducts([])), []);
});
test("construye categoría, marca, modelo y tipo desde el mismo producto", () => {
  const products = prepareProducts([fixture]);
  const rows = inCategory(products, categoriesOf(products)[0]);
  assert.equal(brandsOf(rows)[0].name, "Chevrolet");
  assert.equal(modelsOf(rows, brand)[0].name, "Corsa");
  assert.equal(typesOf(forVehicle(rows, brand, model))[0].name, "Pastillas");
  assert.equal(forVehicle(rows, brand, {_id: "other"}).length, 0);
});
test("un registro aparece en varios modelos sin duplicar marcas ni productos", () => {
  const meriva = {_id: "meriva", name: "Meriva", brandId: brand._id};
  const products = prepareProducts([{...fixture, compatibilities: [...fixture.compatibilities, ...fixture.compatibilities, {vehicleBrand: brand, vehicleModel: meriva}]}]);
  assert.equal(brandsOf(products).length, 1);
  assert.equal(modelsOf(products, brand).length, 2);
  assert.equal(forVehicle(products, brand, meriva).length, 1);
  assert.equal(forVehicle(products, brand, model).length, 1);
});
test("universales no requieren vehículo ni crean opciones de marca vacías", () => {
  const products = prepareProducts([universal]);
  assert.equal(directCategory(products), true);
  assert.equal(brandsOf(products).length, 0);
  assert.equal(typesOf(products)[0].name, "Iluminación");
});
test("descarta relaciones incoherentes", () => {
  assert.equal(prepareProducts([{...fixture, partType: {...fixture.partType, categoryId: "wrong"}}]).length, 0);
  assert.equal(prepareProducts([{...fixture, compatibilities: [{vehicleBrand: brand, vehicleModel: {...model, brandId: "wrong"}}]}]).length, 0);
});
test("resuelve enlaces antiguos por nombre y categorías por alias", () => {
  assert.equal(findEntity([brand], "Chevrolet"), brand);
  const suspension = {_id: "s", name: "Suspensión y dirección", slug: "suspension-y-direccion"};
  assert.equal(findCategory([suspension], "suspension"), suspension);
  assert.equal(findCategory([universal.category], "fluidos"), universal.category);
  assert.equal(new URL(catalogHref("catalogo-productos.html", {category, brand, model, type: fixture.partType}), "http://localhost").searchParams.get("tipo"), fixture.partType._id);
});
test("precios reales, compatibilidad y WhatsApp sin categoría ni valores inventados", () => {
  assert.match(formatPrice(1000), /1\.000/);
  assert.equal(formatPrice(null), "Consultar");
  assert.equal(formatPrice(-1), "Consultar");
  assert.match(compatibilityText(fixture.compatibilities[0]), /2005–2012.*Motor 1\.6/);
  const message = productMessage(fixture, brand, model);
  assert.match(message, /Pastillas de prueba para Chevrolet Corsa/);
  assert.match(message, /TEST-001/);
  assert.doesNotMatch(message, /categoría|Frenos/);
  assert.doesNotMatch(productMessage(universal), /Motor:/);
});
