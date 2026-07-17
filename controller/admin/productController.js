import {
    loadProductService,
    loadAddProductService,
    addProductService,
    loadEditProductService,
    editProductService,
    deleteProductService,
    restoreProductService,
    loadProductViewService,
    loadVariantsService,
    addVariantService,
    editVariantService,
    deleteVariantService,
    setDefaultVariantService
} from "../../services/admin/productService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadProduct = async (req, res) => {
    try {
        const page     = parseInt(req.query.page) || 1;
        const search   = req.query.search || "";
        const category = req.query.category || "all";
        const brand    = req.query.brand || "all";
        const status   = req.query.status || "all";

        const payload = await loadProductService({ page, search, category, brand, status });

        if (req.query.ajax === "true") {
            return res.json({ success: true, ...payload });
        }

        res.render("admin/productManagement", payload);

    } catch (error) {
        console.error("loadProduct error:", error);
        if (req.query.ajax === "true") {
            return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Something went wrong" });
        }
        res.redirect("/admin/dashboard");
    }
};

export const loadAddProduct = async (req, res) => {
    try {
        const payload = await loadAddProductService();
        res.render("admin/addProduct", payload);
    } catch (error) {
        console.error("loadAddProduct error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const addProduct = async (req, res) => {
    try {
        const result = await addProductService({
            bodyData: req.body,
            files: req.files
        });

        return res.status(statuscodes.OK).json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error("addProduct error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Failed to add product"
        });
    }
};

export const loadEditProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const payload = await loadEditProductService(id);

        res.render("admin/editProduct", payload);

    } catch (error) {
        console.error("loadEditProduct error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const editProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await editProductService({
            id,
            bodyData: req.body,
            files: req.files
        });

        return res.json({ success: true, ...result });

    } catch (error) {
        console.error("editProduct error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Internal server error."
        });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await deleteProductService(id);

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error("deleteProduct error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

export const restoreProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await restoreProductService(id);

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error("restoreProduct error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

export const loadProductView = async (req, res) => {
    try {
        const { id } = req.params;

        const payload = await loadProductViewService(id);

        res.render("admin/productView", payload);

    } catch (error) {
        console.error("loadProductView error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const loadVariants = async (req, res) => {
    try {
        const { id } = req.params;
        const page   = parseInt(req.query.page) || 1;
        const status = req.query.status || "all";
        const sort   = req.query.sort   || "default";
        const search = req.query.search || "";

        const payload = await loadVariantsService({ id, page, status, sort, search });

        res.render("admin/viewVariants", {
            ...payload,
            status,
            sort,
            search
        });

    } catch (error) {
        console.error("loadVariants error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const addVariant = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await addVariantService({ id, bodyData: req.body, files: req.files });

        return res.status(statuscodes.CREATED).json({ success: true, ...result });

    } catch (error) {
        console.error("addVariant error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ success: false, message: error.message || "Server error." });
    }
};

export const editVariant = async (req, res) => {
    try {
        const { id, variantId } = req.params;

        const result = await editVariantService({ id, variantId, bodyData: req.body, files: req.files });

        return res.status(statuscodes.OK).json({ success: true, ...result });

    } catch (error) {
        console.error("editVariant error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ success: false, message: error.message || "Server error." });
    }
};

export const deleteVariant = async (req, res) => {
    try {
        const { id, variantId } = req.params;

        const result = await deleteVariantService({ id, variantId });

        return res.status(statuscodes.OK).json({ success: true, ...result });

    } catch (error) {
        console.error("deleteVariant error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ success: false, message: error.message || "Server error." });
    }
};

export const setDefaultVariant = async (req, res) => {
    try {
        const { productId, variantId } = req.body;

        const result = await setDefaultVariantService({ productId, variantId });

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error("setDefaultVariant error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Server error"
        });
    }
};


