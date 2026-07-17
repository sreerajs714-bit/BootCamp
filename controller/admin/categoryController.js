import {
    loadCategoryService,
    addCategoryService,
    editCategoryService,
    deleteCategoryService,
    restoreCategoryService
} from "../../services/admin/categoryService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadCategory = async (req, res) => {
  try {
    const { page, search, filter, sort } = req.query;

    const payload = await loadCategoryService({ page, search, filter, sort });

    return res.render("admin/category", payload);

  } catch (error) {
    console.error("loadCategory error:", error);
    return res.status(statuscodes.SERVER_ERROR).send("Internal server error");
  }
};

export const addCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body;

    const result = await addCategoryService({ name, isActive });

    return res.status(statuscodes.CREATED).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error("addCategory error:", error);
    return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const result = await editCategoryService({ id, name, isActive });

    return res.status(statuscodes.OK).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error("editCategory error:", error);
    return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await deleteCategoryService(id);

    return res.status(statuscodes.OK).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error("deleteCategory error:", error);
    return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const restoreCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await restoreCategoryService(id);

    return res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error("restoreCategory error:", error);
    return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};
