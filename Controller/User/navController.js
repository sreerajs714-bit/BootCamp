import Cart from "../../Model/cartModel.js";
import Wishlist from "../../Model/wishlistModel.js";


export const getCounts= async (req, res) => {
    try {
        if (!req.session.user) {
        return res.status(200).json({ cartCount: 0, wishlistCount: 0 });
    }

        const userId = req.session.user?._id || req.session.user?.id;
        
        if (!userId) {
            return res.json({ success: true, cartCount: 0, wishlistCount: 0 });
        }

        const [cart, wishlist] = await Promise.all([
            Cart.findOne({ userId }).lean(),
            Wishlist.findOne({ userId }).lean(),
        ]);

        const cartCount = cart?.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) ?? 0;
        const wishlistCount = wishlist?.products?.length ?? 0;

        return res.json({ success: true, cartCount, wishlistCount });

    } catch (err) {
        console.error('getCounts error:', err);
        return res.json({ success: true, cartCount: 0, wishlistCount: 0 });
    }
};