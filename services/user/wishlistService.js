import Product from "../../model/productModel.js";
import Wishlist from "../../model/wishlistModel.js";
import Cart from "../../model/cartModel.js";
import { getActiveOffers, calculateOfferPrice } from "../../utils/offer.js";

export const loadWishlistService = async (userId) => {
    const [wishlist, activeOffers] = await Promise.all([
        Wishlist.findOne({ userId })
            .populate({
                path: "products.productId",
                populate: {
                    path: "brand",
                    model: "Brand"
                }
            })
            .lean(),
        getActiveOffers()
    ]);

    if (!wishlist || wishlist.products.length === 0) {
        return {
            wishlistItems: [],
            count: 0
        };
    }

    const idsToRemove = [];
    const validProducts = [];

    wishlist.products.forEach(item => {
        const product = item.productId;
        const isBlockedOrDeleted = !product || product.isDeleted || product.status !== "active";
        if (isBlockedOrDeleted) {
            idsToRemove.push(product?._id || item.productId);
        } else {
            validProducts.push(item);
        }
    });

    if (idsToRemove.length > 0) {
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId: { $in: idsToRemove } } } }
        );
    }

    if (validProducts.length === 0) {
        return {
            wishlistItems: [],
            count: 0
        };
    }

    const cart = await Cart.findOne({ userId }).lean();
    const cartProductIds = (cart?.items || []).map(i => i.productId.toString());

    const wishlistItems = validProducts.map(item => {
        const product = item.productId;

        const variant =
            product.variants?.find(v => String(v._id) === String(item.variantId)) ||
            product.variants?.find(v => v.isDefault && v.isActive) ||
            product.variants?.find(v => v.isActive) ||
            product.variants?.[0];

        const rawImages = variant?.images || [];
        const images = rawImages.map(img => {
            if (typeof img === "string") return img;
            return img.url || img.path || img.src || "";
        }).filter(Boolean);

        const rawPrice = variant?.price || 0;
        const pricing = calculateOfferPrice(rawPrice, product, activeOffers);

        return {
            id: product._id.toString(),
            productName: product.productName,
            brand: product.brand?.name || product.brand?.brandName || "Brand",
            rawPrice,
            price: pricing.hasOffer
                ? `₹${pricing.discountedPrice.toLocaleString("en-IN")}`
                : `₹${rawPrice.toLocaleString("en-IN")}`,
            hasOffer: pricing.hasOffer,
            discountedPrice: pricing.discountedPrice,
            offerPercentage: pricing.hasOffer
                ? (pricing.offer.discountType === 'percentage'
                    ? pricing.offer.discountValue
                    : Math.round((pricing.discount / rawPrice) * 100))
                : 0,
            variantId: variant?._id?.toString() || "",
            size: item.size || variant?.sizes?.[0] || '',
            images,
            color: variant?.color || "",
            isLimitedEdition: product.isLimitedEdition || false,
            stock: variant?.stock || 0,
            isOutOfStock: (variant?.stock || 0) === 0,
            isInCart: cartProductIds.includes(product._id.toString()),
        };
    });

    return {
        wishlistItems,
        count: wishlistItems.length
    };
};

export const toggleWishlistService = async ({ userId, productId, variantId }) => {
    if (!userId) {
        const err = new Error("Please login to continue");
        err.statusCode = 401;
        throw err;
    }

    if (!productId) {
        const err = new Error("productId is required");
        err.statusCode = 400;
        throw err;
    }

    const product = await Product.findById(productId).lean();
    if (!product || product.isDeleted || product.status !== 'active') {
        const err = new Error("Product not available");
        err.statusCode = 404;
        throw err;
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [] });
    }

    const existingIndex = wishlist.products.findIndex(
        p => p.productId.toString() === productId
    );

    if (existingIndex > -1) {
        wishlist.products.splice(existingIndex, 1);
        await wishlist.save();
        return { success: true, isWishlisted: false, message: "Removed from wishlist" };
    } else {
        const variant = product.variants?.find(
            v => String(v._id) === String(variantId)
        );

        wishlist.products.push({
            productId,
            variantId: variant?._id || null,
            size: variant?.sizes?.[0] || ''
        });

        await wishlist.save();
        return { success: true, isWishlisted: true, message: "Added to wishlist" };
    }
};

export const removeFromWishlistService = async ({ userId, productId }) => {
    if (!userId) {
        const err = new Error("Please login to continue");
        err.statusCode = 401;
        throw err;
    }

    if (!productId) {
        const err = new Error("productId is required");
        err.statusCode = 400;
        throw err;
    }

    await Wishlist.updateOne(
        { userId },
        { $pull: { products: { productId } } }
    );

    return { success: true, message: "Removed from wishlist" };
};

export const clearWishlistService = async (userId) => {
    await Wishlist.findOneAndUpdate(
        { userId },
        { $set: { products: [] } }
    );
    return { success: true, message: "Wishlist cleared successfully" };
};
