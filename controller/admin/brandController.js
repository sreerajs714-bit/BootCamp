import {
    loadBrandService,
    addBrandService,
    editBrandService,
    deleteBrandService,
    restoreBrandService
} from "../../services/admin/brandService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadBrand = async (req, res) => {
    try {
        const { pageNum, search, filter, sort } = req.query;

        const payload = await loadBrandService({
            page: pageNum,
            search,
            filter,
            sort
        });

        return res.render("admin/brandManagement", payload);

    } catch (error) {
        console.log("Get Brand Page Error:", error);
        return res.status(statuscodes.SERVER_ERROR).send("Server Error");
    }
};

export const addBrand = async (req, res) => {
    try {
        const { name, isActive } = req.body;

        const result = await addBrandService({ name, isActive });

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.log("Add Brand Error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
};

export const editBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;

        const result = await editBrandService({ id, name, isActive });

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.log("Edit Brand Error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
};

export const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await deleteBrandService(id);

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.log("Delete Brand Error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
};

export const restoreBrand = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await restoreBrandService(id);

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.log("Restore Brand Error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
};
