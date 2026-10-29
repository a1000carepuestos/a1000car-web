import {fetchVisibleProducts, SANITY_CONFIG} from "../sanity-client.mjs";

try {
  const products = await fetchVisibleProducts();
  console.log(`Conexión correcta: ${SANITY_CONFIG.projectId}/${SANITY_CONFIG.dataset}`);
  console.log(`Productos publicados y visibles: ${products.length}`);
  if (products.length === 0) {
    console.log("La respuesta está vacía; no hay productos que cumplan ambos filtros.");
    console.log("Campos esperados: _id, name, sku, priceArs, description, stockStatus, isUniversal, publicationStatus, category, partType, partBrand, photos, compatibilities.");
  } else {
    console.log("Respuesta recibida:");
    console.log(JSON.stringify(products, null, 2));
  }
} catch (error) {
  console.error("No se pudo consultar Sanity:", error.message);
  process.exitCode = 1;
}
