import {
    getCartDetailsService,
    addToCartService,
    updateCartQtyService,
    removeFromCartService,
    getCartCountService
} from "../../services/user/cartService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadCart = async (req, res) => {
    try {
        const userId = req.session?.user?.id;
        const cartNotice = req.session.cartNotice || null;
        delete req.session.cartNotice;

        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: "Cart" },
        ];

        const payload = await getCartDetailsService(userId, cartNotice);

        return res.render("users/cart", payload);

    } catch (err) {
        console.error("loadCart error:", err);
        res.status(statuscodes.SERVER_ERROR).send("Cart error");
    }
};

export const addToCart = async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { productId, variantId, size, quantity = 1 } = req.body;

        const result = await addToCartService({
            userId,
            productId,
            variantId,
            size,
            quantity,
            sessionCart: req.session.cart || []
        });

        if (result.alreadyInCart) {
            return res.status(statuscodes.OK).json({
                success: false,
                alreadyInCart: true,
                message: result.message
            });
        }

        if (result.isGuest) {
            req.session.cart = result.updatedGuestCart;
        }

        return res.status(statuscodes.OK).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("addToCart error:", error);
        return res.status(error.statusCode || statuscodes.BAD_REQUEST).json({
            success: false,
            outOfStock: error.outOfStock || false,
            cartLimit: error.cartLimit || false,
            message: error.message
        });
    }
};

export const updateCartQty = async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        const userId = req.session.user.id;

        await updateCartQtyService({ userId, itemId, quantity });

        return res.json({ success: true });

    } catch (error) {
        console.error('updateCartQty error:', error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({ success: false, message: error.message || 'Something went wrong' });
    }
};

export const removeFromCart = async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { itemId, productId, variantId, size } = req.body;

        const result = await removeFromCartService({
            userId,
            itemId,
            productId,
            variantId,
            size,
            sessionCart: req.session.cart || []
        });

        if (result.isGuest) {
            req.session.cart = result.updatedGuestCart;
        }

        return res.status(statuscodes.OK).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("removeFromCart error:", error);
        return res.status(error.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

export const getCartCount = async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;

        const count = await getCartCountService({
            userId,
            sessionCart: req.session.cart || []
        });

        return res.json({ success: true, count });

    } catch (error) {
        console.error('getCartCount error:', error);
        return res.json({ success: false, count: 0 });
    }
};
