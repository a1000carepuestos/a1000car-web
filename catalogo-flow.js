import {loadCatalogProducts} from "./catalogo-cache.mjs";
import {productImageUrl} from "./catalogo-images.mjs";
import {prepareProducts, categoriesOf, inCategory, brandsOf, modelsOf, forVehicle, typesOf, findEntity, findCategory, categoryKey, directCategory, catalogHref, formatPrice, compatibilityText, productMessage} from "./catalogo-data.mjs";

const assets = window.CATALOG_PRESENTATION;
const home = document.querySelector("[data-catalog-categories]");
const shell = document.querySelector(".catalog-flow-shell");
const root = home || shell;
const params = new URLSearchParams(location.search);
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const localValue = (map, name) => Object.entries(map || {}).find(([key]) => normalize(key) === normalize(name))?.[1];

function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(text, href, className = "") {
  const node = el("a", className, text);
  node.href = href;
  return node;
}
function icon(category, className = "catalog-icon") {
  const node = el("span", className);
  node.setAttribute("aria-hidden", "true");
  // Only trusted SVG strings from the existing local asset registry enter HTML.
  node.innerHTML = assets.icons[categoryKey(category)] || assets.icons.filtros;
  return node;
}
function safeImage(value) {
  if (typeof value !== "string") return "";
  if (/^assets\//.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn.sanity.io" ? url.href : "";
  } catch { return ""; }
}
function imageSlot(sources, alt, className, fallbackText) {
  const slot = el("span", className);
  const urls = [...new Set(sources.map(safeImage).filter(Boolean))];
  const fallback = () => slot.replaceChildren(el("span", "image-fallback", fallbackText));
  const next = () => {
    const url = urls.shift();
    if (!url) { fallback(); return; }
    const img = el("img");
    img.alt = alt;
    img.loading = "lazy";
    img.addEventListener("error", next, {once: true});
    img.src = url;
    slot.replaceChildren(img);
  };
  next();
  return slot;
}
function whatsapp(text = "Consultar por WhatsApp", message) {
  const node = link(text, "#", "btn btn-primary js-whatsapp");
  if (message) node.dataset.waMessage = message;
  node.target = "_blank";
  node.rel = "noopener";
  return node;
}
function note(text) {
  const node = el("div", "catalog-note");
  node.append(el("span", "", text));
  return node;
}
function state(title, message, retry = false) {
  const block = el("div", "catalog-state");
  block.setAttribute("role", retry ? "alert" : "status");
  block.append(el("h2", "", title), el("p", "", message));
  const actions = el("div", "catalog-actions");
  if (retry) {
    const button = el("button", "btn btn-outline", "Reintentar");
    button.type = "button";
    button.addEventListener("click", load);
    actions.append(button);
  }
  if (!home) actions.append(link("Volver al catálogo", "index.html#catalogo", "btn btn-outline"));
  actions.append(whatsapp());
  block.append(actions);
  root.replaceChildren(block);
}
function breadcrumbs(items) {
  const nav = el("nav", "breadcrumb");
  nav.setAttribute("aria-label", "Ruta del catálogo");
  const all = [{name: "Inicio", href: "index.html#inicio"}, {name: "Catálogo", href: "index.html#catalogo"}, ...items];
  all.forEach((item, index) => {
    const node = index === all.length - 1 ? el("strong", "", item.name) : link(item.name, item.href);
    if (index === all.length - 1) node.setAttribute("aria-current", "page");
    nav.append(node);
  });
  shell.append(nav);
}
function heading(category, title, description, brand) {
  const row = el("div", "catalog-title-row");
  row.append(brand
    ? imageSlot([brand.logoUrl, localValue(assets.brandLogos, brand.name)], `Logo ${brand.name}`, "brand-mark brand-heading-logo", brand.name)
    : icon(category));
  const copy = el("div");
  copy.append(el("p", "eyebrow", category.name), el("h1", "", title), el("p", "", description));
  row.append(copy);
  shell.append(row);
  document.title = `A1000Car | ${title}`;
}
function choiceBlock(title, cards, gridClass = "") {
  if (!cards.length) return;
  const section = el("section", "choice-block");
  section.append(el("h2", "", title));
  const grid = el("div", `choice-grid ${gridClass}`);
  grid.append(...cards);
  section.append(grid);
  shell.append(section);
}
function renderHome(products) {
  const categories = categoriesOf(products);
  home.replaceChildren();
  categories.forEach((category) => {
    const rows = inCategory(products, category);
    const direct = directCategory(rows);
    const href = catalogHref(direct ? "catalogo-productos.html" : "catalogo-categoria.html", {category});
    const card = el("article", "category-card");
    const body = el("div", "category-body");
    const header = el("div", "category-header");
    header.append(icon(category, "category-icon"), el("h3", "", category.name));
    body.append(header, el("p", "", category.description || typesOf(rows).map((type) => type.name).join(", ") + "."), link(direct ? "Ver productos universales" : "Explorar categoría", href, "catalog-card-link"));
    card.append(body);
    card.addEventListener("click", (event) => { if (!event.target.closest("a")) location.href = href; });
    home.append(card);
  });
  const brandGrid = document.querySelector(".vehicle-logo-grid");
  const brands = brandsOf(products);
  document.querySelector(".vehicle-brands-section").hidden = !brands.length;
  brandGrid.replaceChildren(...brands.map((brand) => {
    const card = el("div", "vehicle-logo-card");
    card.append(imageSlot([brand.logoUrl, localValue(assets.brandLogos, brand.name)], `Logo ${brand.name}`, "vehicle-logo-slot", "Logo no disponible"), el("span", "", brand.name));
    return card;
  }));
  if (!categories.length) state("El catálogo se está actualizando", "No hay productos publicados para mostrar en este momento. Consultanos por el repuesto que necesitás.");
}
function renderBrands(category, products) {
  if (directCategory(products)) { location.replace(catalogHref("catalogo-productos.html", {category})); return; }
  breadcrumbs([{name: category.name}]);
  heading(category, category.name, "Elegí la marca de tu vehículo. La compatibilidad y el stock se confirman por WhatsApp.");
  const card = (brand) => {
    const node = link("", catalogHref("catalogo-modelos.html", {category, brand}), "choice-card brand-choice");
    node.append(imageSlot([brand.logoUrl, localValue(assets.brandLogos, brand.name)], `Logo ${brand.name}`, "brand-logo-slot", "Logo no disponible"), el("strong", "", brand.name));
    return node;
  };
  const brands = brandsOf(products);
  choiceBlock("Elegí la marca de tu vehículo", brands.filter((brand) => brand.group !== "imported").map(card));
  choiceBlock("Importados", brands.filter((brand) => brand.group === "imported").map(card), "imported-grid");
  if (products.some((product) => product.isUniversal)) {
    shell.append(link("Ver productos universales", catalogHref("catalogo-productos.html", {category, universal: true}), "btn btn-outline"));
  }
  shell.append(note("¿No encontrás tu marca? Consultanos por WhatsApp para verificar compatibilidad y disponibilidad."));
}
function renderModels(category, brand, products) {
  breadcrumbs([{name: category.name, href: catalogHref("catalogo-categoria.html", {category})}, {name: brand.name}]);
  heading(category, brand.name, "Elegí el modelo de tu vehículo para encontrar el tipo de repuesto que necesitás.", brand);
  choiceBlock("Elegí el modelo de tu vehículo", modelsOf(products, brand).map((model) => {
    const card = link("", catalogHref("catalogo-productos.html", {category, brand, model}), "choice-card model-choice");
    const localModels = localValue(assets.modelImages, brand.name);
    card.append(imageSlot([model.imageUrl, localValue(localModels, model.name)], `${brand.name} ${model.name}`, "model-image-frame", "Imagen no disponible"), el("strong", "", model.name));
    return card;
  }), "models-grid");
  shell.append(note("La aplicación puede variar según año, versión y motorización. Confirmamos compatibilidad y stock por WhatsApp."));
}
function productCard(product, category, brand, model) {
  const article = el("article", "product-card");
  article.dataset.productId = product._id;
  const photo = product.photos.find((image) => safeImage(image?.url));
  const media = el("div", "product-media");
  if (photo) media.append(imageSlot([productImageUrl(photo.url)], photo.alt || product.name, "product-image-slot", "Imagen no disponible"));
  else media.append(icon(category, "product-line-icon"), el("span", "", "Imagen no disponible"));
  const body = el("div", "product-content");
  body.append(el("h2", "", product.name), el("p", "product-type", product.partBrand?.name || "Marca a confirmar"));
  if (product.sku) body.append(el("p", "product-sku", `Código: ${product.sku}`));
  body.append(el("p", "product-vehicle", brand && model ? `${brand.name} ${model.name}` : "Producto de uso frecuente · Confirmar aplicación"));
  if (product.description) body.append(el("p", "product-description", product.description));
  if (brand && model) {
    const details = [...new Set(product.compatibilities.filter((c) => c.vehicleBrand._id === brand._id && c.vehicleModel._id === model._id).map(compatibilityText).filter(Boolean))];
    details.forEach((text) => body.append(el("p", "product-compatibility", text)));
  }
  const stockText = {available: "Disponible · Confirmar stock", outOfStock: "Sin stock", check: "Consultar disponibilidad"};
  body.append(el("p", `product-stock stock-${["available", "outOfStock"].includes(product.stockStatus) ? product.stockStatus : "check"}`, stockText[product.stockStatus] || stockText.check));
  const price = el("div", "product-price");
  price.append(el("span", "", "Precio orientativo · ARS"), el("strong", "", formatPrice(product.priceArs)), el("small", "product-price-note", "El precio puede variar según la marca, modelo, versión y fabricante del repuesto. Consultanos para recibir una cotización actualizada."));
  body.append(price, el("p", "product-disclaimer", product.isUniversal ? "La aplicación debe confirmarse según el vehículo y el producto." : "Confirmá año, motor y versión para verificar la compatibilidad."), whatsapp("Consultar precio y disponibilidad", productMessage(product, brand, model)));
  article.append(media, body);
  return article;
}
function renderProducts(category, products, brand, model) {
  const direct = directCategory(products) || params.get("universales") === "1";
  const selected = direct ? products.filter((p) => p.isUniversal) : forVehicle(products, brand, model);
  const types = typesOf(selected);
  const requestedType = params.get("tipo");
  const type = requestedType ? findEntity(types, requestedType) : null;
  if (requestedType && !type) { state("Tipo de repuesto no disponible", "No hay productos visibles para esta selección."); return; }
  if (!selected.length) { state("Sin productos para esta selección", "Consultanos por WhatsApp para verificar otras opciones."); return; }
  const crumbs = [{name: category.name, href: catalogHref("catalogo-categoria.html", {category})}];
  if (!direct) crumbs.push({name: brand.name, href: catalogHref("catalogo-modelos.html", {category, brand})}, {name: model.name, href: catalogHref("catalogo-productos.html", {category, brand, model})});
  if (type) crumbs.push({name: type.name});
  breadcrumbs(crumbs);
  heading(category, direct ? category.name : type ? `${type.name} para ${brand.name} ${model.name}` : `${brand.name} ${model.name}`, direct || type ? "Consultanos para confirmar compatibilidad, marca disponible, precio y stock." : "Elegí el tipo de repuesto que necesitás para tu vehículo.");
  const actions = el("div", "catalog-actions");
  if (!direct) {
    actions.append(link("Volver a elegir modelo", catalogHref("catalogo-modelos.html", {category, brand}), "btn btn-outline"));
    if (type) actions.append(link("Elegir otro tipo de repuesto", catalogHref("catalogo-productos.html", {category, brand, model}), "btn btn-outline"));
  } else actions.append(link("Volver al catálogo", "index.html#catalogo", "btn btn-outline"));
  shell.append(actions);
  if (!direct && !type) {
    choiceBlock("Elegí el tipo de repuesto", types.map((item) => {
      const card = link("", catalogHref("catalogo-productos.html", {category, brand, model, type: item}), "choice-card type-choice");
      card.append(icon(category), el("strong", "", item.name));
      if (item.description) card.append(el("span", "", item.description));
      return card;
    }));
  } else {
    (type ? [type] : types).forEach((item) => {
      const section = el("section", "product-group");
      if (direct) section.append(el("h2", "product-group-title", item.name));
      const grid = el("div", "product-grid");
      grid.append(...selected.filter((p) => p.partType._id === item._id).map((p) => productCard(p, category, direct ? null : brand, direct ? null : model)));
      section.append(grid);
      shell.append(section);
    });
    if (direct) shell.append(note("Que un producto sea de uso frecuente no significa que sea compatible con todos los vehículos. Consultanos con marca, modelo y año para confirmar la opción correcta."));
    shell.append(note("Los precios son orientativos y pueden variar según año, versión, motor, fabricante y disponibilidad del momento."));
  }
}
function renderInternal(products) {
  const category = findCategory(categoriesOf(products), params.get("categoria"));
  if (!category) { state("Categoría no disponible", "No hay productos visibles para esta categoría. Podés volver al catálogo o consultarnos."); return; }
  const rows = inCategory(products, category);
  if (location.pathname.endsWith("catalogo-categoria.html")) { renderBrands(category, rows); return; }
  if (directCategory(rows) || params.get("universales") === "1") { renderProducts(category, rows); return; }
  const brand = findEntity(brandsOf(rows), params.get("marca"));
  if (!brand) { state("Marca no disponible", "No hay productos visibles para esta marca y categoría."); return; }
  if (location.pathname.endsWith("catalogo-modelos.html")) { renderModels(category, brand, rows); return; }
  const model = findEntity(modelsOf(rows, brand), params.get("modelo"));
  if (!model) { state("Modelo no disponible", "No hay productos visibles para este modelo y categoría."); return; }
  renderProducts(category, rows, brand, model);
}
async function load() {
  if (!root) return;
  root.setAttribute("aria-busy", "true");
  const loading = el("p", "catalog-loading", "Cargando catálogo…");
  loading.setAttribute("role", "status");
  root.replaceChildren(loading);
  // Do not leave the institutional brand list suggesting stale catalog options.
  if (home) document.querySelector(".vehicle-brands-section").hidden = true;
  try {
    const products = prepareProducts(await loadCatalogProducts());
    root.replaceChildren();
    if (home) renderHome(products);
    else renderInternal(products);
  } catch (error) {
    console.error("No se pudo cargar el catálogo de Sanity:", error);
    state("No pudimos cargar el catálogo", "Probá nuevamente en unos momentos o consultanos por WhatsApp.", true);
  } finally {
    root.setAttribute("aria-busy", "false");
    window.updateWhatsappLinks?.();
  }
}
load();
window.addEventListener("pageshow", (event) => { if (event.persisted) load(); });
