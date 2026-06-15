import express from "express";
const route=express.Router();
import { loadHome, loadRegister, loadResetPassword, loadSetNew, loadVerifyOtp, LoginUser, Logout, resetPassword, SetNew} from "../Controller/User/authController.js";
import { loadLogin } from "../Controller/User/authController.js";
import { RegisterUser } from "../Controller/User/authController.js";
import { resendOTP, verifyOTP } from "../Controller/otpcontroller.js";
import { checkSession, islogin, noCache } from "../Middleware/userAuth.js";
import { changeEmail, changePassword, editProfile, loadEditProfile, loadProfile, removeProfilePhoto, uploadProfilePhoto } from "../Controller/User/profileController.js";
import { uploadProfile ,uploadReturn } from "../Middleware/multer.js";
import passport from "../Config/passport.js";
import { addAddress, deleteAddress, editAddress, loadAddress } from "../Controller/User/addressController.js";
import { loadAllProducts, loadLimitedEdition, loadMens, loadProductDetail, loadWomens } from "../Controller/User/productController.js";
import { clearWishlist, loadWishlist, removeFromWishlist, toggleWishlist } from "../Controller/User/wishlistController.js";
import { addToCart, loadCart, removeFromCart, updateCartQty } from "../Controller/User/cartController.js";
import { applyCoupon, createRazorpayOrder, getAvailableCoupons, loadCheckout, loadOrderSuccess, loadPaymentFailed, placeOrder, removeCoupon, retryRazorpayPayment, verifyRazorpayPayment } from "../Controller/User/checkoutController.js";
import { cancelOrder, downloadInvoice, loadMyOrders, loadOrderDetail, loadReturnPage, returnRequest } from "../Controller/User/ordersController.js";
import { getCounts } from "../Controller/User/navController.js";
import { createWalletOrder, loadWallet, verifyWalletPayment } from "../Controller/User/walletController.js";
import { loadReferal } from "../Controller/User/referalController.js";


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

route.get("/",loadHome)
route.get("/signup",islogin,loadRegister)
route.get("/login",noCache,islogin,loadLogin)
route.post("/signup",RegisterUser)
route.get("/home",noCache,loadHome)
route.get("/profile",noCache,checkSession,loadProfile)
route.post("/login",LoginUser)
route.post("/logout",noCache,Logout)
route.get("/resetPassword",islogin,loadResetPassword)
route.post("/resetPassword",resetPassword)
route.get("/otpVerify",loadVerifyOtp)
route.post("/otpVerify",verifyOTP)
route.post("/resendOtp",resendOTP)
route.get("/setNew",noCache,loadSetNew)
route.post("/setNew",SetNew)

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
