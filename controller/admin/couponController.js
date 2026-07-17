import {
    loadCouponService,
    createCouponService,
    updateCouponService,
    toggleCouponStatusService,
    deleteCouponService,
    getCouponByIdService
} from "../../services/admin/couponService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadCoupon = async (req, res) => {
  try {
    const { search, status, sort, page } = req.query;

    const payload = await loadCouponService({ search, status, sort, page });

    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (isAjax) {
        return res.json({ success: true, ...payload });
      }

    return res.render("admin/couponManagement", {
      title: "Coupon Management",
      ...payload,
      filters: { search, status, sort },
    });

  } catch (err) {
    console.error("loadCoupon error:", err);
    return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const result = await createCouponService(req.body);

    return res.status(statuscodes.CREATED).json({ success: true, ...result });

  } catch (err) {
    console.error("createCoupon error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await updateCouponService({ id, bodyData: req.body });

    return res.json({ success: true, ...result });

  } catch (err) {
    console.error("updateCoupon error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await toggleCouponStatusService(id);

    return res.json({
      success: true,
      ...result
    });

  } catch (err) {
    console.error("toggleCouponStatus error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await deleteCouponService(id);

    return res.json({ success: true, ...result });

  } catch (err) {
    console.error("deleteCoupon error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getCouponByIdService(id);

    return res.json({ success: true, ...result });

  } catch (err) {
    console.error("getCouponById error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};
