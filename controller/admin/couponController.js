import Coupon from "../../model/couponModel.js";
import { validateCouponPayload } from "../../utils/coupon.js";

export const loadCoupon = async (req, res) => {
  try {
    const { search = "", status = "all", sort = "default", page = 1 } = req.query;

    const LIMIT = 5;
    const currentPage = Math.max(1, parseInt(page));

    
    const filter = {};
    if (search.trim()) {
      filter.code = { $regex: search.trim(), $options: "i" };
    }
    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    
    let sortOption = { createdAt: -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };
    else if (sort === "oldest") sortOption = { createdAt: 1 };
    else if (sort === "az") sortOption = { code: 1 };
    else if (sort === "za") sortOption = { code: -1 };

    
    const totalFiltered = await Coupon.countDocuments(filter);
    const totalPages = Math.ceil(totalFiltered / LIMIT);
    const skip = (currentPage - 1) * LIMIT;

    const coupons = await Coupon.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(LIMIT)
      .lean();

    
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
    const validation = validateCouponPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const {
      upperCode, discountType, numericValue,
      numericLimit, numericMinOrder, numericMaxDiscount,
      parsedStart, parsedEnd,
    } = validation.data;

    const existing = await Coupon.findOne({ code: upperCode });
    if (existing) {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }

    const { isActive } = req.body;

    const coupon = await Coupon.create({
      code: upperCode,
      discountType,
      discountValue: numericValue,
      startDate: parsedStart,
      expiryDate: parsedEnd,
      usageLimit: numericLimit,
      minOrder: numericMinOrder,
      maxDiscount: discountType === "percentage" ? numericMaxDiscount : undefined,
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
    const validation = validateCouponPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const {
      upperCode, discountType, numericValue,
      numericLimit, numericMinOrder, numericMaxDiscount,
      parsedStart, parsedEnd,
    } = validation.data;

    
    const existing = await Coupon.findOne({ code: upperCode, _id: { $ne: req.params.id } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }

    const { isActive } = req.body;

    const updated = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        code: upperCode,
        discountType,
        discountValue: numericValue,
        startDate: parsedStart,
        expiryDate: parsedEnd,
        usageLimit: numericLimit,
        minOrder: numericMinOrder,
        maxDiscount: discountType === "percentage" ? numericMaxDiscount : undefined,
        isActive: isActive === true || isActive === "true" || isActive === "on",
      },
      { new: true, runValidators: true }
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