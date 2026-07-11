import Offer from "../model/offerModel.js";

export async function getActiveOffers() {
    const now = new Date();
    return await Offer.find({
        isActive: true,
        startDate: { $lte: now },
        expiryDate: { $gte: now },
    }).lean();
}

export function calculateOfferPrice(originalPrice, product, activeOffers) {
    let bestDiscount = 0;
    let appliedOffer = null;

    
    const productCategoryId = product.category?._id
        ? product.category._id.toString()
        : product.category
        ? product.category.toString()
        : null;


    for (const offer of activeOffers) {

        const matchesProduct =
            offer.applicableTo === 'product' &&
            offer.targetId.toString() === product._id.toString();

        const matchesCategory =
            offer.applicableTo === 'category' &&
            productCategoryId &&
            offer.targetId.toString() === productCategoryId;

        if (!matchesProduct && !matchesCategory) continue;

        let discount = 0;
        if (offer.discountType === 'percentage') {
            discount = Math.round((originalPrice * offer.discountValue) / 100);
            if (offer.maxCap && discount > offer.maxCap) discount = offer.maxCap;
        }

        if (discount > bestDiscount) {
            bestDiscount = discount;
            appliedOffer = offer;
        }
    }

    return {
        originalPrice,
        discountedPrice: Math.max(0, originalPrice - bestDiscount),
        discount: bestDiscount,
        hasOffer: bestDiscount > 0,
        offer: appliedOffer,
    };
}

export function parseDMY(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

const LABEL_REGEX = /^[A-Za-z][A-Za-z\s'&-]{2,49}$/;

export function validateOfferPayload(body) {
  const {
    label, applicableTo, target,
    discountType, amount,
    maxCap, minOrder,
    startDate, endDate,
  } = body;

  // ── Required fields ────────────────────────────────
  if (!label || !applicableTo || !target || !discountType || !amount || !startDate || !endDate) {
    return { error: "All required fields must be filled" };
  }

  // ── Label ────────────────────────────────────────────
  const trimmedLabel = label.trim();
  if (!/[a-zA-Z]/.test(trimmedLabel)) {
    return { error: "Offer label must contain letters" };
  }
  if (!LABEL_REGEX.test(trimmedLabel)) {
    return {
      error: "Offer label must be 3-50 characters, letters only (spaces, - and ' allowed), starting with a letter",
    };
  }

  if (!["product", "category"].includes(applicableTo)) {
    return { error: "Invalid scope" };
  }

  if (discountType !== "percentage") {
    return { error: "Invalid discount type" };
  }

  // ── Amount ───────────────────────────────────────────
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { error: "Discount amount must be greater than 0" };
  }
  if (numAmount > 100) {
    return { error: "Percentage cannot exceed 100%" };
  }

  // ── Optional numeric fields ──────────────────────────
  let numMaxCap = null;
  if (maxCap !== undefined && maxCap !== null && maxCap !== "") {
    numMaxCap = Number(maxCap);
    if (isNaN(numMaxCap) || numMaxCap <= 0) {
      return { error: "Max cap must be a positive number" };
    }
  }

  let numMinOrder = 0;
  if (minOrder !== undefined && minOrder !== null && minOrder !== "") {
    numMinOrder = Number(minOrder);
    if (isNaN(numMinOrder) || numMinOrder < 0) {
      return { error: "Min order must be 0 or a positive number" };
    }
  }

  // ── Dates ────────────────────────────────────────────
  const parsedStart = parseDMY(startDate);
  const parsedEnd   = parseDMY(endDate);

  if (!parsedStart || !parsedEnd) {
    return { error: "Invalid date format (use dd/mm/yyyy)" };
  }
  if (parsedEnd <= parsedStart) {
    return { error: "End date must be after start date" };
  }

  return {
    data: {
      label: trimmedLabel,
      applicableTo,
      target,
      discountType,
      numAmount,
      numMaxCap,
      numMinOrder,
      parsedStart,
      parsedEnd,
    },
  };
}