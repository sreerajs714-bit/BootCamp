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

function buildPages(totalPages, page) {
    return Array.from({ length: totalPages }, (_, i) => ({
        number: i + 1,
        isCurrent: i + 1 === page
    }));
}

async function getActiveMeta() {
    const [activeCategories, activeBrands] = await Promise.all([
        Category.find({ isActive: true, isDeleted: false }).select("_id name").lean(),
        Brand.find({ isActive: true, isDeleted: false }).select("_id name").lean()
    ]);
    return { activeCategories, activeBrands };
}

const PRODUCTS_PER_PAGE = 8;

async function getPaginatedProducts(baseMatch, query, { categoryName } = {}) {
    const page   = Math.max(1, parseInt(query.page) || 1);
    const search = (query.search || '').trim();
    const sort   = query.sort || 'newest';
    const minPrice = query.minPrice ? Number(query.minPrice) : null;
    const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;

    const { activeCategories, activeBrands } = await getActiveMeta();
    const activeCategoryIds = activeCategories.map(c => c._id);
    const activeBrandIds    = activeBrands.map(b => b._id);

    // Restrict to a specific category by name (used by Men's/Women's pages).
    // Defensive against both `name` and `categoryName` field variants.
    const allowedCategoryIds = categoryName
        ? activeCategories
            .filter(c => (c.name || c.categoryName || '').toLowerCase() === categoryName.toLowerCase())
            .map(c => c._id)
        : activeCategoryIds;

    const selectedCategoryIds = query.category
        ? query.category.split(',').filter(Boolean)
        : allowedCategoryIds.map(String);
    const selectedBrandIds = query.brand
        ? query.brand.split(',').filter(Boolean)
        : activeBrandIds.map(String);

    const match = {
        ...baseMatch,
        status: "active",
        isDeleted: false,
        category: { $in: allowedCategoryIds.filter(id => selectedCategoryIds.includes(String(id))) },
        brand:    { $in: activeBrandIds.filter(id => selectedBrandIds.includes(String(id))) },
        ...(search ? { productName: new RegExp(search, 'i') } : {})
    };

    const sortStage =
        sort === 'price-asc'  ? { displayPrice: 1 } :
        sort === 'price-desc' ? { displayPrice: -1 } :
        sort === 'name-asc'   ? { productName: 1 } :
        sort === 'name-desc'  ? { productName: -1 } :
        sort === 'brand-asc'  ? { brandName: 1 } :
        sort === 'brand-desc' ? { brandName: -1 } :
                                 { createdAt: -1 }; // "newest" / default

    const pipeline = [
        { $match: match },
        {
            $addFields: {
                displayVariant: {
                    $let: {
                        vars: {
                            defaultActive: {
                                $first: {
                                    $filter: {
                                        input: "$variants",
                                        as: "v",
                                        cond: { $and: ["$$v.isDefault", "$$v.isActive"] }
                                    }
                                }
                            },
                            anyActive: {
                                $first: {
                                    $filter: { input: "$variants", as: "v", cond: "$$v.isActive" }
                                }
                            },
                            first: { $arrayElemAt: ["$variants", 0] }
                        },
                        in: {
                            $ifNull: ["$$defaultActive", { $ifNull: ["$$anyActive", "$$first"] }]
                        }
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'brands',
                localField: 'brand',
                foreignField: '_id',
                as: 'brandDoc'
            }
        },
        {
            $addFields: {
                displayPrice: "$displayVariant.price",
                brandName: { $first: "$brandDoc.name" }
            }
        },
        ...(minPrice != null || maxPrice != null
            ? [{
                $match: {
                    displayPrice: {
                        ...(minPrice != null ? { $gte: minPrice } : {}),
                        ...(maxPrice != null ? { $lte: maxPrice } : {})
                    }
                }
            }]
            : []),
        { $sort: sortStage },
        {
            $facet: {
                data: [
                    { $skip: (page - 1) * PRODUCTS_PER_PAGE },
                    { $limit: PRODUCTS_PER_PAGE }
                ],
                totalCount: [{ $count: "count" }]
            }
        }
    ];

    const [result] = await Product.aggregate(pipeline);
    const rawProducts = result.data;
    const totalCount   = result.totalCount[0]?.count || 0;
    const totalPages   = Math.max(1, Math.ceil(totalCount / PRODUCTS_PER_PAGE));

    // Aggregation doesn't populate refs — do it in one extra step on the page slice only.
    const products = await Product.populate(rawProducts, [
        { path: "brand",    select: "name" },
        { path: "category", select: "name" }
    ]);

    return {
        products, activeCategories, activeBrands,
        page: Math.min(page, totalPages), totalPages, totalCount,
        search, sort, minPrice, maxPrice
    };
}

export const loadAllProducts = async (req, res) => {
    try {
        const [{ products, activeCategories, activeBrands, page, totalPages, totalCount, search, sort, minPrice, maxPrice }, wishlistedIds, activeOffers] =
            await Promise.all([
                getPaginatedProducts({}, req.query),
                getWishlistedIds(req),
                getActiveOffers(),
            ]);

        const shaped = products.map(p => shapeProduct(p, wishlistedIds, activeOffers));

        const pages = Array.from({ length: totalPages }, (_, i) => ({
            number: i + 1,
            isCurrent: i + 1 === page
        }));

        res.render("users/allProduct", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'All Products' }
            ],
            products: shaped,
            categories: activeCategories,
            brands: activeBrands,
            user: req.session?.user || null,
            searchQuery: search,
            sort, minPrice, maxPrice,
            currentPage: page, totalPages, totalCount, pages,
            hasPrev: page > 1, hasNext: page < totalPages,
            prevPage: page - 1, nextPage: page + 1
        });

    } catch (error) {
        console.error("loadAllProducts error:", error);
        res.status(500).send("Failed to load products");
    }
};

export const loadMens = async (req, res) => {
    try {
        const [{ products, activeCategories, activeBrands, page, totalPages, totalCount, search, sort, minPrice, maxPrice }, wishlistedIds, activeOffers] =
            await Promise.all([
                getPaginatedProducts({}, req.query, { categoryName: 'men' }),
                getWishlistedIds(req),
                getActiveOffers(),
            ]);

        const shaped = products.map(p => shapeProduct(p, wishlistedIds, activeOffers));

        res.render("users/mensCollection", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Mens' }
            ],
            products: shaped,
            categories: activeCategories,
            brands: activeBrands,
            count: totalCount,
            searchQuery: search,
            sort, minPrice, maxPrice,
            currentPage: page, totalPages, totalCount,
            pages: buildPages(totalPages, page),
            hasPrev: page > 1, hasNext: page < totalPages,
            prevPage: page - 1, nextPage: page + 1,
            user: req.session?.user || null
        });

    } catch (error) {
        console.error("loadMens error:", error);
        res.status(500).send("Failed to load mens products");
    }
};

export const loadWomens = async (req, res) => {
    try {
        const [{ products, activeCategories, activeBrands, page, totalPages, totalCount, search, sort, minPrice, maxPrice }, wishlistedIds, activeOffers] =
            await Promise.all([
                getPaginatedProducts({}, req.query, { categoryName: 'women' }),
                getWishlistedIds(req),
                getActiveOffers(),
            ]);

        const shaped = products.map(p => shapeProduct(p, wishlistedIds, activeOffers));

        res.render("users/womensCollection", {
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Womens' }
            ],
            products: shaped,
            categories: activeCategories,
            brands: activeBrands,
            count: totalCount,
            searchQuery: search,
            sort, minPrice, maxPrice,
            currentPage: page, totalPages, totalCount,
            pages: buildPages(totalPages, page),
            hasPrev: page > 1, hasNext: page < totalPages,
            prevPage: page - 1, nextPage: page + 1,
            user: req.session?.user || null
        });

    } catch (error) {
        console.error("loadWomens error:", error);
        res.status(500).send("Failed to load womens products");
    }
};

export const loadLimitedEdition = async (req, res) => {
    try {
        const [{ products, activeCategories, activeBrands, page, totalPages, totalCount, search, sort, minPrice, maxPrice }, wishlistedIds, activeOffers] =
            await Promise.all([
                getPaginatedProducts({ isLimitedEdition: true }, req.query),
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
            categories: activeCategories,
            brands: activeBrands,
            count: totalCount,
            searchQuery: search,
            sort, minPrice, maxPrice,
            currentPage: page, totalPages, totalCount,
            pages: buildPages(totalPages, page),
            hasPrev: page > 1, hasNext: page < totalPages,
            prevPage: page - 1, nextPage: page + 1,
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

        const [product, activeOffers] = await Promise.all([
            Product.findById(id)
                .populate("brand",    "name brandName")
                .populate("category", "name categoryName")
                .lean(),
            getActiveOffers(),
        ]);

        if (!product || product.isDeleted || product.status !== "active") {
            return res.redirect('/?error=product_unavailable');
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

export const searchProducts = async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query || query.length < 2) {
      return res.json({ products: [] });
    }

    const searchRegex = new RegExp(query, 'i');

    const products = await Product.find({
      status: 'active',
      isDeleted: false,
      productName: searchRegex,
    })
      .limit(10)
      .populate('brand', 'name')
      .lean();

    const formatted = products.map(p => {
      const variant =
        p.variants?.find(v => v.isDefault && v.isActive) ||
        p.variants?.find(v => v.isActive) ||
        p.variants?.[0];

      return {
        id: p._id.toString(),
        productName: p.productName,
        brand: p.brand?.name || '',
        rawPrice: variant?.price || 0,
        images: variant?.images || [],
      };
    });

    return res.json({ products: formatted });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ products: [], message: 'Search failed' });
  }
};