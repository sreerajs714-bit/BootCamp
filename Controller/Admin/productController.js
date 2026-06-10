import Product from "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";
import Brand from "../../Model/brandModel.js";



export const loadProduct = async (req, res) => {
    try {
        const page     = parseInt(req.query.page) || 1;
        const limit    = 5;
        const skip     = (page - 1) * limit;
        const search   = req.query.search || "";
        const category = req.query.category || "all";
        const brand    = req.query.brand || "all";
        const status   = req.query.status || "all";

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
            delete filter.status;
        }

        if (search) {
            filter.$or = [
                { productName: { $regex: search, $options: "i" } },
                { "variants.sku": { $regex: search, $options: "i" } },
            ];
        }

        if (category !== "all") filter.category = category;
        if (brand !== "all") filter.brand = brand;

        const [products, totalProducts, categories, brands,activeCount, lowStockCount] = await Promise.all([
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

        // ⭐ IMPORTANT FIX: attach defaultVariant
        const formattedProducts = products.map(p => {
            const product = p.toObject();

            const defaultVariant =
                product.variants.find(v => v.isDefault) ||
                product.variants[0] ||
                null;

            return {
                ...product,
                defaultVariant,
            };
        });

        const totalPages = Math.ceil(totalProducts / limit);

        res.render("Admin/productManagement", {
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
        });

    } catch (error) {
        console.error("loadProduct error:", error);
        res.redirect("/admin/dashboard");
    }
};

export const loadAddProduct = async (req, res) => {
    try {
        const [categories, brands] = await Promise.all([
            Category.find({ isDeleted: false, isActive: true }).select("name"),
            Brand.find({ isDeleted: false }).select("name"),
        ]);
        res.render("Admin/addProduct", { categories, brands });
    } catch (error) {
        console.error("loadAddProduct error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const addProduct = async (req, res) => {
    try {

        const {
            productName,
            description,
            category,
            brand,
            color,
            sku,
            price,
            stock,
            sizes,
        } = req.body;

        if (
            !productName ||
            !description ||
            !category ||
            !brand ||
            !color ||
            !sku ||
            !price ||
            !stock
        ) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be filled."
            });
        }

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Minimum 3 images are required."
            });
        }

        const skuExists = await Product.findOne({
            "variants.sku": sku.toUpperCase()
        });

        if (skuExists) {
            return res.status(400).json({
                success: false,
                message: "SKU already exists."
            });
        }

        const rawStatus = req.body.status;

        const status = Array.isArray(rawStatus)
            ? rawStatus[rawStatus.length - 1]
            : rawStatus || "active";

        const rawLimited = req.body.isLimitedEdition;

        const isLimitedEdition = Array.isArray(rawLimited)
            ? rawLimited[rawLimited.length - 1] === "true"
            : rawLimited === "true";

        const imageUrls = req.files.map(
            file => file.secure_url || file.path
        );

        const variant = {
            color: color.trim(),
            sku: sku.trim().toUpperCase(),
            price: Number(price),
            stock: Number(stock),
            sizes: Array.isArray(sizes)
                ? sizes.map(Number)
                : [Number(sizes)],
            images: imageUrls,
        };

        const product = new Product({
            productName: productName.trim(),
            description: description.trim(),
            category,
            brand,
            isLimitedEdition,
            status,
            variants: [variant],
        });

        await product.save();

        return res.status(200).json({
            success: true,
            message: "Product added successfully"
        });

    } catch (error) {

        console.error("addProduct error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add product"
        });
    }
};

export const loadEditProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const [product, categories, brands] = await Promise.all([
            Product.findById(id)
                .populate("category", "name")
                .populate("brand",    "name"),
            Category.find({ isDeleted: false, isActive: true }).select("name"),
            Brand.find({ isDeleted: false }).select("name"),
        ]);

        if (!product || product.isDeleted) {
            return res.redirect("/admin/productManagement");
        }

        res.render("Admin/editProduct", { product, categories, brands });

    } catch (error) {
        console.error("loadEditProduct error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const editProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            productName,
            description,
            category,
            brand,
            isLimitedEdition,
            status,
            variantId,
            color,
            sku,
            price,
            stock,
            sizes,
            existingImages,  // JSON string: array of cloudinary URLs already saved
        } = req.body;
 
        // ── Find product ─────────────────────────────────────
        const product = await Product.findById(id);
        if (!product || product.isDeleted) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }
 
        // ── Validate required fields ──────────────────────────
        if (!productName?.trim())  return res.status(400).json({ success: false, message: "Product name is required." });
        if (!description?.trim())  return res.status(400).json({ success: false, message: "Description is required." });
        if (!category)             return res.status(400).json({ success: false, message: "Category is required." });
        if (!brand)                return res.status(400).json({ success: false, message: "Brand is required." });
        if (!color?.trim())        return res.status(400).json({ success: false, message: "Color is required." });
        if (!sku?.trim())          return res.status(400).json({ success: false, message: "SKU is required." });
        if (!price || isNaN(Number(price))) return res.status(400).json({ success: false, message: "Valid price is required." });
        if (!stock || isNaN(Number(stock))) return res.status(400).json({ success: false, message: "Valid stock is required." });
 
        // ── Parse sizes ───────────────────────────────────────
        // body-parser gives a string when one value, array when multiple
        const parsedSizes = Array.isArray(sizes)
            ? sizes.map(Number)
            : sizes
                ? [Number(sizes)]
                : [];
 
        if (parsedSizes.length === 0) {
            return res.status(400).json({ success: false, message: "At least one size is required." });
        }
 
        // ── Duplicate SKU check (exclude self) ───
        const skuConflict = await Product.findOne({
            _id: { $ne: id },
            "variants.sku": sku.trim().toUpperCase(),
        });
        if (skuConflict) {
            return res.status(400).json({ success: false, message: "SKU already in use by another product." });
        }
 
        // ── Parse existing images (URLs to keep) ──
        let kept = [];
        if (existingImages) {
            try {
                kept = JSON.parse(existingImages);
                if (!Array.isArray(kept)) kept = [];
            } catch {
                kept = [];
            }
        }
 
        const newUrls = req.files ? req.files.map(f => f.path) : [];
 
        const allImages = [...kept, ...newUrls];
 
        if (allImages.length < 3) {
            // Clean up newly uploaded files from Cloudinary since we're rejecting
            for (const file of req.files || []) {
                try {
                    await cloudinary.uploader.destroy(file.filename);
                } catch (cleanupErr) {
                    console.error("Cloudinary cleanup error:", cleanupErr);
                }
            }
            return res.status(400).json({
                success: false,
                message: `Minimum 3 images required. Got ${allImages.length}.`,
            });
        }
 
        // ── Update base product fields ────────────────────────
        product.productName      = productName.trim();
        product.description      = description.trim();
        product.category         = category;
        product.brand            = brand;
        const limitedValues = Array.isArray(isLimitedEdition) ? isLimitedEdition : [isLimitedEdition];
        product.isLimitedEdition = limitedValues.includes("true");
        const statusValues = Array.isArray(status) ? status : [status];
        product.status = statusValues.includes("active") ? "active" : "inactive";

       // ── Update variant ────────────────────────────────────
         const variant = variantId 
         ? product.variants.id(variantId) 
         : product.variants[0];  // ← fallback to first variant

           if (!variant) {
          return res.status(404).json({ success: false, message: "Variant not found." });
        }
 
        variant.color    = color.trim();
        variant.sku      = sku.trim().toUpperCase();
        variant.price    = Number(price);
        variant.stock    = Number(stock);
        variant.sizes    = parsedSizes;
        variant.images   = allImages;
        variant.isActive = true;
        variant.isDefault = true;
        await product.save();
 
        return res.json({ success: true, message: "Product updated successfully." });
 
    } catch (error) {
        console.error("editProduct error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product || product.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        product.isDeleted = true;
        product.status = "inactive";

        await product.save();

        return res.json({
            success: true,
            message: "Product deleted successfully",
        });

    } catch (error) {
        console.error("deleteProduct error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const restoreProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        if (!product.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Product is not deleted",
            });
        }

        product.isDeleted = false;
        product.status = "active";

        await product.save();

        return res.json({
            success: true,
            message: "Product restored successfully",
        });

    } catch (error) {
        console.error("restoreProduct error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const loadProductView = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate("category", "name")
            .populate("brand", "name")
            .lean();

        if (!product || product.isDeleted) {
            return res.redirect("/admin/productManagement");
        }

        // ✅ FIND DEFAULT VARIANT
        const defaultVariant =
            product.variants.find(v => v.isDefault) ||
            product.variants[0];

        res.render("Admin/productView", {
            product,
            defaultVariant
        });

    } catch (error) {
        console.error("loadProductView error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const loadVariants = async (req, res) => {
    try {
        const { id } = req.params;
        const page   = parseInt(req.query.page) || 1;
        const limit  = 5;
        const status = req.query.status || "all";
        const sort   = req.query.sort   || "default";
        const search = (req.query.search || "").trim().toLowerCase();

        const product = await Product.findById(id)
            .populate("category", "name")
            .populate("brand",    "name");

        if (!product || product.isDeleted) {
            return res.redirect("/admin/productManagement");
        }

        // ── Set first as default if none ─────────────────────────
        if (product.variants.length > 0) {
            const hasDefault = product.variants.some(v => v.isDefault);
            if (!hasDefault) {
                product.variants[0].isDefault = true;
                await product.save();
            }
        }

        // ── Fix missing isActive ──────────────────────────────────
        let needsSave = false;
        product.variants.forEach(v => {
            if (v.isActive === undefined || v.isActive === null) {
                v.isActive = true;
                needsSave  = true;
            }
        });
        if (needsSave) await product.save();

        const productObj = product.toObject();

        // ── Search by SKU or color ────────────────────────────────
        let filtered = productObj.variants;
        if (search) {
            filtered = filtered.filter(v =>
                (v.sku   && v.sku.toLowerCase().includes(search)) ||
                (v.color && v.color.toLowerCase().includes(search))
            );
        }

        // ── Filter by status ──────────────────────────────────────
        if (status === "active")   filtered = filtered.filter(v => v.isActive !== false);
        if (status === "inactive") filtered = filtered.filter(v => v.isActive === false);

        // ── Sort ──────────────────────────────────────────────────
        if (sort === "price-asc")  filtered = [...filtered].sort((a, b) => a.price - b.price);
        if (sort === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
        if (sort === "newest")     filtered = [...filtered].reverse();

        // ── Paginate ──────────────────────────────────────────────
        const totalVariants = filtered.length;
        const totalPages    = Math.ceil(totalVariants / limit) || 1;
        const safePage      = Math.min(Math.max(page, 1), totalPages);
        const startIdx      = (safePage - 1) * limit;
        const paginatedVariants = filtered.slice(startIdx, startIdx + limit);

        const activeCount = productObj.variants.filter(v => v.isActive !== false).length;

        res.render("Admin/viewVariants", {
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
            status,
            sort,
            search: req.query.search || "",
        });

    } catch (error) {
        console.error("loadVariants error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const addVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { color, sku, price, stock, isActive, sizes } = req.body;

        const parsedSizes = Array.isArray(sizes) ? sizes.map(Number) : (sizes ? [Number(sizes)] : []);
        if (parsedSizes.length === 0) {
            return res.status(400).json({ success: false, message: "At least one size is required." });
        }

        const skuExists = await Product.findOne({ "variants.sku": sku.trim().toUpperCase() });
        if (skuExists) {
            return res.status(400).json({ success: false, message: "SKU already exists." });
        }

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({ success: false, message: "Minimum 3 images required." });
        }

        const imagePaths = req.files.map(file => file.secure_url || file.path);

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

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

        return res.status(201).json({ success: true, message: "Variant added successfully." });

    } catch (error) {
        console.error("addVariant error:", error);
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

export const editVariant = async (req, res) => {
    try {
        const { id, variantId } = req.params;
        const { color, sku, price, stock, isActive, sizes, existingImages } = req.body;

        const parsedSizes = Array.isArray(sizes) ? sizes.map(Number) : (sizes ? [Number(sizes)] : []);
        if (parsedSizes.length === 0) {
            return res.status(400).json({ success: false, message: "At least one size is required." });
        }

        // SKU conflict check (exclude current variant)
        const skuConflict = await Product.findOne({
            _id: { $ne: id },
            "variants.sku": sku.trim().toUpperCase()
        });
        if (skuConflict) {
            return res.status(400).json({ success: false, message: "SKU already in use by another product." });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        const duplicateSku = product.variants.some(v => v.sku === sku.trim().toUpperCase() && v._id.toString() !== variantId);
        if (duplicateSku) {
            return res.status(400).json({ success: false, message: "SKU already in use by another variant of this product." });
        }

        let kept = [];
        if (existingImages) {
            try {
                kept = JSON.parse(existingImages);
            } catch {
                kept = [];
            }
        }
        const newUrls = req.files ? req.files.map(f => f.secure_url || f.path) : [];
        const allImages = [...kept, ...newUrls];

        if (allImages.length < 3) {
            return res.status(400).json({ success: false, message: `Minimum 3 images required. Got ${allImages.length}.` });
        }

        variant.color = color.trim();
        variant.sku = sku.trim().toUpperCase();
        variant.price = Number(price);
        variant.stock = Number(stock);
        variant.isActive = isActive === "true" || isActive === true;
        variant.sizes = parsedSizes;
        variant.images = allImages;

        await product.save();

        return res.status(200).json({ success: true, message: "Variant updated successfully." });

    } catch (error) {
        console.error("editVariant error:", error);
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

export const deleteVariant = async (req, res) => {
    try {
        const { id, variantId } = req.params;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        product.variants.pull(variantId);
        await product.save();

        return res.status(200).json({ success: true, message: "Variant deleted successfully." });

    } catch (error) {
        console.error("deleteVariant error:", error);
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

export const setDefaultVariant = async (req, res) => {
    try {
        const { productId, variantId } = req.body;

        const product = await Product.findById(productId);

        if (!product || product.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // ✅ Reset all variants
        product.variants.forEach(v => {
            v.isDefault = false;
        });

        // ✅ Set selected variant
        const targetVariant = product.variants.id(variantId);

        if (!targetVariant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        targetVariant.isDefault = true;

        await product.save();

        return res.json({
            success: true,
            message: "Default variant updated successfully"
        });

    } catch (error) {
        console.error("setDefaultVariant error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

