// Public, read-only access to the catalog. No token or Studio credentials are used.
export const SANITY_CONFIG = Object.freeze({
  projectId: "d4ku4bhi",
  dataset: "production",
  apiVersion: "2026-03-01",
});

export const VISIBLE_PRODUCTS_QUERY = `
  *[_type == "product" && publicationStatus == "visible" && !(_id in path("drafts.**"))]
  | order(name asc) {
    _id, name, sku, priceArs, description, stockStatus, isUniversal, publicationStatus,
    "category": category->{_id, name, description, "slug": slug.current, navigationMode, sortOrder},
    "partType": partType->{_id, name, description, sortOrder, "categoryId": category._ref},
    "partBrand": partBrand->{_id, name, "logoUrl": logo.asset->url},
    "photos": photos[]{alt, "url": asset->url},
    "compatibilities": compatibilities[]{
      _key, yearFrom, yearTo, engine, version,
      "vehicleBrand": vehicleBrand->{_id, name, group, sortOrder, "logoUrl": logo.asset->url},
      "vehicleModel": vehicleModel->{_id, name, sortOrder, "brandId": vehicleBrand._ref, "imageUrl": image.asset->url}
    }
  }
`;

export async function fetchVisibleProducts({fetchImpl = globalThis.fetch, signal} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch no está disponible en este entorno.");
  }

  const {projectId, dataset, apiVersion} = SANITY_CONFIG;
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set("query", VISIBLE_PRODUCTS_QUERY);
  url.searchParams.set("perspective", "published");

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    credentials: "omit",
    headers: {Accept: "application/json"},
    signal: signal ?? AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`La consulta a Sanity falló (HTTP ${response.status}).`);
  }
  const data = await response.json();
  if (!Array.isArray(data.result)) {
    throw new Error("Sanity devolvió una respuesta de productos inesperada.");
  }
  return data.result;
}
