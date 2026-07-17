import Product from "../../model/productModel.js";
import Category from "../../model/categoryModel.js";
import Brand from "../../model/brandModel.js";
import { v2 as cloudinary } from "cloudinary";
import { validateProductPayload } from "../../utils/product.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadProductService = async ({ page = 1, search = "", category = "all", brand = "all", status = "all" }) => {
    const limit = 5;
    const skip = (page - 1) * limit;

    let filter = {};

    if (status === "deleted") {
        filter.isDeleted = true;
    } else if (status === "active") {
        filter.isDeleted = false;
        filter.status = "active";
    } else if (status === "inactive") {
        filter.isDeleted = false;
        filter.status = "inactive";
    } else {
        filter.isDeleted = false;
    }

    if (search.trim()) {
        const queryStr = search.trim();
        filter.$or = [
            { productName: { $regex: queryStr, $options: "i" } },
            { "variants.sku": { $regex: queryStr, $options: "i" } },
        ];
    }

    if (category !== "all") filter.category = category;
    if (brand !== "all") filter.brand = brand;

    const [products, totalProducts, categories, brands, activeCount, lowStockCount] = await Promise.all([
        Product.find(filter)
            .populate("category", "name")
            .populate("brand", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Product.countDocuments(filter),
        Category.find({ isDeleted: false, isActive: true }).select("name"),
        Brand.find({ isDeleted: false }).select("name"),
        Product.countDocuments({ isDeleted: false, status: "active" }),
        Product.countDocuments({ isDeleted: false, "variants.stock": { $lte: 10 } }),
    ]);

    const formattedProducts = products.map(p => {
        const product = p.toObject();
        const defaultVariant =
            product.variants.find(v => v.isDefault) ||
            product.variants[0] ||
            null;
        return { ...product, defaultVariant };
    });

    const totalPages = Math.ceil(totalProducts / limit) || 1;

    return {
        products: formattedProducts,
        categories,
        brands,
        currentPage: page,
        totalPages,
        totalProducts,
        search,
        category,
        brand,
        status,
        activeCount,
        lowStockCount,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page - 1,
        nextPage: page + 1,
        pageNumbers: Array.from({ length: totalPages }, (_, i) => i + 1),
    };
};

export const loadAddProductService = async () => {
    const [categories, brands] = await Promise.all([
        Category.find({ isDeleted: false, isActive: true }).select("name"),
        Brand.find({ isDeleted: false }).select("name"),
    ]);
    return { categories, brands };
};

export const addProductService = async ({ bodyData, files }) => {
    const validation = validateProductPayload(bodyData);
    if (validation.error) {
        const err = new Error(validation.error);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const {
        productName, description, color, sku,
        price, stock, sizes,
    } = validation.data;

    const { category, brand } = bodyData;

    if (!files || files.length < 3) {
        const err = new Error("Minimum 3 images are required.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const skuExists = await Product.findOne({
        "variants.sku": sku
    });

    if (skuExists) {
        const err = new Error("SKU already exists.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const rawStatus = bodyData.status;
    const status = Array.isArray(rawStatus)
        ? rawStatus[rawStatus.length - 1]
        : rawStatus || "active";

    const rawLimited = bodyData.isLimitedEdition;
    const isLimitedEdition = Array.isArray(rawLimited)
        ? rawLimited[rawLimited.length - 1] === "true"
        : rawLimited === "true";

    const imageUrls = files.map(
        file => file.secure_url || file.path
    );

    const variant = {
        color,
        sku,
        price,
        stock,
        sizes,
        images: imageUrls,
    };

    const product = new Product({
        productName,
        description,
        category,
        brand,
        isLimitedEdition,
        status,
        variants: [variant],
    });

    await product.save();
    return { message: "Product added successfully" };
};

export const loadEditProductService = async (id) => {
    const [product, categories, brands] = await Promise.all([
        Product.findById(id)
            .populate("category", "name")
            .populate("brand",    "name"),
        Category.find({ isDeleted: false, isActive: true }).select("name"),
        Brand.find({ isDeleted: false }).select("name"),
    ]);

    if (!product || product.isDeleted) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    return { product, categories, brands };
};

export const editProductService = async ({ id, bodyData, files }) => {
    const {
        category,
        brand,
        isLimitedEdition,
        status,
        variantId,
        existingImages,
    } = bodyData;

    const product = await Product.findById(id);
    if (!product || product.isDeleted) {
        const err = new Error("Product not found.");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const validation = validateProductPayload(bodyData);
    if (validation.error) {
        const err = new Error(validation.error);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const {
        productName, description, color, sku,
        price, stock, sizes: parsedSizes,
    } = validation.data;

    if (!category) {
        const err = new Error("Category is required.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }
    if (!brand) {
        const err = new Error("Brand is required.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const skuConflict = await Product.findOne({
        _id: { $ne: id },
        "variants.sku": sku,
    });
    if (skuConflict) {
        const err = new Error("SKU already in use by another product.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    let kept = [];
    if (existingImages) {
        try {
            kept = JSON.parse(existingImages);
            if (!Array.isArray(kept)) kept = [];
        } catch {
            kept = [];
        }
    }

    const newUrls = files ? files.map(f => f.path) : [];
    const allImages = [...kept, ...newUrls];

    if (allImages.length < 3) {
        for (const file of files || []) {
            try {
                await cloudinary.uploader.destroy(file.filename);
            } catch (cleanupErr) {
                console.error("Cloudinary cleanup error:", cleanupErr);
            }
        }
        const err = new Error(`Minimum 3 images required. Got ${allImages.length}.`);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    product.productName = productName;
    product.description = description;
    product.category    = category;
    product.brand       = brand;

    const limitedValues = Array.isArray(isLimitedEdition) ? isLimitedEdition : [isLimitedEdition];
    product.isLimitedEdition = limitedValues.includes("true");

    const statusValues = Array.isArray(status) ? status : [status];
    product.status = statusValues.includes("active") ? "active" : "inactive";

    const variant = variantId
        ? product.variants.id(variantId)
        : product.variants[0];

    if (!variant) {
        const err = new Error("Variant not found.");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    variant.color    = color;
    variant.sku      = sku;
    variant.price    = price;
    variant.stock    = stock;
    variant.sizes    = parsedSizes;
    variant.images   = allImages;
    variant.isActive = true;

    product.variants.forEach(v => { v.isDefault = false; });
    variant.isDefault = true;

    await product.save();
    return { message: "Product updated successfully." };
};

export const deleteProductService = async (id) => {
    const product = await Product.findById(id);

    if (!product || product.isDeleted) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    product.isDeleted = true;
    product.status = "inactive";

    await product.save();
    return { message: "Product deleted successfully" };
};

export const restoreProductService = async (id) => {
    const product = await Product.findById(id);

    if (!product) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    if (!product.isDeleted) {
        const err = new Error("Product is not deleted");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    product.isDeleted = false;
    product.status = "active";

    await product.save();
    return { message: "Product restored successfully" };
};

export const loadProductViewService = async (id) => {
    const product = await Product.findById(id)
        .populate("category", "name")
        .populate("brand", "name")
        .lean();

    if (!product || product.isDeleted) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const defaultVariant =
        product.variants.find(v => v.isDefault) ||
        product.variants[0];

    return { product, defaultVariant };
};

export const loadVariantsService = async ({ id, page = 1, status = "all", sort = "default", search = "" }) => {
    const limit  = 5;
    const searchTrimmed = search.trim().toLowerCase();

    const product = await Product.findById(id)
        .populate("category", "name")
        .populate("brand",    "name");

    if (!product || product.isDeleted) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    if (product.variants.length > 0) {
        const hasDefault = product.variants.some(v => v.isDefault);
        if (!hasDefault) {
            product.variants[0].isDefault = true;
            await product.save();
        }
    }

    let needsSave = false;
    product.variants.forEach(v => {
        if (v.isActive === undefined || v.isActive === null) {
            v.isActive = true;
            needsSave  = true;
        }
    });
    if (needsSave) await product.save();

    const productObj = product.toObject();

    let filtered = productObj.variants;
    if (searchTrimmed) {
        filtered = filtered.filter(v =>
            (v.sku   && v.sku.toLowerCase().includes(searchTrimmed)) ||
            (v.color && v.color.toLowerCase().includes(searchTrimmed))
        );
    }

    if (status === "active")   filtered = filtered.filter(v => v.isActive !== false);
    if (status === "inactive") filtered = filtered.filter(v => v.isActive === false);

    if (sort === "price-asc")  filtered = [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
    if (sort === "newest")     filtered = [...filtered].reverse();

    const totalVariants = filtered.length;
    const totalPages    = Math.ceil(totalVariants / limit) || 1;
    const safePage      = Math.min(Math.max(page, 1), totalPages);
    const startIdx      = (safePage - 1) * limit;
    const paginatedVariants = filtered.slice(startIdx, startIdx + limit);

    const activeCount = productObj.variants.filter(v => v.isActive !== false).length;

    return {
        product: productObj,
        variants: paginatedVariants,
        activeCount,
        totalVariants,
        currentPage: safePage,
        totalPages,
        hasPrevPage: safePage > 1,
        hasNextPage: safePage < totalPages,
        prevPage:    safePage - 1,
        nextPage:    safePage + 1,
        pageNumbers: Array.from({ length: totalPages }, (_, i) => i + 1),
    };
};

export const addVariantService = async ({ id, bodyData, files }) => {
    const { color, sku, price, stock, isActive, sizes } = bodyData;

    const parsedSizes = Array.isArray(sizes) ? sizes.map(Number) : (sizes ? [Number(sizes)] : []);
    if (parsedSizes.length === 0) {
        const err = new Error("At least one size is required.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const skuExists = await Product.findOne({ "variants.sku": sku.trim().toUpperCase() });
    if (skuExists) {
        const err = new Error("SKU already exists.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    if (!files || files.length < 3) {
        const err = new Error("Minimum 3 images required.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const product = await Product.findById(id);
    if (!product) {
        const err = new Error("Product not found.");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const normalizedColor = color.trim().toLowerCase();
    const sortedNewSizes = [...parsedSizes].sort();

    const isDuplicate = product.variants.some(v => {
        const sameColor = v.color.trim().toLowerCase() === normalizedColor;
        const sortedExistingSizes = [...v.sizes].map(Number).sort();
        const sameSizes =
            sortedExistingSizes.length === sortedNewSizes.length &&
            sortedExistingSizes.every((s, i) => s === sortedNewSizes[i]);
        return sameColor && sameSizes;
    });

    if (isDuplicate) {
        const err = new Error("A variant with this color and size already exists for this product.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const imagePaths = files.map(file => file.secure_url || file.path);

    product.variants.push({
        color: color.trim(),
        sku: sku.trim().toUpperCase(),
        price: Number(price),
        stock: Number(stock),
        isActive: isActive === "true" || isActive === true,
        sizes: parsedSizes,
        images: imagePaths,
        isDefault: product.variants.length === 0
    });

    await product.save();
    return { message: "Variant added successfully." };
};

export const editVariantService = async ({ id, variantId, bodyData, files }) => {
    const { color, sku, price, stock, isActive, sizes, existingImages } = bodyData;

    const parsedSizes = Array.isArray(sizes) ? sizes.map(Number) : (sizes ? [Number(sizes)] : []);
    if (parsedSizes.length === 0) {
        const err = new Error("At least one size is required.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const skuConflict = await Product.findOne({
        _id: { $ne: id },
        "variants.sku": sku.trim().toUpperCase()
    });
    if (skuConflict) {
        const err = new Error("SKU already in use by another product.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const product = await Product.findById(id);
    if (!product) {
        const err = new Error("Product not found.");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
        const err = new Error("Variant not found.");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const duplicateSku = product.variants.some(v => v.sku === sku.trim().toUpperCase() && v._id.toString() !== variantId);
    if (duplicateSku) {
        const err = new Error("SKU already in use by another variant of this product.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    let kept = [];
    if (existingImages) {
        try {
            kept = JSON.parse(existingImages);
        } catch {
            kept = [];
        }
    }
    const newUrls = files ? files.map(f => f.secure_url || f.path) : [];
    const allImages = [...kept, ...newUrls];

    if (allImages.length < 3) {
        const err = new Error(`Minimum 3 images required. Got ${allImages.length}.`);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    variant.color = color.trim();
    variant.sku = sku.trim().toUpperCase();
    variant.price = Number(price);
    variant.stock = Number(stock);
    variant.isActive = isActive === "true" || isActive === true;
    variant.sizes = parsedSizes;
    variant.images = allImages;

    await product.save();
    return { message: "Variant updated successfully." };
};

export const deleteVariantService = async ({ id, variantId }) => {
    const product = await Product.findById(id);
    if (!product) {
        const err = new Error("Product not found.");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
        const err = new Error("Variant not found.");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    product.variants.pull(variantId);
    await product.save();
    return { message: "Variant deleted successfully." };
};

export const setDefaultVariantService = async ({ productId, variantId }) => {
    const product = await Product.findById(productId);

    if (!product || product.isDeleted) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    product.variants.forEach(v => {
        v.isDefault = false;
    });

    const targetVariant = product.variants.id(variantId);

    if (!targetVariant) {
        const err = new Error("Variant not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    targetVariant.isDefault = true;

    await product.save();
    return { message: "Default variant updated successfully" };
};
