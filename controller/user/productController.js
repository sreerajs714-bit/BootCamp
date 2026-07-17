import {
    loadAllProductsService,
    loadMensService,
    loadWomensService,
    loadLimitedEditionService,
    loadProductDetailService,
    searchProductsService
} from "../../services/user/productService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadAllProducts = async (req, res) => {
    try {
        const payload = await loadAllProductsService({
            query: req.query,
            user: req.session?.user
        });

        return res.render("users/allProduct", payload);

    } catch (error) {
        console.error("loadAllProducts error:", error);
        return res.status(statuscodes.SERVER_ERROR).send("Failed to load products");
    }
};

export const loadMens = async (req, res) => {
    try {
        const payload = await loadMensService({
            query: req.query,
            user: req.session?.user
        });

        return res.render("users/mensCollection", payload);

    } catch (error) {
        console.error("loadMens error:", error);
        return res.status(statuscodes.SERVER_ERROR).send("Failed to load mens products");
    }
};

export const loadWomens = async (req, res) => {
    try {
        const payload = await loadWomensService({
            query: req.query,
            user: req.session?.user
        });

        return res.render("users/womensCollection", payload);

    } catch (error) {
        console.error("loadWomens error:", error);
        return res.status(statuscodes.SERVER_ERROR).send("Failed to load womens products");
    }
};

export const loadLimitedEdition = async (req, res) => {
    try {
        const payload = await loadLimitedEditionService({
            query: req.query,
            user: req.session?.user
        });

        return res.render("users/limitedEdition", payload);

    } catch (error) {
        console.error("loadLimitedEdition error:", error);
        return res.status(statuscodes.SERVER_ERROR).send("Failed to load limited edition products");
    }
};

export const loadProductDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const payload = await loadProductDetailService({
            id,
            user: req.session?.user
        });

        res.locals.breadcrumbs = payload.breadcrumbs;

        return res.render("users/productDetail", {
            product: payload.product,
            similarProducts: payload.similarProducts
        });

    } catch (error) {
        console.error("loadProductDetail error:", error);
        if (error.statusCode === 302 && error.redirectUrl) {
            return res.redirect(error.redirectUrl);
        }
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).send(error.message || "Server error");
    }
};

export const searchProducts = async (req, res) => {
    try {
        const query = req.query.q?.trim();

        const result = await searchProductsService({ q: query });

        return res.json(result);

    } catch (error) {
        console.error('Search error:', error);
        return res.status(statuscodes.SERVER_ERROR).json({ products: [], message: 'Search failed' });
    }
};
