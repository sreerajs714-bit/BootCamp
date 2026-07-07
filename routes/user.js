import express from "express";
const route=express.Router();
import { loadHome, loadRegister, loadResetPassword, loadSetNew, loadVerifyOtp, loginUser, logout, resetPassword,setNew} from "../controller/user/authController.js";
import { loadLogin } from "../controller/user/authController.js";
import { registerUser } from "../controller/user/authController.js";
import { resendOTP, verifyOTP } from "../controller/otpcontroller.js";
import { checkSession, checkUserBlocked, islogin, noCache } from "../middleware/userAuth.js";
import { changeEmail, changePassword, editProfile, loadEditProfile, loadProfile, removeProfilePhoto, uploadProfilePhoto } from "../controller/user/profileController.js";
import { uploadProfile ,uploadReturn } from "../middleware/multer.js";
import passport from "../config/passport.js";
import { addAddress, deleteAddress, editAddress, loadAddress } from "../controller/user/addressController.js";
import { loadAllProducts, loadLimitedEdition, loadMens, loadProductDetail, loadWomens, searchProducts } from "../controller/user/productController.js";
import { clearWishlist, loadWishlist, removeFromWishlist, toggleWishlist } from "../controller/user/wishlistController.js";
import { addToCart, loadCart, removeFromCart, updateCartQty } from "../controller/user/cartController.js";
import { applyCoupon, createRazorpayOrder, getAvailableCoupons, loadCheckout, loadOrderSuccess, loadPaymentFailed, placeOrder, removeCoupon, retryRazorpayPayment, verifyRazorpayPayment } from "../controller/user/checkoutController.js";
import { cancelOrder, downloadInvoice, loadMyOrders, loadOrderDetail, loadReturnPage, returnRequest } from "../controller/user/ordersController.js";
import { getCounts } from "../controller/user/navController.js";
import { createWalletOrder, loadWallet, verifyWalletPayment } from "../controller/user/walletController.js";
import { loadReferal } from "../controller/user/referalController.js";


route.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

route.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/users/login" }),
  async (req, res) => {
    req.session.user = {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      profilePhoto: req.user.profilePhoto || null
    };
    req.session.save(() => {
      res.redirect("/users/home");
    });
  }
);

route.use(checkUserBlocked);


route.get("/",loadHome)
route.get("/signup",islogin,loadRegister)
route.get("/login",noCache,islogin,loadLogin)
route.post("/signup",registerUser)
route.get("/home",noCache,loadHome)
route.get("/profile",noCache,checkSession,loadProfile)
route.post("/login",loginUser)
route.post("/logout",noCache,logout)
route.get("/resetPassword",islogin,loadResetPassword)
route.post("/resetPassword",resetPassword)
route.get("/otpVerify",loadVerifyOtp)
route.post("/otpVerify",verifyOTP)
route.post("/resendOtp",resendOTP)
route.get("/setNew",noCache,loadSetNew)
route.post("/setNew",setNew)

route.get("/search",searchProducts);

route.get("/editProfile",noCache,checkSession,loadEditProfile)
route.post("/editProfile", noCache, checkSession, uploadProfile.single("profilePhoto"), editProfile)
route.post("/uploadProfilePhoto", noCache, checkSession, uploadProfile.single("profilePhoto"),uploadProfilePhoto);
route.post("/removeProfilePhoto", noCache, checkSession,removeProfilePhoto);
route.post("/changePassword",noCache,checkSession,changePassword)
route.post("/changeEmail",changeEmail)
route.post("/verifyChangeEmailotp",noCache,checkSession,verifyOTP)

route.get("/address",checkSession,loadAddress);
route.post("/address",checkSession,addAddress)
route.put("/address/:id", checkSession,editAddress);
route.delete("/address/:id", checkSession,deleteAddress);

route.get("/getCounts",getCounts);

route.get("/allProduct",noCache,loadAllProducts);
route.get("/mens",noCache,loadMens);
route.get("/womens",noCache,loadWomens);
route.get("/limited",noCache,loadLimitedEdition);
route.get("/productDetail/:id",noCache,loadProductDetail);

route.get("/wishlist",noCache,loadWishlist);
route.post("/toggleWishlist",noCache,checkSession,toggleWishlist);
route.delete("/removeFromWishlist",noCache,checkSession,removeFromWishlist);
route.post("/clearWishlist",checkSession,clearWishlist);

route.get("/cart",noCache,loadCart);
route.post("/addCart",noCache,checkSession,addToCart);
route.put("/updateCartQty",checkSession,updateCartQty);
route.delete("/removeFromCart",noCache,checkSession,removeFromCart);
route.get("/checkout",checkSession,loadCheckout);

route.get("/coupons",checkSession,getAvailableCoupons);
route.post("/applyCoupon",checkSession,applyCoupon);
route.post("/removeCoupon",checkSession,removeCoupon);


route.get("/orderSuccess/:id",checkSession,loadOrderSuccess);
route.post("/orderSuccess",checkSession,placeOrder);
route.post("/razorpayOrder",checkSession,createRazorpayOrder);
route.post("/verifyRazorpay",checkSession,verifyRazorpayPayment);
route.get("/paymentFailed",loadPaymentFailed);
route.post("/retryPayment",checkSession,retryRazorpayPayment);
route.get("/myOrders",checkSession,loadMyOrders);
route.get("/orderDetail/:id",checkSession,loadOrderDetail);
route.get("/invoice/:id",checkSession,downloadInvoice);
route.post("/orderDetail/cancel",checkSession,cancelOrder);
route.get("/orderDetail/:id/return/:itemId",checkSession,loadReturnPage);
route.post("/orderDetail/return-request",checkSession, uploadReturn.array('images', 3),returnRequest);

route.get("/wallet",checkSession,loadWallet);
route.post("/wallet/addFund",checkSession,createWalletOrder);
route.post("/wallet/verify",checkSession,verifyWalletPayment)

route.get("/referal",checkSession,loadReferal)

export default route;
