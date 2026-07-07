import Coupon from "../../model/couponModel.js";


function parseDMY(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

export const loadCoupon = async (req, res) => {
  try {
    const { search = "", status = "all", sort = "default", page = 1 } = req.query;

    const LIMIT = 5;
    const currentPage = Math.max(1, parseInt(page));

    // ── Filter ──────────────────────────────────────────
    const filter = {};
    if (search.trim()) {
      filter.code = { $regex: search.trim(), $options: "i" };
    }
    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    // ── Sort ────────────────────────────────────────────
    let sortOption = { createdAt: -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };
    else if (sort === "oldest") sortOption = { createdAt: 1 };
    else if (sort === "az") sortOption = { code: 1 };
    else if (sort === "za") sortOption = { code: -1 };

    // ── Pagination ──────────────────────────────────────
    const totalFiltered = await Coupon.countDocuments(filter);
    const totalPages = Math.ceil(totalFiltered / LIMIT);
    const skip = (currentPage - 1) * LIMIT;

    const coupons = await Coupon.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(LIMIT)
      .lean();

    // ── Stats ────────────────────────────────────────────
    const [total, active] = await Promise.all([
      Coupon.countDocuments(),
      Coupon.countDocuments({ isActive: true }),
    ]);

    const payload = {
      success: true,
      coupons,
      stats: {
        total,
        active,
        inactive: total - active,
      },
      pagination: {
        currentPage,
        totalPages,
        totalFiltered,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        limit: LIMIT,
      },
    };

    // ── AJAX request → return JSON, page load → render HTML ──
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (isAjax) {
      return res.json(payload);
    }

    return res.render("admin/couponManagement", {
      title: "Coupon Management",
      ...payload,
      filters: { search, status, sort },
    });

  } catch (err) {
    console.error("loadCoupon error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const { code, discountType, value, startDate, endDate, limit, minOrder, isActive, maxDiscount } = req.body;

    // Basic validations
    if (!code || !discountType || !value || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All required fields must be filled" });
    }

    const upperCode = code.trim().toUpperCase();

    const existing = await Coupon.findOne({ code: upperCode });
    if (existing) {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }

    const parsedStart = parseDMY(startDate);
    const parsedEnd = parseDMY(endDate);

    if (!parsedStart || !parsedEnd) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    if (parsedEnd <= parsedStart) {
      return res.status(400).json({ success: false, message: "End date must be after start date" });
    }

    const numericValue = Number(value);
    const numericMinOrder = minOrder ? Number(minOrder) : 0;

    if (discountType === "percentage" && numericValue > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
    }

    // ---- NEW: min order must exceed the discount amount ----
    if (discountType === "flat") {
      if (numericMinOrder <= numericValue) {
        return res.status(400).json({
          success: false,
          message: "Minimum order must be greater than the discount amount"
        });
      }
    } else if (discountType === "percentage") {
      const numericMaxDiscount = maxDiscount ? Number(maxDiscount) : null;
      if (numericMaxDiscount && numericMinOrder <= numericMaxDiscount) {
        return res.status(400).json({
          success: false,
          message: "Minimum order must be greater than the max discount cap"
        });
      }
    }
    // ---- END NEW ----

    const coupon = await Coupon.create({
      code: upperCode,
      discountType,
      discountValue: numericValue,
      startDate: parsedStart,
      expiryDate: parsedEnd,
      usageLimit: limit ? Number(limit) : null,
      minOrder: numericMinOrder,
      maxDiscount: discountType === "percentage" && maxDiscount ? Number(maxDiscount) : undefined,
      isActive: isActive === true || isActive === "true" || isActive === "on",
      usedCount: 0,
    });

    return res.status(201).json({ success: true, coupon, message: "Coupon created successfully" });
  } catch (err) {
    console.error("createCoupon error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateCoupon = async (req, res) => {

  try {
    const { code, discountType, value, startDate, endDate, limit, minOrder, isActive } = req.body;
 
    if (!code || !discountType || !value || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All required fields must be filled" });
    }
 
    const upperCode = code.trim().toUpperCase();
 
    // Duplicate check (exclude self)
    const existing = await Coupon.findOne({ code: upperCode, _id: { $ne: req.params.id } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }
 
    const parsedStart = parseDMY(startDate);
    const parsedEnd = parseDMY(endDate);
 
    if (!parsedStart || !parsedEnd) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }
 
    if (parsedEnd <= parsedStart) {
      return res.status(400).json({ success: false, message: "End date must be after start date" });
    }
 
    if (discountType === "percentage" && Number(value) > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
    }
 
    const updated = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        code: upperCode,
        discountType,
        discountValue: Number(value),
        startDate: parsedStart,
        expiryDate: parsedEnd,
        usageLimit: limit ? Number(limit) : null,
        minOrder: minOrder ? Number(minOrder) : 0,
        isActive: isActive === true || isActive === "true" || isActive === "on",
      },
       { returnDocument: 'after', runValidators: true }
    );
 
    if (!updated) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
 
    return res.json({ success: true, coupon: updated, message: "Coupon updated successfully" });
  } catch (err) {
    console.error("updateCoupon error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
 
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
 
    coupon.isActive = !coupon.isActive;
    await coupon.save();
 
    return res.json({
      success: true,
      isActive: coupon.isActive,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"}`,
    });
  } catch (err) {
    console.error("toggleCouponStatus error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);
 
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
 
    return res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (err) {
    console.error("deleteCoupon error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id).lean();

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    return res.json({ success: true, coupon });
  } catch (err) {
    console.error("getCouponById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};