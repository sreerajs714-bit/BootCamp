const NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\s\-'&.]*$/; // starts with letter/number, allows common punctuation after
const COLOR_REGEX = /^[A-Za-z]+(\s[A-Za-z]+)*$/;        // letters and single spaces only, e.g. "Midnight Black"
const SKU_REGEX   = /^[A-Za-z]+$/;                       // letters only, no numbers/symbols/spaces

export function validateProductPayload(body) {
  const {
    productName, description, category, brand,
    color, sku, price, stock, sizes,
  } = body;

  // ── Required fields ────────────────────────────────
  if (!productName || !description || !category || !brand || !color || !sku || !price || !stock) {
    return { error: "All required fields must be filled." };
  }

  // ── Product Name ─────────────────────────────────────
  const trimmedName = productName.trim();
  if (trimmedName.length < 4) {
    return { error: "Product name must be at least 4 characters." };
  }
  if (trimmedName.length > 100) {
    return { error: "Product name cannot exceed 100 characters." };
  }
  if (/^\d+$/.test(trimmedName)) {
    return { error: "Product name cannot be only numbers." };
  }
  if (!NAME_REGEX.test(trimmedName)) {
    return { error: "Product name contains invalid characters." };
  }

  // ── Description ───────────────────────────────────────
  const trimmedDescription = description.trim();
  if (trimmedDescription.length < 20) {
    return { error: "Description must be at least 20 characters." };
  }
  if (trimmedDescription.length > 1000) {
    return { error: "Description cannot exceed 1000 characters." };
  }

  // ── Color — letters only ─────────────────────────────
  const trimmedColor = color.trim();
  if (trimmedColor.length < 3) {
    return { error: "Color must be at least 3 characters." };
  }
  if (trimmedColor.length > 30) {
    return { error: "Color name is too long." };
  }
  if (!COLOR_REGEX.test(trimmedColor)) {
    return { error: "Color must contain letters only (no numbers or symbols)." };
  }

  // ── SKU — letters only ────────────────────────────────
  const trimmedSku = sku.trim();
  if (trimmedSku.length < 4) {
    return { error: "SKU must be at least 4 characters." };
  }
  if (trimmedSku.length > 40) {
    return { error: "SKU cannot exceed 40 characters." };
  }
  if (!SKU_REGEX.test(trimmedSku)) {
    return { error: "SKU must contain letters only (no numbers, spaces, or symbols)." };
  }

  // ── Price ──────────────────────────────────────────────
  const numPrice = Number(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return { error: "Price must be a positive number." };
  }
  if (numPrice > 99999) {
    return { error: "Price cannot exceed ₹99,999." };
  }

  // ── Stock ──────────────────────────────────────────────
  const numStock = Number(stock);
  if (isNaN(numStock) || !Number.isInteger(numStock) || numStock < 0) {
    return { error: "Stock cannot be negative." };
  }
  if (numStock > 9999) {
    return { error: "Stock cannot exceed 9,999 units." };
  }

  // ── Sizes ────────────────────────────────────────────
  if (!sizes || (Array.isArray(sizes) && sizes.length === 0)) {
    return { error: "Please select at least one size." };
  }
  const sizeArray = Array.isArray(sizes) ? sizes : [sizes];
  const numSizes = sizeArray.map(Number);
  if (numSizes.some(s => isNaN(s))) {
    return { error: "Invalid size value." };
  }

  return {
    data: {
      productName: trimmedName,
      description: trimmedDescription,
      color: trimmedColor,
      sku: trimmedSku.toUpperCase(),
      price: numPrice,
      stock: numStock,
      sizes: numSizes,
    },
  };
}