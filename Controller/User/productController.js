import Product from "../../Model/productModel.js";
import User from "../../Model/userModel.js";
import Category from "../../Model/categoryModel.js";
import Brand from "../../Model/brandModel.js";

export const loadAllProducts = async (req, res) => {
    try {
        // ✅ Step 1 — get only active category and brand IDs first
        const [activeCategories, activeBrands] = await Promise.all([
            Category.find({ isActive: true, isDeleted: false }).select("_id name").lean(),
            Brand.find({ isActive: true, isDeleted: false }).select("_id name").lean()
        ]);

        const activeCategoryIds = activeCategories.map(c => c._id);
        const activeBrandIds = activeBrands.map(b => b._id);

        // ✅ Step 2 — filter products by active category and brand too
        const products = await Product.find({
            status: "active",
            isDeleted: false,
            category: { $in: activeCategoryIds },  // ← add this
            brand: { $in: activeBrandIds }          // ← add this
        })
            .populate("brand", "name")
            .populate("category", "name")
            .lean();

        // rest of your code stays exactly the same...
       let wishlistedIds = [];
       const sessionUser = req.session?.user;
       if (sessionUser) {
        const userId = sessionUser._id || sessionUser.id;
        const user = await User.findById(userId).select('wishlist').lean();
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
                defaultSize: Array.isArray(variant?.sizes)  // ← add this for cart
                    ? variant.sizes[0]
                    : variant?.sizes || "",
                stock_label,
                stock_icon,
                images: variant?.images || [],
                variantId: variant?._id ? String(variant._id) : "",
                isWishlisted: wishlistedIds.includes(String(product._id))
            };
        });

        res.render("users/allProduct", {
            breadcrumbs: [
               { label: 'Home', url: '/' },
               { label: 'All Products' } 
            ],
            products: shaped,
            categories: activeCategories,  // ← use already fetched active ones
            brands: activeBrands,          // ← use already fetched active ones
            user: req.session?.user || null
        });

    } catch (error) {
        console.error("loadAllProducts error:", error);
        res.status(500).send("Failed to load products");
    }
};

export const loadMens = async (req, res) => {
    try {
        // ✅ Get only active categories and brands first
        const [activeCategories, activeBrands] = await Promise.all([
            Category.find({ isActive: true, isDeleted: false }).select("_id name").lean(),
            Brand.find({ isActive: true, isDeleted: false }).select("_id name").lean()
        ]);

        const activeCategoryIds = activeCategories.map(c => c._id.toString());
        const activeBrandIds = activeBrands.map(b => b._id.toString());

        // ✅ Fetch only active, non-deleted products with active category & brand
        const products = await Product.find({
            status: "active",
            isDeleted: false,
            category: { $in: activeCategoryIds },
            brand: { $in: activeBrandIds }
        })
            .populate("brand", "name brandName")
            .populate("category", "name categoryName")
            .lean();

        // ✅ Filter ONLY MEN category
        const mensProducts = products.filter(product => {
            const categoryName =
                product.category?.name ||
                product.category?.categoryName;
            return categoryName?.toLowerCase() === "men";
        });

        // ✅ Get wishlist IDs if user is logged in
         let wishlistedIds = [];
         const sessionUser = req.session?.user;
        if (sessionUser) {
         const userId = sessionUser._id || sessionUser.id;
         const user = await User.findById(userId).select('wishlist').lean();
         wishlistedIds = (user?.wishlist || []).map(id => String(id));
        }

        // ✅ Shape data for frontend
        const shaped = mensProducts.map(product => {
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
                defaultSize: Array.isArray(variant?.sizes)  // ✅ add this
                    ? variant.sizes[0]
                    : variant?.sizes || "",
                stock_label,
                stock_icon,
                images: variant?.images || [],
                variantId: variant?._id ? String(variant._id) : "",
                isWishlisted: wishlistedIds.includes(String(product._id))
            };
        });

        res.render("users/mensCollection", {
             breadcrumbs: [
               { label: 'Home', url: '/' },
               { label: 'Mens' } 
            ],
            products: shaped,
            count: shaped.length,
            user: req.session?.user || null
        });

    } catch (error) {
        console.error("loadMens error:", error);
        res.status(500).send("Failed to load mens products");
    }
};

export const loadWomens = async (req, res) => {
    try {
        const [activeCategories, activeBrands] = await Promise.all([
            Category.find({ isActive: true, isDeleted: false }).select("_id name").lean(),
            Brand.find({ isActive: true, isDeleted: false }).select("_id name").lean()
        ]);

        const activeCategoryIds = activeCategories.map(c => c._id.toString());
        const activeBrandIds = activeBrands.map(b => b._id.toString());

        const products = await Product.find({
            status: "active",
            isDeleted: false,
            category: { $in: activeCategoryIds },
            brand: { $in: activeBrandIds }
        })
            .populate("brand", "name brandName")
            .populate("category", "name categoryName")
            .lean();

        // ✅ Filter ONLY WOMEN category
        const womensProducts = products.filter(product => {
            const categoryName =
                product.category?.name ||
                product.category?.categoryName;
            return categoryName?.toLowerCase() === "women";
        });

        let wishlistedIds = [];
         const sessionUser = req.session?.user;
       if (sessionUser) {
       const userId = sessionUser._id || sessionUser.id;
       const user = await User.findById(userId).select('wishlist').lean();
       wishlistedIds = (user?.wishlist || []).map(id => String(id));
       }

        const shaped = womensProducts.map(product => {
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
                defaultSize: Array.isArray(variant?.sizes)
                    ? variant.sizes[0]
                    : variant?.sizes || "",
                stock_label,
                stock_icon,
                images: variant?.images || [],
                variantId: variant?._id ? String(variant._id) : "",
                isWishlisted: wishlistedIds.includes(String(product._id))
            };
        });

        res.render("users/womensCollection", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Womens' }
            ],
            products: shaped,
            count: shaped.length,
            user: req.session?.user || null
        });

    } catch (error) {
        console.error("loadWomens error:", error);
        res.status(500).send("Failed to load womens products");
    }
};

export const loadLimitedEdition = async (req, res) => {
    try {
        const [activeCategories, activeBrands] = await Promise.all([
            Category.find({ isActive: true, isDeleted: false }).select("_id name").lean(),
            Brand.find({ isActive: true, isDeleted: false }).select("_id name").lean()
        ]);

        const activeCategoryIds = activeCategories.map(c => c._id.toString());
        const activeBrandIds = activeBrands.map(b => b._id.toString());

        // ✅ Fetch ONLY limited edition products
        const products = await Product.find({
            status: "active",
            isDeleted: false,
            isLimitedEdition: true,
            category: { $in: activeCategoryIds },
            brand: { $in: activeBrandIds }
        })
            .populate("brand", "name brandName")
            .populate("category", "name categoryName")
            .lean();

       let wishlistedIds = [];
       const sessionUser = req.session?.user;
     if (sessionUser) {
    const userId = sessionUser._id || sessionUser.id;
    const user = await User.findById(userId).select('wishlist').lean();
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
                badge: "LIMITED",
                rawPrice: variant?.price || 0,
                defaultSize: Array.isArray(variant?.sizes)
                    ? variant.sizes[0]
                    : variant?.sizes || "",
                stock_label,
                stock_icon,
                images: variant?.images || [],
                variantId: variant?._id ? String(variant._id) : "",
                isWishlisted: wishlistedIds.includes(String(product._id))
            };
        });

        res.render("users/limitedEdition", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Limited Edition' }
            ],
            products: shaped,
            count: shaped.length,
            user: req.session?.user || null
        });

    } catch (error) {
        console.error("loadLimitedEdition error:", error);
        res.status(500).send("Failed to load limited edition products");
    }
};

export const loadProductDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate("brand", "name brandName")
            .populate("category", "name categoryName")
            .lean();

        if (!product || product.isDeleted || product.status !== "active") {
            return res.status(404).send("Product not found");
        }

        const variant =
            product.variants?.find(v => v.isDefault && v.isActive) ||
            product.variants?.find(v => v.isActive) ||
            product.variants?.[0];

        if (!variant) {
            return res.status(404).send("No variant available");
        }

        const brandName =
            product.brand?.name ||
            product.brand?.brandName ||
            "Unknown Brand";

        const categoryName =
            product.category?.name ||
            product.category?.categoryName ||
            "Unknown Category";

        // GROUP VARIANTS BY COLOR
        const groups = {};

        product.variants
            .filter(v => v.isActive)
            .forEach(v => {
                const colorKey = (v.color || 'default').toLowerCase().trim();
                const sizes = (v.sizes || []).map(s => String(s));

                if (!groups[colorKey]) {
                    groups[colorKey] = {
                        id: v._id,
                        color: v.color,
                        price: v.price,
                        stock: v.stock,
                        sizes: sizes,
                        images: v.images || [],
                        isDefault: v.isDefault || false,
                        variantIds: Object.fromEntries(
                            sizes.length ? sizes.map(s => [s, String(v._id)]) : [['', String(v._id)]]
                        )
                    };
                } else {
                    // merge sizes
                    sizes.forEach(s => {
                        if (!groups[colorKey].sizes.includes(s)) {
                            groups[colorKey].sizes.push(s);
                        }
                        groups[colorKey].variantIds[s] = String(v._id);
                    });

                    groups[colorKey].stock += v.stock;

                    if (v.isDefault) {
                        groups[colorKey].id = v._id;
                        groups[colorKey].isDefault = true;
                        groups[colorKey].price = v.price;
                        groups[colorKey].images = v.images || [];
                    }
                }
            });

        const groupedVariants = Object.values(groups);

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
            variants: groupedVariants
        };

        const similarProductsRaw = await Product.find({
            _id: { $ne: product._id },
            category: product.category._id,
            brand: product.brand._id,
            status: "active",
            isDeleted: false
        })
            .limit(4)
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

        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: categoryName, url: '/users/allProduct' },
            { label: product.productName }
        ];

        res.render("users/productDetail", {
            product: shapedProduct,
            similarProducts
        });

    } catch (error) {
        console.error("loadProductDetail error:", error);
        res.status(500).send("Server error");
    }
};