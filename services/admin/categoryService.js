import Category from "../../model/categoryModel.js";
import Product from "../../model/productModel.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadCategoryService = async ({ page = 1, search = "", filter = "all", sort = "default" }) => {
    const activePage = parseInt(page) || 1;
    const limit = 5;
    const skip = (activePage - 1) * limit;
    const filterParam = filter || "all";

    let dbFilter = {};

    if (filterParam === "deleted") {
        dbFilter.isDeleted = true;
    } else if (filterParam === "active") {
        dbFilter.isDeleted = false;
        dbFilter.isActive = true;
    } else if (filterParam === "inactive") {
        dbFilter.isDeleted = false;
        dbFilter.isActive = false;
    } else {
        dbFilter.isDeleted = false;
    }

    if (search) {
        dbFilter.name = { $regex: search, $options: "i" };
    }

    let sortOrder = { createdAt: -1 };
    if (sort === "name-asc")  sortOrder = { createdAt: -1 };
    if (sort === "name-desc") sortOrder = { createdAt: 1 };

    const [categories, totalCategories] = await Promise.all([
        Category.find(dbFilter).sort(sortOrder).skip(skip).limit(limit).lean(),
        Category.countDocuments(dbFilter),
    ]);

    for (let category of categories) {
        const count = await Product.countDocuments({
            category: category._id,
            isDeleted: false,
        });
        category.productCount = count;
    }

    const [totalCount, activeCount, inactiveCount] = await Promise.all([
        Category.countDocuments({ isDeleted: false }),
        Category.countDocuments({ isDeleted: false, isActive: true }),
        Category.countDocuments({ isDeleted: false, isActive: false }),
    ]);

    const totalPages = Math.ceil(totalCategories / limit);

    return {
        categories,
        currentPage: activePage,
        totalPages,
        totalCount,
        activeCount,
        inactiveCount,
        totalCategories,
        search,
        filter: filterParam,
        sort,
        hasPrevPage: activePage > 1,
        hasNextPage: activePage < totalPages,
        prevPage: activePage - 1,
        nextPage: activePage + 1,
        pageNumbers: Array.from({ length: totalPages }, (_, i) => i + 1),
    };
};

export const addCategoryService = async ({ name, isActive }) => {
    if (!name || name.trim() === "") {
        const err = new Error("Category name is required");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const trimmedName = name.trim();

    const existing = await Category.findOne({
        name: { $regex: `^${trimmedName}$`, $options: "i" },
        isDeleted: false,
    });

    if (existing) {
        const err = new Error("Category already exists");
        err.statusCode = statuscodes.CONFLICT;
        throw err;
    }

    const category = new Category({
        name: trimmedName,
        isActive: isActive ?? true,
    });

    await category.save();
    return { data: category, message: "Category added successfully" };
};

export const editCategoryService = async ({ id, name, isActive }) => {
    if (!name || name.trim() === "") {
        const err = new Error("Category name is required");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const trimmedName = name.trim();

    const existing = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: `^${trimmedName}$`, $options: "i" },
        isDeleted: false,
    });

    if (existing) {
         const err = new Error("Category name already exists");
         err.statusCode = statuscodes.CONFLICT;
         throw err;
    }

    const updated = await Category.findByIdAndUpdate(
        id,
        {
            name: trimmedName,
            isActive,
        },
        {
            returnDocument: "after",
            runValidators: true,
        }
    );

    if (!updated) {
        const err = new Error("Category not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    return { data: updated, message: "Category updated successfully" };
};

export const deleteCategoryService = async (id) => {
    const category = await Category.findById(id);

    if (!category) {
        const err = new Error("Category not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    await Category.findByIdAndUpdate(id, { isDeleted: true });
    return { message: "Category deleted successfully" };
};

export const restoreCategoryService = async (id) => {
    const category = await Category.findByIdAndUpdate(
        id,
        { isDeleted: false, isActive: true },
        { returnDocument: "after" }
    );

    if (!category) {
        const err = new Error("Category not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    return { message: "Category restored successfully" };
};
