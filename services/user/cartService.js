import Product from "../../model/productModel.js";
import Cart from "../../model/cartModel.js";
import Wishlist from "../../model/wishlistModel.js";
import { getActiveOffers, calculateOfferPrice } from "../../utils/offer.js";

export const getCartDetailsService = async (userId, cartNotice) => {
    const [cart, activeOffers] = await Promise.all([
        Cart.findOne({ userId })
            .populate({
                path: "items.productId",
                populate: [
                    { path: "brand", model: "Brand" },
                    { path: "category", model: "Category" }
                ]
            })
            .lean(),
        getActiveOffers(),
    ]);

    if (!cart || cart.items.length === 0) {
        return {
            cartItems: [],
            subtotal: 0,
            total: 0,
            savings: 0,
            bagCount: 0,
            cartNotice
        };
    }

    let subtotal = 0;
    let total = 0;

    const cartItems = cart.items.map(item => {
        const product = item.productId;
        const variant = product.variants?.find(
            v => v._id.toString() === item.variantId?.toString()
        ) || product.variants?.[0];

        const originalPrice = item.price || variant?.price || 0;
        const qty = item.quantity || 1;

        const isUnavailable = product.isDeleted || product.status !== "active" || variant?.stock === 0;

        const pricing = calculateOfferPrice(originalPrice, product, activeOffers);
        const finalPrice = pricing.hasOffer ? pricing.discountedPrice : originalPrice;

        if (!isUnavailable) {
            subtotal += originalPrice * qty;
            total += finalPrice * qty;
        }

        return {
            _id: item._id,
            productId: {
                _id: product._id,
                name: product.productName,
                brand: product.brand?.name || product.brand?.brandName || "Brand",
                images: variant?.images || [],
                price: pricing.hasOffer ? originalPrice : null
            },
            variantId: item.variantId,
            color: variant?.color || "",
            size: item.size || "",
            quantity: qty,
            price: finalPrice,
            hasOffer: pricing.hasOffer,
            offerPercentage: pricing.offer
                ? pricing.offer.discountType === 'percentage'
                    ? pricing.offer.discountValue
                    : Math.round((pricing.discount / originalPrice) * 100)
                : 0,
            stock: variant?.stock || 0,
            isUnavailable
        };
    });

    const savings = subtotal - total;

    return {
        cartItems,
        subtotal,
        total,
        savings,
        bagCount: cartItems.filter(i => !i.isUnavailable).length,
        cartNotice
    };
};

export const addToCartService = async ({ userId, productId, variantId, size, quantity = 1, sessionCart = [] }) => {
    if (!productId || !variantId) {
        throw new Error("productId or variantId missing");
    }

    const product = await Product.findById(productId);
    if (!product || product.isDeleted || product.status !== "active") {
        const err = new Error("Product not available");
        err.statusCode = 404;
        throw err;
    }

    const variant = (product.variants || []).find(v => v?._id?.toString() === variantId);
    if (!variant) {
        const err = new Error("Variant not found");
        err.statusCode = 404;
        throw err;
    }

    if (variant.stock < quantity) {
        const err = new Error("Insufficient stock");
        err.outOfStock = true;
        throw err;
    }

    const resolvedSize = size || (Array.isArray(variant.sizes) ? variant.sizes[0] : variant.sizes) || "";

    if (!userId) {
        if (sessionCart.length >= 10) {
            const err = new Error("Cart limit reached. Maximum 10 items allowed.");
            err.cartLimit = true;
            throw err;
        }

        const existingItem = sessionCart.find(item =>
            item.productId === productId &&
            item.variantId === variantId &&
            item.size === resolvedSize
        );

        if (existingItem) {
            return { alreadyInCart: true, message: "Item already in cart" };
        }

        const updatedGuestCart = [...sessionCart, {
            productId,
            variantId,
            quantity,
            price: variant.price,
            size: resolvedSize,
            productName: product.productName,
            productImage: product.images?.[0] || ""
        }];

        return { success: true, isGuest: true, updatedGuestCart, message: "Added to guest cart" };
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
        cart = new Cart({ userId, items: [] });
    }

    if (cart.items.length >= 10) {
        const err = new Error("Cart limit reached. Maximum 10 items allowed.");
        err.cartLimit = true;
        throw err;
    }

    const existingItem = cart.items.find(item =>
        item.productId.toString() === productId &&
        item.variantId?.toString() === variantId &&
        item.size === resolvedSize
    );

    if (existingItem) {
        return { alreadyInCart: true, message: "Item already in cart" };
    }

    cart.items.push({
        productId,
        variantId,
        quantity,
        price: variant.price,
        size: resolvedSize
    });

    await cart.save();

    await Wishlist.updateOne(
        { userId },
        { $pull: { products: { productId } } }
    );

    return { success: true, message: "Added to cart successfully" };
};

export const updateCartQtyService = async ({ userId, itemId, quantity }) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
        const err = new Error('Cart not found');
        err.statusCode = 404;
        throw err;
    }

    const item = cart.items.id(itemId);
    if (!item) {
        const err = new Error('Item not found');
        err.statusCode = 404;
        throw err;
    }

    item.quantity = quantity;
    await cart.save();
};

export const removeFromCartService = async ({ userId, itemId, productId, variantId, size, sessionCart = [] }) => {
    if (!userId) {
        const beforeLength = sessionCart.length;
        const updatedGuestCart = sessionCart.filter(item =>
            !(item.productId === productId &&
              item.variantId === variantId &&
              item.size === size)
        );

        if (updatedGuestCart.length === beforeLength) {
            const err = new Error("Item not found in cart");
            err.statusCode = 404;
            throw err;
        }

        return { success: true, isGuest: true, updatedGuestCart, message: "Item removed from guest cart" };
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
        const err = new Error("Cart not found");
        err.statusCode = 404;
        throw err;
    }

    const indexToRemove = cart.items.findIndex(item => item._id.toString() === itemId?.toString());
    if (indexToRemove === -1) {
        const err = new Error("Item not found in cart");
        err.statusCode = 404;
        throw err;
    }

    cart.items.splice(indexToRemove, 1);
    await cart.save();

    return { success: true, message: "Item removed successfully" };
};

export const getCartCountService = async ({ userId, sessionCart = [] }) => {
    if (!userId) {
        return sessionCart.length;
    }

    const cart = await Cart.findOne({ userId });
    return cart?.items?.length || 0;
};
