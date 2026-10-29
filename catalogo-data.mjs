const fold = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const validEntity = (value) => value && typeof value._id === "string" && typeof value.name === "string" && value.name.trim() && !/^(drafts|versions)\./.test(value._id);
const order = (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name, "es");
const unique = (items) => [...new Map(items.map((item) => [item._id, item])).values()].sort(order);

// Only products with a complete, published navigation path enter the catalog.
export function prepareProducts(rows) {
  if (!Array.isArray(rows)) return [];
  return unique(rows.flatMap((product) => {
    if (!validEntity(product) || product.publicationStatus !== "visible" || !validEntity(product.category) || !validEntity(product.partType) || typeof product.isUniversal !== "boolean") return [];
    if (product.partType.categoryId && product.partType.categoryId !== product.category._id) return [];
    const compatibilities = (Array.isArray(product.compatibilities) ? product.compatibilities : []).filter((item) =>
      item && validEntity(item.vehicleBrand) && validEntity(item.vehicleModel) && (!item.vehicleModel.brandId || item.vehicleModel.brandId === item.vehicleBrand._id));
    if (!product.isUniversal && (compatibilities.length === 0 || product.category.navigationMode === "direct")) return [];
    return [{...product, compatibilities, photos: Array.isArray(product.photos) ? product.photos : []}];
  }));
}

export const categoriesOf = (products) => unique(products.map((product) => product.category));
export const inCategory = (products, category) => products.filter((product) => product.category._id === category._id);
export const brandsOf = (products) => unique(products.filter((p) => !p.isUniversal).flatMap((p) => p.compatibilities.map((c) => c.vehicleBrand)));
export const modelsOf = (products, brand) => unique(products.filter((p) => !p.isUniversal).flatMap((p) => p.compatibilities.filter((c) => c.vehicleBrand._id === brand._id).map((c) => c.vehicleModel)));
export const forVehicle = (products, brand, model) => products.filter((p) => !p.isUniversal && p.compatibilities.some((c) => c.vehicleBrand._id === brand._id && c.vehicleModel._id === model._id));
export const typesOf = (products) => unique(products.map((product) => product.partType));
export const findEntity = (items, value) => items.find((item) => item._id === value || fold(item.name) === fold(value) || (item.slug && fold(item.slug) === fold(value)));

const categoryAliases = {
  frenos: ["frenos"], suspension: ["suspension", "suspension y direccion", "suspension-y-direccion"],
  transmision: ["transmision"], encendido: ["encendido", "encendido y electronica", "encendido-y-electronica"],
  refrigeracion: ["refrigeracion"], motor: ["motor", "motor y juntas", "motor-y-juntas", "motor y distribucion", "motor-y-distribucion"],
  filtros: ["filtros", "filtros y lubricacion", "filtros-y-lubricacion"], baterias: ["baterias", "baterias e iluminacion", "baterias-e-iluminacion"],
  universales: ["universales", "productos universales", "productos-universales", "fluidos", "fluidos y mantenimiento", "fluidos-y-mantenimiento"],
};
export const categoryKey = (category) => Object.keys(categoryAliases).find((key) => categoryAliases[key].includes(fold(category.slug)) || categoryAliases[key].includes(fold(category.name)));
export const findCategory = (items, value) => findEntity(items, value) || items.find((item) => categoryKey(item) && categoryAliases[categoryKey(item)].includes(fold(value)));
export const directCategory = (products) => products.length > 0 && products.every((product) => product.isUniversal);

export function catalogHref(page, {category, brand, model, type, universal} = {}) {
  const params = new URLSearchParams();
  if (category) params.set("categoria", category.slug || category._id);
  if (brand) params.set("marca", brand._id);
  if (model) params.set("modelo", model._id);
  if (type) params.set("tipo", type._id);
  if (universal) params.set("universales", "1");
  return `${page}?${params}`;
}

export const formatPrice = (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  ? new Intl.NumberFormat("es-AR", {style: "currency", currency: "ARS", maximumFractionDigits: 0}).format(value)
  : "Consultar";

export function compatibilityText(item) {
  const years = item.yearFrom && item.yearTo ? `${item.yearFrom}–${item.yearTo}` : item.yearFrom ? `Desde ${item.yearFrom}` : item.yearTo ? `Hasta ${item.yearTo}` : "";
  return [years, item.engine && `Motor ${item.engine}`, item.version].filter(Boolean).join(" · ");
}

export function productMessage(product, brand, model) {
  const intro = `Hola A1000Car, quiero consultar por ${product.name}${brand && model ? ` para ${brand.name} ${model.name}` : ""}.`;
  const details = product.isUniversal
    ? "Presentación o cantidad que necesito:\nMarca del vehículo, si corresponde:\nModelo:\nAño:"
    : "Año:\nMotor:\nVersión (si la conozco):";
  return [intro, [product.partBrand?.name && `Marca del repuesto: ${product.partBrand.name}`, product.sku && `Código: ${product.sku}`].filter(Boolean).join("\n"), details, "Quiero confirmar compatibilidad, precio y stock.", "Muchas gracias."].filter(Boolean).join("\n\n");
}
