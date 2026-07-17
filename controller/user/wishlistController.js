import {
    loadWishlistService,
    toggleWishlistService,
    removeFromWishlistService,
    clearWishlistService
} from "../../services/user/wishlistService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadWishlist = async (req, res) => {
    try {
        const isLoggedIn = !!req.session?.user;

        if (!isLoggedIn) {
            return res.render("users/wishlist", {
                wishlistItems: [],
                count: 0,
                isLoggedIn: false
            });
        }

        const userId = req.session.user.id || req.session.user._id;

        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: "Wishlist" },
        ];

        const payload = await loadWishlistService(userId);

        return res.render("users/wishlist", {
            ...payload,
            isLoggedIn: true,
            user: req.session.user
        });

    } catch (error) {
        console.error("loadWishlist error:", error);
        return res.render("users/wishlist", {
            wishlistItems: [],
            count: 0,
            isLoggedIn: false
        });
    }
};

export const toggleWishlist = async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.session?.user?._id;
        const { productId, variantId } = req.body;

        const result = await toggleWishlistService({ userId, productId, variantId });

        return res.status(statuscodes.OK).json(result);

    } catch (err) {
        console.error('toggleWishlist error:', err);
        return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: err.message || "Failed to toggle wishlist"
        });
    }
};

export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.session?.user?._id;
        const { productId } = req.body;

        const result = await removeFromWishlistService({ userId, productId });

        return res.status(statuscodes.OK).json(result);

    } catch (err) {
        console.error("removeFromWishlist error:", err);
        return res.status(err.statusCode || statuscodes.SERVER_ERROR).json({
            success: false,
            message: err.message || "Failed to remove from wishlist"
        });
    }
};

export const clearWishlist = async (req, res) => {
    try {
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        const result = await clearWishlistService(userId);

        return res.json(result);
    } catch (error) {
        console.error("Clear wishlist error:", error);
        return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Something went wrong" });
    }
};

