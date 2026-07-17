const params = new URLSearchParams(window.location.search);
const data = window.CATALOG_DATA;
const ORIENTATIVE_PRICE = data.orientativePrice;

const normalize = (value) => (value || "").trim();
const requestedCategory = normalize(params.get("categoria"));
const categoryAlias = { fluidos: "universales" };
const normalizedCategory = categoryAlias[requestedCategory] || requestedCategory;
const categoryKey = data.categories[normalizedCategory] ? normalizedCategory : "frenos";
const category = data.categories[categoryKey];
const requestedBrand = normalize(params.get("marca"));
const availableBrands = [...data.localBrands, ...data.importedBrands];
const brandName = availableBrands.includes(requestedBrand) ? requestedBrand : "";
const requestedModel = normalize(params.get("modelo"));
const modelName = (data.models[brandName] || []).includes(requestedModel) ? requestedModel : "";

const setText = (selector, text) => {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = text;
  });
};

const setHref = (selector, href) => {
  document.querySelectorAll(selector).forEach((node) => {
    node.href = href;
  });
};

const setCategoryPresentation = () => {
  document.querySelectorAll(".catalog-icon").forEach((node) => {
    node.innerHTML = data.icons[categoryKey] || "";
  });
};

const whatsappTemplate = (intro, includePhoto = false) => `${intro}

Marca del vehículo:
Modelo:
Año:
Motor:
Repuesto que busco:${includePhoto ? "\nFoto o código de la pieza:" : ""}

Muchas gracias.`;

const productWhatsappMessage = (product, brand, model) => {
  if (categoryKey === "encendido") {
    if (product.messageType === "rele") {
      return `Hola A1000Car, quiero consultar por un relé para mi vehículo.

Marca:
Modelo:
Año:
Función del relé o número de patas, si lo conozco:
Foto o código, si lo tengo:

Quiero confirmar el modelo correcto, precio y stock.

Muchas gracias.`;
    }

    if (product.messageType === "destellador") {
      return `Hola A1000Car, quiero consultar por un destellador para mi vehículo.

Marca:
Modelo:
Año:
Cantidad de patas o foto de la pieza, si la tengo:

Quiero confirmar compatibilidad, precio y stock.

Muchas gracias.`;
    }

    const detailLine = product.messageType === "bulbo"
      ? "Foto o ficha del bulbo, si la tengo:"
      : "Foto o código de la pieza, si lo tengo:";
    return `Hola A1000Car, quiero consultar por ${product.name.toLowerCase()} para ${brand} ${model}.

Año:
Motor:
Versión, si la conozco:
${detailLine}

Quiero confirmar compatibilidad, conexión, precio y stock.

Muchas gracias.`;
  }

  if (categoryKey === "universales" && product.section === "Iluminación") {
    return `Hola A1000Car, quiero consultar por una lámpara para mi vehículo.

Función que necesito:
Luz alta / luz baja / alta y baja / posición / giro / freno / otra

Marca del vehículo:
Modelo:
Año:

Quiero confirmar el tipo correcto, precio y stock.

Muchas gracias.`;
  }

  if (category.directProducts) {
    return `Hola A1000Car, quiero consultar por ${product.name.toLowerCase()}.

Producto:
Presentación o cantidad que necesito:
Vehículo, si corresponde:

Quiero confirmar el tipo, precio y stock.

Muchas gracias.`;
  }

  return `Hola A1000Car, quiero consultar por ${product.name.toLowerCase()} para ${brand} ${model}.

Año:
Motor:
Versión, si la conozco:

Quiero confirmar compatibilidad, precio y stock.

Muchas gracias.`;
};

const productCard = (product, brand, model) => {
  const article = document.createElement("article");
  article.className = "product-card";
  const vehicleLine = category.directProducts ? "Producto de uso frecuente" : `${brand} ${model}`;
  const availabilityText = categoryKey === "encendido"
    ? "El modelo y la conexión pueden variar según el año, motor y versión del vehículo."
    : categoryKey === "universales" && product.section === "Iluminación"
      ? "El tipo de lámpara puede variar según el vehículo y la óptica instalada."
      : category.directProducts
        ? "La compatibilidad depende de la presentación, la aplicación y el vehículo si corresponde."
        : "El precio puede variar según año, versión, motor, marca disponible y stock.";
  const buttonText = category.directProducts
    ? "Consultar precio y stock"
    : categoryKey === "encendido"
      ? "Consultar precio y compatibilidad"
      : "Consultar precio y disponibilidad";

  article.innerHTML = `
    <div class="product-media" aria-hidden="true">
      <span class="product-line-icon">${data.icons[categoryKey] || ""}</span>
      <span>Imagen próximamente</span>
    </div>
    <div class="product-content">
      <h2>${product.name}</h2>
      <p class="product-vehicle">${vehicleLine}</p>
      ${product.description ? `<p class="product-description">${product.description}</p>` : ""}
      ${product.type ? `<p class="product-type">${product.type}</p>` : ""}
      <div class="product-price">
        <span>Precio orientativo</span>
        <strong>${ORIENTATIVE_PRICE}</strong>
        <small class="product-price-note">El precio puede variar según la marca, modelo, versión y fabricante del repuesto. Consultanos para recibir una cotización actualizada.</small>
      </div>
      <p class="product-disclaimer">${availabilityText}</p>
      <a class="btn btn-primary js-whatsapp" href="#" data-wa-message="${productWhatsappMessage(product, brand, model).replaceAll('"', "&quot;")}" target="_blank" rel="noopener">${buttonText}</a>
    </div>
  `;
  return article;
};

const renderProductGroups = (products, brand, model, container) => {
  const groups = new Map();
  products.forEach((product) => {
    const groupName = product.section || "Repuestos disponibles";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(product);
  });

  container.innerHTML = "";
  groups.forEach((groupProducts, groupName) => {
    const group = document.createElement("section");
    group.className = "product-group";
    if (category.directProducts || groups.size > 1) {
      const heading = document.createElement("h2");
      heading.className = "product-group-title";
      heading.textContent = groupName;
      group.appendChild(heading);
    }

    const grid = document.createElement("div");
    grid.className = "product-grid";
    groupProducts.forEach((product) => grid.appendChild(productCard(product, brand, model)));
    group.appendChild(grid);
    container.appendChild(group);
  });
};

const brandCard = (brand) => {
  const link = document.createElement("a");
  link.className = "choice-card brand-choice";
  link.href = `catalogo-modelos.html?categoria=${encodeURIComponent(categoryKey)}&marca=${encodeURIComponent(brand)}`;
  const logo = data.brandLogos?.[brand] || "";
  link.innerHTML = `
    <span class="brand-logo-slot">
      <img src="${logo}" alt="Logo ${brand}" loading="lazy">
      <span class="brand-logo-fallback">${brand}</span>
    </span>
    <strong>${brand}</strong>
  `;
  const img = link.querySelector("img");
  img.addEventListener("error", () => {
    link.classList.add("logo-missing");
    img.remove();
  });
  return link;
};

const modelCard = (model) => {
  const link = document.createElement("a");
  link.className = "choice-card model-choice";
  link.href = `catalogo-productos.html?categoria=${encodeURIComponent(categoryKey)}&marca=${encodeURIComponent(brandName)}&modelo=${encodeURIComponent(model)}`;
  const image = data.modelImages?.[brandName]?.[model] || "";

  link.innerHTML = image
    ? `
      <span class="model-image-frame">
        <img src="${image}" alt="${brandName} ${model}" loading="lazy">
      </span>
      <strong>${model}</strong>
    `
    : `
      <span class="model-silhouette" aria-hidden="true">
        <span class="car-body"></span>
        <span class="car-window"></span>
        <span class="car-wheel wheel-left"></span>
        <span class="car-wheel wheel-right"></span>
      </span>
      <strong>${model}</strong>
    `;

  const img = link.querySelector("img");
  if (img) {
    img.addEventListener("error", () => {
      link.classList.add("model-image-missing");
      link.innerHTML = `
        <span class="model-silhouette" aria-hidden="true">
          <span class="car-body"></span>
          <span class="car-window"></span>
          <span class="car-wheel wheel-left"></span>
          <span class="car-wheel wheel-right"></span>
        </span>
        <strong>${model}</strong>
      `;
    });
  }
  return link;
};

const renderCategoryPage = () => {
  if (category.directProducts) {
    window.location.href = `catalogo-productos.html?categoria=${encodeURIComponent(categoryKey)}`;
    return;
  }

  setText("[data-category-name]", category.title);
  setCategoryPresentation();
  document.title = `A1000Car | ${category.title}`;

  const localGrid = document.querySelector("[data-local-brands]");
  const importedGrid = document.querySelector("[data-imported-brands]");
  const categoryContact = document.querySelector(".catalog-note .js-whatsapp");

  if (localGrid) data.localBrands.forEach((brand) => localGrid.appendChild(brandCard(brand)));
  if (importedGrid) data.importedBrands.forEach((brand) => importedGrid.appendChild(brandCard(brand)));
  if (categoryContact) {
    categoryContact.dataset.waMessage = whatsappTemplate(category.message, true);
  }
};

const renderModelsPage = () => {
  if (!brandName) {
    window.location.replace(`catalogo-categoria.html?categoria=${encodeURIComponent(categoryKey)}`);
    return;
  }

  const brand = brandName;
  const models = data.models[brand] || [];
  const categoryHref = `catalogo-categoria.html?categoria=${encodeURIComponent(categoryKey)}`;

  setText("[data-category-name]", category.title);
  setText("[data-brand-name]", brand);
  setCategoryPresentation();
  document.querySelectorAll("[data-brand-logo]").forEach((node) => {
    const logo = data.brandLogos?.[brand] || "";
    node.innerHTML = `<img src="${logo}" alt="Logo ${brand}" loading="lazy"><span>${brand}</span>`;
    const img = node.querySelector("img");
    img.addEventListener("error", () => {
      node.classList.add("logo-missing");
      img.remove();
    });
  });
  setHref("[data-category-link]", categoryHref);
  document.title = `A1000Car | ${brand} ${category.title}`;

  const modelGrid = document.querySelector("[data-models]");
  const emptyState = document.querySelector("[data-model-empty]");
  const emptyContact = emptyState?.querySelector(".js-whatsapp");

  if (modelGrid && models.length) {
    models.forEach((model) => modelGrid.appendChild(modelCard(model)));
  } else if (emptyState) {
    emptyState.classList.remove("is-hidden");
  }
  if (emptyContact) {
    emptyContact.dataset.waMessage = `${category.message}

Marca del vehículo: ${brand}
Modelo:
Año:
Motor:
Repuesto que busco:
Foto o código de la pieza:

Muchas gracias.`;
  }
};

const renderProductsPage = () => {
  if (!category.directProducts && (!brandName || !modelName)) {
    const fallback = brandName
      ? `catalogo-modelos.html?categoria=${encodeURIComponent(categoryKey)}&marca=${encodeURIComponent(brandName)}`
      : `catalogo-categoria.html?categoria=${encodeURIComponent(categoryKey)}`;
    window.location.replace(fallback);
    return;
  }

  const brand = brandName || "Marca";
  const model = modelName || "Modelo";
  const categoryHref = `catalogo-categoria.html?categoria=${encodeURIComponent(categoryKey)}`;
  const brandHref = `catalogo-modelos.html?categoria=${encodeURIComponent(categoryKey)}&marca=${encodeURIComponent(brand)}`;
  const products = data.products?.[categoryKey] || [];
  const title = category.directProducts ? category.title : `${category.title} para ${brand} ${model}`;

  setText("[data-category-name]", category.title);
  setText("[data-brand-name]", brand);
  setText("[data-model-name]", model);
  setText("[data-product-title]", title);
  setCategoryPresentation();
  setHref("[data-category-link]", categoryHref);
  setHref("[data-brand-link]", brandHref);
  document.title = `A1000Car | ${title}`;

  const productGrid = document.querySelector("[data-products]");
  const backToModels = document.querySelector("[data-back-to-models]");

  if (category.directProducts) {
    setText("[data-product-eyebrow]", "Productos universales");
    setText("[data-product-intro]", "Elegí el producto que necesitás y consultanos para confirmar el tipo, la aplicación, el precio orientativo y el stock.");
    document.querySelector("[data-universal-note]")?.classList.remove("is-hidden");
    document.querySelectorAll("[data-brand-link], [data-model-name]").forEach((node) => node.remove());
    document.querySelectorAll("[data-category-link]").forEach((node) => {
      const current = document.createElement("strong");
      current.textContent = category.title;
      node.replaceWith(current);
    });
    if (backToModels) backToModels.href = "index.html#catalogo";
    if (backToModels) backToModels.textContent = "Volver al catálogo";
  } else if (backToModels) {
    backToModels.href = brandHref;
  }

  if (productGrid) renderProductGroups(products, brand, model, productGrid);
};

if (document.querySelector("[data-local-brands]")) renderCategoryPage();
if (document.querySelector("[data-models]")) renderModelsPage();
if (document.querySelector("[data-product-title]")) renderProductsPage();

if (window.updateWhatsappLinks) window.updateWhatsappLinks();
