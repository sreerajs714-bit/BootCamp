import Cart from "../Model/cartModel.js";

export const attachCartCount = async (req, res, next) => {
  try {
    if (req.session.user) {
      const cart = await Cart.findOne({ userId: req.session.user.id });
      res.locals.cartCount = cart ? cart.items.length : 0;
      res.locals.wishlistCount = 0; // add wishlist logic similarly
    } else {
      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;
    }
  } catch (error) {
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
  }
  next();
};