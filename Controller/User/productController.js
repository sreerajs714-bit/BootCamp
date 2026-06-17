import Product from "../../Model/productModel.js";
import User from "../../Model/userModel.js";
import Category from "../../Model/categoryModel.js";
import Brand from "../../Model/brandModel.js";

import { getActiveOffers, calculateOfferPrice } from "../../utils/offer.js";

function shapeProduct(product, wishlistedIds, activeOffers) {
    const variant =
        product.variants?.find(v => v.isDefault && v.isActive) ||
        product.variants?.find(v => v.isActive) ||
        product.variants?.[0];

    let stock_label, stock_icon;
    if (!variant || variant.stock === 0) {
        stock_label = "Out of Stock";
        stock_icon  = "cancel";
    } else if (variant.stock <= 10) {
        stock_label = `Only ${variant.stock} left`;
        stock_icon  = "schedule";
    } else {
        stock_label = "In Stock";
        stock_icon  = "check_circle";
    }

    const brandName =
        product.brand?.name ||
        product.brand?.brandName ||
        "Unknown Brand";

    const categoryName =
        product.category?.name ||
        product.category?.categoryName ||
        "Unknown Category";

    const originalPrice = variant?.price || 0;

    // ── Offer pricing ──────────────────────────────────────────────────────
    const pricing = calculateOfferPrice(originalPrice, product, activeOffers);

    return {
        id:             product._id,
        productName:    product.productName,
        brand:          brandName,
        category:       product.category,
        badge:          product.isLimitedEdition ? "LIMITED" : "STANDARD",
        rawPrice:       originalPrice,
        discountedPrice: pricing.discountedPrice,
        discount:       pricing.discount,
        hasOffer:       pricing.hasOffer,
        offerLabel:     pricing.offer?.label || null,
        offerPercentage: pricing.offer
            ? pricing.offer.discountType === 'percentage'
                ? pricing.offer.discountValue
                : Math.round((pricing.discount / originalPrice) * 100)
            : 0,
        defaultSize:    Array.isArray(variant?.sizes) ? variant.sizes[0] : variant?.sizes || "",
        stock_label,
        stock_icon,
        images:         variant?.images || [],
        variantId:      variant?._id ? String(variant._id) : "",
        isWishlisted:   wishlistedIds.includes(String(product._id))
    };
}

async function getWishlistedIds(req) {
    const sessionUser = req.session?.user;
    if (!sessionUser) return [];
    const userId = sessionUser._id || sessionUser.id;
    const user = await User.findById(userId).select('wishlist').lean();
    return (user?.wishlist || []).map(id => String(id));
}

async function getActiveMeta() {
    const [activeCategories, activeBrands] = await Promise.all([
        Category.find({ isActive: true, isDeleted: false }).select("_id name").lean(),
        Brand.find({ isActive: true, isDeleted: false }).select("_id name").lean()
    ]);
    return { activeCategories, activeBrands };
}

export const loadAllProducts = async (req, res) => {
    try {
        const { activeCategories, activeBrands } = await getActiveMeta();
        const activeCategoryIds = activeCategories.map(c => c._id);
        const activeBrandIds    = activeBrands.map(b => b._id);

        const [products, wishlistedIds, activeOffers] = await Promise.all([
            Product.find({
                status: "active",
                isDeleted: false,
                category: { $in: activeCategoryIds },
                brand:    { $in: activeBrandIds }
            })
                .populate("brand",    "name")
                .populate("category", "name")
                .lean(),

            getWishlistedIds(req),
            getActiveOffers(),
        ]);

        const shaped = products.map(p => shapeProduct(p, wishlistedIds, activeOffers));

        res.render("users/allProduct", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'All Products' }
            ],
            products:   shaped,
            categories: activeCategories,
            brands:     activeBrands,
            user:       req.session?.user || null
        });

    } catch (error) {
        console.error("loadAllProducts error:", error);
        res.status(500).send("Failed to load products");
    }
};

export const loadMens = async (req, res) => {
    try {
        const { activeCategories, activeBrands } = await getActiveMeta();
        const activeCategoryIds = activeCategories.map(c => c._id.toString());
        const activeBrandIds    = activeBrands.map(b => b._id.toString());

        const [products, wishlistedIds, activeOffers] = await Promise.all([
            Product.find({
                status: "active",
                isDeleted: false,
                category: { $in: activeCategoryIds },
                brand:    { $in: activeBrandIds }
            })
                .populate("brand",    "name brandName")
                .populate("category", "name categoryName")
                .lean(),

            getWishlistedIds(req),
            getActiveOffers(),
        ]);

        const mensProducts = products.filter(p => {
            const name = p.category?.name || p.category?.categoryName;
            return name?.toLowerCase() === "men";
        });

        const shaped = mensProducts.map(p => shapeProduct(p, wishlistedIds, activeOffers));

        res.render("users/mensCollection", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Mens' }
            ],
            products: shaped,
            count:    shaped.length,
            user:     req.session?.user || null
        });

    } catch (error) {
        console.error("loadMens error:", error);
        res.status(500).send("Failed to load mens products");
    }
};

export const loadWomens = async (req, res) => {
    try {
        const { activeCategories, activeBrands } = await getActiveMeta();
        const activeCategoryIds = activeCategories.map(c => c._id.toString());
        const activeBrandIds    = activeBrands.map(b => b._id.toString());

        const [products, wishlistedIds, activeOffers] = await Promise.all([
            Product.find({
                status: "active",
                isDeleted: false,
                category: { $in: activeCategoryIds },
                brand:    { $in: activeBrandIds }
            })
                .populate("brand",    "name brandName")
                .populate("category", "name categoryName")
                .lean(),

            getWishlistedIds(req),
            getActiveOffers(),
        ]);

        const womensProducts = products.filter(p => {
            const name = p.category?.name || p.category?.categoryName;
            return name?.toLowerCase() === "women";
        });

        const shaped = womensProducts.map(p => shapeProduct(p, wishlistedIds, activeOffers));

        res.render("users/womensCollection", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Womens' }
            ],
            products: shaped,
            count:    shaped.length,
            user:     req.session?.user || null
        });

    } catch (error) {
        console.error("loadWomens error:", error);
        res.status(500).send("Failed to load womens products");
    }
};

export const loadLimitedEdition = async (req, res) => {
    try {
        const { activeCategories, activeBrands } = await getActiveMeta();
        const activeCategoryIds = activeCategories.map(c => c._id.toString());
        const activeBrandIds    = activeBrands.map(b => b._id.toString());

        const [products, wishlistedIds, activeOffers] = await Promise.all([
            Product.find({
                status:          "active",
                isDeleted:       false,
                isLimitedEdition: true,
                category: { $in: activeCategoryIds },
                brand:    { $in: activeBrandIds }
            })
                .populate("brand",    "name brandName")
                .populate("category", "name categoryName")
                .lean(),

            getWishlistedIds(req),
            getActiveOffers(),
        ]);

        const shaped = products.map(p => shapeProduct(p, wishlistedIds, activeOffers));

        res.render("users/limitedEdition", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Limited Edition' }
            ],
            products: shaped,
            count:    shaped.length,
            user:     req.session?.user || null
        });

    } catch (error) {
        console.error("loadLimitedEdition error:", error);
        res.status(500).send("Failed to load limited edition products");
    }
};

export const loadProductDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const [product, activeOffers] = await Promise.all([
            Product.findById(id)
                .populate("brand",    "name brandName")
                .populate("category", "name categoryName")
                .lean(),
            getActiveOffers(),
        ]);

        if (!product || product.isDeleted || product.status !== "active") {
            return res.status(404).send("Product not found");
        }

        const variant =
            product.variants?.find(v => v.isDefault && v.isActive) ||
            product.variants?.find(v => v.isActive) ||
            product.variants?.[0];

        if (!variant) return res.status(404).send("No variant available");

        const brandName =
            product.brand?.name ||
            product.brand?.brandName ||
            "Unknown Brand";

        const categoryName =
            product.category?.name ||
            product.category?.categoryName ||
            "Unknown Category";

        // ── Offer pricing for the default variant ─────────────────────────
        const pricing = calculateOfferPrice(variant.price, product, activeOffers);

        // ── Group variants by color ───────────────────────────────────────
        const groups = {};
        product.variants
            .filter(v => v.isActive)
            .forEach(v => {
                const colorKey = (v.color || 'default').toLowerCase().trim();
                const sizes    = (v.sizes || []).map(s => String(s));

                // Offer price per variant
                const vPricing = calculateOfferPrice(v.price, product, activeOffers);

                if (!groups[colorKey]) {
                    groups[colorKey] = {
                        id:              v._id,
                        color:           v.color,
                        price:           v.price,
                        discountedPrice: vPricing.discountedPrice,
                        discount:        vPricing.discount,
                        hasOffer:        vPricing.hasOffer,
                        stock:           v.stock,
                        sizes,
                        images:          v.images || [],
                        isDefault:       v.isDefault || false,
                        variantIds:      Object.fromEntries(
                            sizes.length
                                ? sizes.map(s => [s, String(v._id)])
                                : [['', String(v._id)]]
                        )
                    };
                } else {
                    sizes.forEach(s => {
                        if (!groups[colorKey].sizes.includes(s))
                            groups[colorKey].sizes.push(s);
                        groups[colorKey].variantIds[s] = String(v._id);
                    });
                    groups[colorKey].stock += v.stock;
                    if (v.isDefault) {
                        groups[colorKey].id              = v._id;
                        groups[colorKey].isDefault       = true;
                        groups[colorKey].price           = v.price;
                        groups[colorKey].discountedPrice = vPricing.discountedPrice;
                        groups[colorKey].discount        = vPricing.discount;
                        groups[colorKey].hasOffer        = vPricing.hasOffer;
                        groups[colorKey].images          = v.images || [];
                    }
                }
            });

        const groupedVariants = Object.values(groups);

        const shapedProduct = {
            id:              product._id,
            productName:     product.productName,
            description:     product.description,
            brand:           brandName,
            category:        categoryName,
            badge:           product.isLimitedEdition ? "LIMITED" : "STANDARD",
            price:           variant.price,
            discountedPrice: pricing.discountedPrice,
            discount:        pricing.discount,
            hasOffer:        pricing.hasOffer,
            offerLabel:      pricing.offer?.label || null,
            offerPercentage: pricing.offer
                ? pricing.offer.discountType === 'percentage'
                    ? pricing.offer.discountValue
                    : Math.round((pricing.discount / variant.price) * 100)
                : 0,
            stock:    variant.stock,
            sizes:    variant.sizes || [],
            images:   variant.images || [],
            variants: groupedVariants
        };

        // ── Similar products with offer pricing ───────────────────────────
        const similarProductsRaw = await Product.find({
            _id:       { $ne: product._id },
            category:  product.category._id,
            brand:     product.brand._id,
            status:    "active",
            isDeleted: false
        }).limit(4).lean();

        const similarProducts = similarProductsRaw.map(p => {
            const firstVariant =
                p.variants?.find(v => v.isDefault && v.isActive) ||
                p.variants?.find(v => v.isActive) ||
                p.variants?.[0];

            const sPricing = calculateOfferPrice(firstVariant?.price || 0, p, activeOffers);

            return {
                id:              p._id,
                productName:     p.productName,
                badge:           p.isLimitedEdition ? "LIMITED" : "STANDARD",
                price:           firstVariant?.price || 0,
                discountedPrice: sPricing.discountedPrice,
                hasOffer:        sPricing.hasOffer,
                discount:        sPricing.discount,
                images:          firstVariant?.images || []
            };
        });

        res.locals.breadcrumbs = [
            { label: 'Home',      url: '/' },
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