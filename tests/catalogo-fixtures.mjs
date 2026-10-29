// Synthetic records used only by automated tests, never by the public catalog.
export const category = {_id: "cat", name: "Frenos", slug: "frenos", navigationMode: "vehicle"};
export const brand = {_id: "chevrolet", name: "Chevrolet", group: "main"};
export const model = {_id: "corsa", name: "Corsa", brandId: "chevrolet"};
export const type = {_id: "pastillas", name: "Pastillas", categoryId: "cat"};
export const fixture = {
  _id: "test-product", name: "Pastillas de prueba", publicationStatus: "visible", isUniversal: false,
  category, partType: type, partBrand: {_id: "bosch", name: "BOSCH"}, sku: "TEST-001",
  priceArs: 1000, stockStatus: "available", photos: null,
  compatibilities: [{vehicleBrand: brand, vehicleModel: model, yearFrom: 2005, yearTo: 2012, engine: "1.6"}],
};
export const universal = {
  ...fixture, _id: "universal", name: "Lámpara de prueba", isUniversal: true, compatibilities: null,
  category: {_id: "universales", name: "Productos universales", slug: "productos-universales", navigationMode: "direct"},
  partType: {_id: "lamparas", name: "Iluminación", categoryId: "universales"},
};
