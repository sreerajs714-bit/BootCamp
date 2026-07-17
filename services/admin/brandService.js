import Product from "../../model/productModel.js";
import Brand from "../../model/brandModel.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadBrandService = async ({ page = 1, search = "", filter = "all", sort = "default" }) => {
    const activePage = parseInt(page);
    const limit = 5;
    const skip = (activePage - 1) * limit;

    const dbFilter = {};

    if (search) {
        dbFilter.name = { $regex: search, $options: "i" };
    }

    if (filter === "active") {
        dbFilter.isDeleted = false;
        dbFilter.isActive = true;
    } else if (filter === "inactive") {
        dbFilter.isDeleted = false;
        dbFilter.isActive = false;
    } else if (filter === "deleted") {
        dbFilter.isDeleted = true;
    }

    let sortOption = { createdAt: -1 };
    if (sort === "name-asc")  sortOption = { createdAt: -1 };
    if (sort === "name-desc") sortOption = { createdAt: 1 };

    const brands = await Brand.find(dbFilter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();

    for (let brand of brands) {
        const count = await Product.countDocuments({
            brand: brand._id,
            isDeleted: false,
        });
        brand.productCount = count;
    }

    const [totalCount, activeCount, inactiveCount] = await Promise.all([
        Brand.countDocuments({ isDeleted: false }),
        Brand.countDocuments({ isDeleted: false, isActive: true }),
        Brand.countDocuments({ isDeleted: false, isActive: false }),
    ]);

    const filteredCount = await Brand.countDocuments(dbFilter);
    const totalPages = Math.ceil(filteredCount / limit);

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);

    return {
        brands,
        totalCount,
        activeCount,
        inactiveCount,
        currentPage: activePage,
        totalPages,
        hasPrevPage: activePage > 1,
        hasNextPage: activePage < totalPages,
        prevPage: activePage - 1,
        nextPage: activePage + 1,
        pageNumbers,
        search,
        filter,
        sort,
    };
};

export const addBrandService = async ({ name, isActive }) => {
    if (!name || !name.trim()) {
        const err = new Error("Brand name is required");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const trimmedName = name.trim();

    const existingBrand = await Brand.findOne({
        name: { $regex: `^${trimmedName}$`, $options: "i" },
    });

    if (existingBrand && !existingBrand.isDeleted) {
        const err = new Error("Brand already exists");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    if (existingBrand && existingBrand.isDeleted) {
        existingBrand.isDeleted = false;
        existingBrand.isActive = isActive;
        await existingBrand.save();
        return { message: "Brand restored successfully" };
    }

    const newBrand = new Brand({
        name: trimmedName,
        isActive,
    });
    await newBrand.save();
    return { message: "Brand added successfully" };
};

export const editBrandService = async ({ id, name, isActive }) => {
    if (!name || !name.trim()) {
        const err = new Error("Brand name is required");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const trimmedName = name.trim();

    const existingBrand = await Brand.findOne({
        _id: { $ne: id },
        name: { $regex: `^${trimmedName}$`, $options: "i" },
        isDeleted: false,
    });

    if (existingBrand) {
        const err = new Error("Brand name already exists");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    await Brand.findByIdAndUpdate(id, {
        name: trimmedName,
        isActive,
    });
    return { message: "Brand updated successfully" };
};

export const deleteBrandService = async (id) => {
    const brand = await Brand.findById(id);

    if (!brand) {
        const err = new Error("Brand not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    brand.isDeleted = true;
    brand.isActive = false;
    await brand.save();

    return { message: "Brand deleted successfully" };
};

export const restoreBrandService = async (id) => {
    const brand = await Brand.findById(id);

    if (!brand) {
        const err = new Error("Brand not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    if (!brand.isDeleted) {
        const err = new Error("Brand is not deleted");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    brand.isDeleted = false;
    brand.isActive = true;
    await brand.save();

    return { message: "Brand restored successfully" };
};
