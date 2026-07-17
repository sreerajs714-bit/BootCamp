import Cart from "../../model/cartModel.js";
import Wishlist from "../../model/wishlistModel.js";

export const getNavCountsService = async (userId) => {
    if (!userId) {
        return { cartCount: 0, wishlistCount: 0 };
    }

    const [cart, wishlist] = await Promise.all([
        Cart.findOne({ userId }).lean(),
        Wishlist.findOne({ userId }).lean(),
    ]);

    const cartCount = cart?.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) ?? 0;
    const wishlistCount = wishlist?.products?.length ?? 0;

    return { cartCount, wishlistCount };
};
