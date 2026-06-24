import Product from "../../Model/productModel.js";
import User from "../../Model/userModel.js";
import Cart from "../../Model/cartModel.js";
import Wishlist from "../../Model/wishlistModel.js";

import { getActiveOffers, calculateOfferPrice } from "../../utils/offer.js";


export const loadCart = async (req, res) => {
    try {
        const userId = req.session?.user?.id;

        // NEW — pick up any stock notice left by loadCheckout, then clear it
        const cartNotice = req.session.cartNotice || null;
        delete req.session.cartNotice;

        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: "Cart" },
        ];

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
            return res.render("users/cart", {
                cartItems: [],
                subtotal: 0,
                total: 0,
                savings: 0,
                bagCount: 0,
                cartNotice // NEW — also needed in the empty-cart branch
            });
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

        return res.render("users/cart", {
            cartItems,
            subtotal,
            total,
            savings,
            bagCount: cartItems.filter(i => !i.isUnavailable).length,
            cartNotice // NEW
        });

    } catch (err) {
        console.error("loadCart error:", err);
        res.status(500).send("Cart error");
    }
};

export const addToCart = async (req, res) => {
    try {
        console.log('addToCart body:', req.body); // ← add this
    console.log('existing cart items:', await Cart.findOne({ userId: req.session?.user?.id }));
        const userId = req.session?.user?.id || null;
        const { productId, variantId, size, quantity = 1 } = req.body;

        if (!productId || !variantId) {
            return res.status(400).json({
                success: false,
                message: "productId or variantId missing"
            });
        }

        const product = await Product.findById(productId);

        if (!product || product.isDeleted || product.status !== "active") {
            return res.status(404).json({
                success: false,
                message: "Product not available"
            });
        }

        const variant = (product.variants || []).find(v =>
            v?._id?.toString() === variantId
        );

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        if (variant.stock < quantity) {
            return res.status(400).json({
                success: false,
                outOfStock: true,
                message: "Insufficient stock"
            });
        }

        // =====================
        // GUEST CART
        // =====================
        if (!userId) {
            if (!req.session.cart) req.session.cart = [];

            // Cart limit check
            if (req.session.cart.length >= 10) {
                return res.status(400).json({
                    success: false,
                    cartLimit: true,
                    message: "Cart limit reached. Maximum 10 items allowed."
                });
            }

            const resolvedSize = size || 
                (Array.isArray(variant.sizes) ? variant.sizes[0] : variant.sizes) || "";

            const existingItem = req.session.cart.find(item =>
                item.productId === productId &&
                item.variantId === variantId &&
                item.size === resolvedSize
            );

            if (existingItem) {
                return res.status(200).json({
                    success: false,
                    alreadyInCart: true,
                    message: "Item already in cart"
                });
            }

            req.session.cart.push({
                productId,
                variantId,
                quantity,
                price: variant.price,
                size: resolvedSize,
                productName: product.productName,
                productImage: product.images?.[0] || ""
            });

            return res.status(200).json({
                success: true,
                message: "Added to guest cart"
            });
        }

        // =====================
        // USER CART
        // =====================
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // Cart limit check
        if (cart.items.length >= 10) {
            return res.status(400).json({
                success: false,
                cartLimit: true,
                message: "Cart limit reached. Maximum 10 items allowed."
            });
        }

        const resolvedSize = size || 
            (Array.isArray(variant.sizes) ? variant.sizes[0] : variant.sizes) || "";

        const existingItem = cart.items.find(item =>
            item.productId.toString() === productId &&
            item.variantId?.toString() === variantId &&
            item.size === resolvedSize 
        );

        if (existingItem) {
            return res.status(200).json({
                success: false,
                alreadyInCart: true,
                message: "Item already in cart"
            });
        }

        cart.items.push({
            productId,
            variantId,
            quantity,
            price: variant.price,
            size: resolvedSize
        });

        await cart.save();

        // Remove from wishlist if present
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        return res.status(200).json({
            success: true,
            message: "Added to cart successfully"
        });

    } catch (error) {
        // ✅ Backend only — no frontend code here
        console.error("addToCart error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const updateCartQty = async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        const userId = req.session.user.id;

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const item = cart.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

        item.quantity = quantity;
        await cart.save();

        return res.json({ success: true });

    } catch (error) {
        console.error('updateCartQty error:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

export const removeFromCart = async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { itemId, productId, variantId, size } = req.body;

        // GUEST CART
        if (!userId) {

            if (!req.session.cart) {
                return res.status(200).json({
                    success: true,
                    message: "Cart is already empty"
                });
            }

            const beforeLength = req.session.cart.length;

            req.session.cart = req.session.cart.filter(item =>
                !(item.productId === productId &&
                  item.variantId === variantId &&
                  item.size === size)
            );

            if (req.session.cart.length === beforeLength) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found in cart"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Item removed from guest cart"
            });
        }

        // USER CART
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        // ✅ Remove by itemId (_id of the cart item)
        const indexToRemove = cart.items.findIndex(item =>
            item._id.toString() === itemId?.toString()
        );

        if (indexToRemove === -1) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart"
            });
        }

        cart.items.splice(indexToRemove, 1);

        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Item removed successfully"
        });

    } catch (error) {
        console.error("removeFromCart error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getCartCount = async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;

        if (!userId) {
            const guestCount = req.session.cart?.length || 0;
            return res.json({ success: true, count: guestCount });
        }

        const cart = await Cart.findOne({ userId });
        const count = cart?.items?.length || 0;
        return res.json({ success: true, count });

    } catch (error) {
        console.error('getCartCount error:', error);
        return res.json({ success: false, count: 0 });
    }
};