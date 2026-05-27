import Product from "../../Model/productModel.js";
import User from "../../Model/userModel.js";
import Category from "../../Model/categoryModel.js";
import Brand from "../../Model/brandModel.js";

export const loadAllProducts = async (req, res) => {
    try {
        const products = await Product.find({
            status: "active",
            isDeleted: false
        })
            .populate("brand", "name")
            .populate("category", "name")
            .lean();

        // Get wishlist IDs if user is logged in
        let wishlistedIds = [];
        if (req.user) {
            const user = await User.findById(req.user._id).select('wishlist').lean();
            wishlistedIds = (user?.wishlist || []).map(id => String(id));
        }

        const shaped = products.map(product => {
            const variant =
                product.variants?.find(v => v.isDefault && v.isActive) ||
                product.variants?.find(v => v.isActive) ||
                product.variants?.[0];

            let stock_label, stock_icon;
            if (!variant || variant.stock === 0) {
                stock_label = "Out of Stock";
                stock_icon = "cancel";
            } else if (variant.stock <= 10) {
                stock_label = `Only ${variant.stock} left`;
                stock_icon = "schedule";
            } else {
                stock_label = "In Stock";
                stock_icon = "check_circle";
            }

            return {
                id: product._id,
                productName: product.productName,
                brand: product.brand?.name || "Unknown Brand",
                category: product.category,
                badge: product.isLimitedEdition ? "LIMITED" : "STANDARD",
                rawPrice: variant?.price || 0,
                stock_label,
                stock_icon,
                images: variant?.images || [],
                variantId: variant?._id ? String(variant._id) : "",
                isWishlisted: wishlistedIds.includes(String(product._id))
            };
        });

        // Get all active categories and brands for filter chips
        const [categories, brands] = await Promise.all([
            Category.find({ isActive: true, isDeleted: false }).select("name").lean(),
            Brand.find({ isDeleted: false }).select("name").lean()
        ]);

        res.render("users/allProduct", {
            products: shaped,
            categories,
            brands,
            user: req.user || null
        });

    } catch (error) {
        console.error("loadAllProducts error:", error);
        res.status(500).send("Failed to load products");
    }
};

export const loadMens = async (req, res) => {
    try {
        
        // 1. Fetch only active, non-deleted products
        const products = await Product.find({
            status: "active",
            isDeleted: false
        })
            .populate("brand", "name brandName")
            .populate("category", "name categoryName")
            .lean();


        // 2. Filter ONLY MEN category (IMPORTANT)
        const mensProducts = products.filter(product => {
            const categoryName =
                product.category?.name ||
                product.category?.categoryName;

            return categoryName?.toLowerCase() === "men";
        });

        // ✅ GET wishlist IDs if user is logged in
        let wishlistedIds = [];
        if (req.user) {
            const user = await User.findById(req.user._id).select('wishlist').lean();
            wishlistedIds = (user?.wishlist || []).map(id => String(id));
        }

        // 3. Shape data for frontend
        const shaped = mensProducts.map(product => {

            // pick best variant
            const variant =
                product.variants?.find(v => v.isDefault && v.isActive) ||
                product.variants?.find(v => v.isActive) ||
                product.variants?.[0];

            // stock logic
            let stock_label, stock_icon;

            if (!variant || variant.stock === 0) {
                stock_label = "Out of Stock";
                stock_icon = "cancel";
            } else if (variant.stock <= 10) {
                stock_label = `Only ${variant.stock} left`;
                stock_icon = "schedule";
            } else {
                stock_label = "In Stock";
                stock_icon = "check_circle";
            }

            // safe brand & category
            const brandName =
                product.brand?.name ||
                product.brand?.brandName ||
                "Unknown Brand";

            const categoryName =
                product.category?.name ||
                product.category?.categoryName ||
                "Unknown Category";

            return {
                id: product._id,
                productName: product.productName,
                brand: brandName,
                category: categoryName,

                badge: product.isLimitedEdition ? "LIMITED" : "STANDARD",

                rawPrice: variant?.price || 0,

                stock_label,
                stock_icon,

                images: variant?.images || [],
                variantId: variant && variant._id ? String(variant._id) : "",

                // ✅ ADD THIS
                isWishlisted: wishlistedIds.includes(String(product._id))
            };
        });

        // 4. Render page
        res.render("users/mensCollection", {
            products: shaped,
            count: shaped.length,
            user: req.user || null  // ✅ ADD THIS — needed for isLoggedIn check in frontend
        });

    } catch (error) {
        console.error("loadMens error:", error);
        res.status(500).send("Failed to load mens products");
    }
};

export const loadProductDetail = async (req, res) => {
    try {
        const { id } = req.params;

        // CURRENT PRODUCT
        const product = await Product.findById(id)
            .populate("brand", "name brandName")
            .populate("category", "name categoryName")
            .lean();

        if (!product || product.isDeleted || product.status !== "active") {
            return res.status(404).send("Product not found");
        }

        // DEFAULT VARIANT
        const variant =
            product.variants?.find(v => v.isDefault && v.isActive) ||
            product.variants?.find(v => v.isActive) ||
            product.variants?.[0];

        if (!variant) {
            return res.status(404).send("No variant available");
        }

        // BRAND & CATEGORY
        const brandName =
            product.brand?.name ||
            product.brand?.brandName ||
            "Unknown Brand";

        const categoryName =
            product.category?.name ||
            product.category?.categoryName ||
            "Unknown Category";

        // MAIN PRODUCT SHAPE
        const shapedProduct = {
            id: product._id,

            productName: product.productName,
            description: product.description,

            brand: brandName,
            category: categoryName,

            badge: product.isLimitedEdition ? "LIMITED" : "STANDARD",

            price: variant.price,
            stock: variant.stock,

            sizes: variant.sizes || [],
            images: variant.images || [],

            variants: product.variants
                .filter(v => v.isActive)
                .map(v => ({
                    id: v._id,
                    color: v.color,
                    price: v.price,
                    stock: v.stock,
                    sizes: v.sizes || [],
                    images: v.images || [],
                    isDefault: v.isDefault
                }))
        };

        // SIMILAR PRODUCTS
        const similarProductsRaw = await Product.find({
            _id: { $ne: product._id },
            category: product.category._id,
            status: "active",
            isDeleted: false
        })
            .limit(8)
            .lean();

        const similarProducts = similarProductsRaw.map(p => {

            const firstVariant =
                p.variants?.find(v => v.isDefault && v.isActive) ||
                p.variants?.find(v => v.isActive) ||
                p.variants?.[0];

            return {
                id: p._id,
                productName: p.productName,
                badge: p.isLimitedEdition ? "LIMITED" : "STANDARD",

                price: firstVariant?.price || 0,

                images: firstVariant?.images || []
            };
        });

        // RENDER
        res.render("users/productDetail", {
            product: shapedProduct,
            similarProducts
        });

    } catch (error) {
        console.error("loadProductDetail error:", error);
        res.status(500).send("Server error");
    }
};

