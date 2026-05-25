import Product from "../../Model/productModel.js";
import User from "../../Model/userModel.js";
import Cart from "../../Model/cartModel.js";
import Wishlist from "../../Model/wishlistModel.js";


export const loadCart = async (req, res) => {
    try {

        const userId = req.session?.user?.id;

        const cart = await Cart.findOne({ userId })
            .populate({
                path: "items.productId",
                populate: {
                    path: "brand",
                    model: "Brand"
                }
            })
            .lean();

        if (!cart || cart.items.length === 0) {
            return res.render("users/cart", {
                cartItems: [],
                subtotal: 0,
                total: 0,
                savings: 0,
                bagCount: 0
            });
        }

        let subtotal = 0;

        const cartItems = cart.items.map(item => {

            const product = item.productId;

            // Match the exact variant used when added to cart, fallback to first
            const variant = product.variants?.find(
                v => v._id.toString() === item.variantId?.toString()
            ) || product.variants?.[0];

            const price = item.price || variant?.price || 0;
            const qty = item.quantity || 1;

            subtotal += price * qty;

            return {
                productId: {
                    _id: product._id,
                    name: product.productName,
                    brand: product.brand?.name || product.brand?.brandName || "Brand",
                    images: variant?.images || []
                },
                variantId: item.variantId,
                color: variant?.color || "",
                size: item.size || "",
                quantity: qty,
                price
            };
        });

        return res.render("users/cart", {
            cartItems,
            subtotal,
            total: subtotal,
            savings: 0,
            bagCount: cartItems.length
        });

    } catch (err) {
        console.error("loadCart error:", err);
        res.status(500).send("Cart error");
    }
};

export const addToCart = async (req, res) => {
    try {

        const userId = req.session?.user?.id || null;

        const { productId, variantId, quantity = 1 } = req.body;

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

            const existingItem = req.session.cart.find(item =>
                item.productId === productId &&
                item.variantId === variantId
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

        const existingItem = cart.items.find(item =>
            item.productId.toString() === productId &&
            item.variantId?.toString() === variantId
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
            price: variant.price
        });

        await cart.save();

        // ← Remove from wishlist if present
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        return res.status(200).json({
            success: true,
            message: "Added to cart successfully"
        });

    } catch (error) {
        console.error("addToCart error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const removeFromCart = async (req, res) => {
    try {

        const userId = req.session?.user?.id || null;
        const { productId, variantId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }

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
                  item.variantId === variantId)
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

        const beforeLength = cart.items.length;

        cart.items = cart.items.filter(item =>
            !(item.productId.toString() === productId &&
              item.variantId?.toString() === variantId)
        );

        if (cart.items.length === beforeLength) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart"
            });
        }

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