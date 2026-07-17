import {
    loadOfferService,
    getOfferByIdService,
    createOfferService,
    updateOfferService,
    toggleOfferStatusService,
    deleteOfferService,
    getProductsMetadataService,
    getCategoriesMetadataService
} from "../../services/admin/offerService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadOffer = async (req, res) => {
  try {
    const { search, type, status, page } = req.query;

    const payload = await loadOfferService({ search, type, status, page });

      const isAjax = req.headers["x-requested-with"] === "XMLHttpRequest";
    if (isAjax) {
      return res.json({ success: true, ...payload });
    }

    return res.render("admin/offerManagement", {
      title: "Offers Management",
      ...payload,
      filters: { search, type, status },
    });

  } catch (err) {
    console.error("loadOffer error:", err);
    return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

export const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getOfferByIdService(id);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("getOfferById error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const createOffer = async (req, res) => {
  try {
    const result = await createOfferService(req.body);

    return res.status(statuscodes.CREATED).json({ success: true, ...result });

  } catch (err) {
    console.error("createOffer error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await updateOfferService({ id, bodyData: req.body });

    return res.json({ success: true, ...result });

  } catch (err) {
    console.error("updateOffer error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const toggleOfferStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await toggleOfferStatusService(id);

    return res.json({
      success: true,
      ...result
    });

  } catch (err) {
    console.error("toggleOfferStatus error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await deleteOfferService(id);

    return res.json({ success: true, ...result });

  } catch (err) {
    console.error("deleteOffer error:", err);
    return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: err.message || "Server error"
    });
  }
};

export const getProductsMetadata = async (req, res) => {
  try {
    const normalized = await getProductsMetadataService();

    return res.json({ success: true, products: normalized });
  } catch (err) {
    console.error("getProductsMetadata error:", err);
    return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

export const getCategoriesMetadata = async (req, res) => {
  try {
    const categories = await getCategoriesMetadataService();

    return res.json({ success: true, categories });
  } catch (err) {
    console.error("getCategoriesMetadata error:", err);
    return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};
