import Offer from "../../Model/offerModel.js";
import Product from "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";



function parseDMY(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

export const loadOffer = async (req, res) => {
  try {
    const { search = "", type = "all", status = "all", page = 1 } = req.query;

    const LIMIT = 10;
    const currentPage = Math.max(1, parseInt(page));
    const now = new Date();

    // ── Filter ────────────────────────────────────────
    const filter = {};

    if (search.trim()) {
      filter.label = { $regex: search.trim(), $options: "i" };
    }

    if (type === "product") filter.applicableTo = "product";
    else if (type === "category") filter.applicableTo = "category";

    if (status === "active") {
      filter.isActive = true;
      filter.expiryDate = { $gte: now };
    } else if (status === "expired") {
      filter.expiryDate = { $lt: now };
    }

    // ── Pagination ────────────────────────────────────
    const totalResults = await Offer.countDocuments(filter);
    const totalPages   = Math.ceil(totalResults / LIMIT);
    const skip         = (currentPage - 1) * LIMIT;

    const offers = await Offer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(LIMIT)
      .lean();

    // ── Enrich: auto-expire check ─────────────────────
    const enriched = offers.map(o => ({
      ...o,
      isActive: o.isActive && new Date(o.expiryDate) >= now,
    }));

    // ── Stats (always full collection) ────────────────
    const [total, active] = await Promise.all([
      Offer.countDocuments(),
      Offer.countDocuments({ isActive: true, expiryDate: { $gte: now } }),
    ]);

    const payload = {
      success: true,
      offers: enriched,
      stats: {
        total,
        active,
        inactive: total - active,
      },
      pagination: {
        currentPage,
        totalPages,
        totalResults,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        limit: LIMIT,
      },
    };

    // ── AJAX → JSON, browser → render ─────────────────
    const isAjax = req.headers["x-requested-with"] === "XMLHttpRequest";
    if (isAjax) return res.json(payload);

    return res.render("admin/offerManagement", {
      title: "Offers Management",
      ...payload,
      filters: { search, type, status },
    });

  } catch (err) {
    console.error("loadOffer error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).lean();

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    return res.json({ success: true, offer });
  } catch (err) {
    console.error("getOfferById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createOffer = async (req, res) => {
  try {
    const {
      label, applicableTo, target,
      discountType, amount,
      maxCap, minOrder,
      startDate, endDate,
    } = req.body;

    // ── Validations ───────────────────────────────────
    if (!label || !applicableTo || !target || !discountType || !amount || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All required fields must be filled" });
    }

    if (!["product", "category"].includes(applicableTo)) {
      return res.status(400).json({ success: false, message: "Invalid scope" });
    }

    if (!["percentage", "flat"].includes(discountType)) {
      return res.status(400).json({ success: false, message: "Invalid discount type" });
    }

    if (discountType === "percentage" && Number(amount) > 100) {
      return res.status(400).json({ success: false, message: "Percentage cannot exceed 100%" });
    }

    const parsedStart = parseDMY(startDate);
    const parsedEnd   = parseDMY(endDate);

    if (!parsedStart || !parsedEnd) {
      return res.status(400).json({ success: false, message: "Invalid date format (use dd/mm/yyyy)" });
    }

    if (parsedEnd <= parsedStart) {
      return res.status(400).json({ success: false, message: "End date must be after start date" });
    }

    // ── Resolve targetName ────────────────────────────
    let targetName = "";
    if (applicableTo === "product") {
      const product = await Product.findById(target).lean();
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });
      targetName = product.name;
    } else {
      const category = await Category.findById(target).lean();
      if (!category) return res.status(404).json({ success: false, message: "Category not found" });
      targetName = category.name;
    }

    const offer = await Offer.create({
      label:         label.trim(),
      applicableTo,
      targetId:      target,
      targetName,
      discountType,
      discountValue: Number(amount),
      maxCap:        maxCap  ? Number(maxCap)   : null,
      minOrder:      minOrder ? Number(minOrder) : 0,
      startDate:     parsedStart,
      expiryDate:    parsedEnd,
      isActive:      true,
    });

    return res.status(201).json({ success: true, offer, message: "Offer created successfully" });

  } catch (err) {
    console.error("createOffer error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const {
      label, applicableTo, target,
      discountType, amount,
      maxCap, minOrder,
      startDate, endDate,
    } = req.body;

    if (!label || !applicableTo || !target || !discountType || !amount || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All required fields must be filled" });
    }

    if (discountType === "percentage" && Number(amount) > 100) {
      return res.status(400).json({ success: false, message: "Percentage cannot exceed 100%" });
    }

    const parsedStart = parseDMY(startDate);
    const parsedEnd   = parseDMY(endDate);

    if (!parsedStart || !parsedEnd) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    if (parsedEnd <= parsedStart) {
      return res.status(400).json({ success: false, message: "End date must be after start date" });
    }

    // ── Resolve targetName ────────────────────────────
    let targetName = "";
    if (applicableTo === "product") {
      const product = await Product.findById(target).lean();
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });
      targetName = product.name;
    } else {
      const category = await Category.findById(target).lean();
      if (!category) return res.status(404).json({ success: false, message: "Category not found" });
      targetName = category.name;
    }

    const updated = await Offer.findByIdAndUpdate(
      req.params.id,
      {
        label:         label.trim(),
        applicableTo,
        targetId:      target,
        targetName,
        discountType,
        discountValue: Number(amount),
        maxCap:        maxCap   ? Number(maxCap)   : null,
        minOrder:      minOrder ? Number(minOrder) : 0,
        startDate:     parsedStart,
        expiryDate:    parsedEnd,
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    return res.json({ success: true, offer: updated, message: "Offer updated successfully" });

  } catch (err) {
    console.error("updateOffer error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    // Don't activate an already-expired offer
    const now = new Date();
    if (!offer.isActive && new Date(offer.expiryDate) < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot activate an expired offer. Update the dates first.",
      });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    return res.json({
      success: true,
      isActive: offer.isActive,
      message: `Offer ${offer.isActive ? "activated" : "deactivated"}`,
    });

  } catch (err) {
    console.error("toggleOfferStatus error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const deleted = await Offer.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    return res.json({ success: true, message: "Offer deleted successfully" });

  } catch (err) {
    console.error("deleteOffer error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// If your product model uses 'productName'
export const getProductsMetadata = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: { $ne: true } })
      .select("_id productName")   // ← match your actual field name
      .sort({ productName: 1 })
      .lean();

    // Normalize to { _id, name } so frontend works universally
    const normalized = products.map(p => ({
      _id: p._id,
      name: p.productName || p.name
    }));

    return res.json({ success: true, products: normalized });
  } catch (err) {
    console.error("getProductsMetadata error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCategoriesMetadata = async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: { $ne: true } })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    return res.json({ success: true, categories });
  } catch (err) {
    console.error("getCategoriesMetadata error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};