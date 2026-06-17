import express from "express"
import { Adminlogin, adminLogout, loadDasboard, loadLogin } from "../Controller/Admin/authController.js";
import { blockUser, loadUsers, unblockUser } from "../Controller/Admin/userManagementController.js";
import { isAdmin } from "../Middleware/adminAuth.js";
import { addCategory, deleteCategory, editCategory, loadCategory, restoreCategory } from "../Controller/Admin/categoryController.js";
import { addProduct,addVariant,editVariant,deleteVariant,deleteProduct,editProduct,loadAddProduct,loadEditProduct, loadProduct, loadProductView, loadVariants, restoreProduct, setDefaultVariant } from "../Controller/Admin/productController.js";
import { addBrand, deleteBrand, editBrand, loadBrand, restoreBrand } from "../Controller/Admin/brandController.js";
import { uploadProduct } from "../Middleware/multer.js";
import { loadOrderDetail, loadOrders,updateOrderStatus } from "../Controller/Admin/orderController.js";
import { approveReturn, loadReturnDetail, loadReturnManagement, processRefund, rejectReturn, schedulePickup } from "../Controller/Admin/returnController.js";
import { createCoupon, deleteCoupon, getCouponById, loadCoupon, toggleCouponStatus, updateCoupon } from "../Controller/Admin/couponController.js";
import { createOffer, deleteOffer, getCategoriesMetadata, getOfferById, getProductsMetadata, loadOffer, toggleOfferStatus, updateOffer } from "../Controller/Admin/offerController.js";
import { exportSalesReportExcel, exportSalesReportPDF, loadSalesReport, loadSalesReportPage } from "../Controller/Admin/salesReportController.js";
const route=express.Router();

route.get("/",loadLogin);
route.post("/login",Adminlogin);
route.get("/login", loadLogin);
route.get("/dashboard",isAdmin,loadDasboard);
route.get('/logout', adminLogout);

route.get("/dashboardData",isAdmin,loadDasboard);
route.get("/salesReport",isAdmin,loadSalesReportPage);
route.get("/salesReportData",isAdmin,loadSalesReport)
route.get("/salesReport/export/excel",exportSalesReportExcel);
route.get("/salesReport/export/pdf",exportSalesReportPDF);

route.get("/userManagement",isAdmin,loadUsers);
route.patch('/userManagement/block/:id',isAdmin, blockUser);
route.patch('/userManagement/unblock/:id',isAdmin, unblockUser);

route.get("/category",isAdmin,loadCategory);
route.post("/category",isAdmin,addCategory);
route.put("/category/restore/:id",isAdmin,restoreCategory);
route.put("/category/edit/:id",isAdmin,editCategory);
route.delete("/category/delete/:id",isAdmin,deleteCategory);

route.get("/productManagement",isAdmin,loadProduct);
route.get("/addProduct",isAdmin,loadAddProduct)
route.post("/addProduct",isAdmin,uploadProduct.array("images", 3),addProduct);
route.get("/editProduct/:id",isAdmin,loadEditProduct);
route.put("/editProduct/:id",isAdmin,uploadProduct.array("images", 3),editProduct);
route.delete("/deleteProduct/:id",isAdmin,deleteProduct);
route.put("/restoreProduct/:id",isAdmin,restoreProduct)
route.get("/productView/:id",isAdmin,loadProductView);
route.get("/viewVariants/:id",isAdmin,loadVariants);
route.post("/viewVariants/:id/variant",isAdmin,uploadProduct.array("images", 3),addVariant);
route.put("/viewVariants/:id/variant/:variantId",isAdmin,uploadProduct.array("images", 3),editVariant);
route.delete("/viewVariants/:id/variant/:variantId",isAdmin,deleteVariant);
route.post("/productManagement/variants/setDefault",setDefaultVariant);

route.get("/brand",isAdmin,loadBrand);
route.post("/addBrand",isAdmin,addBrand);
route.put("/editBrand/:id",isAdmin,editBrand);
route.delete("/deleteBrand/:id",isAdmin,deleteBrand);
route.put("/restoreBrand/:id",isAdmin,restoreBrand);

route.get("/orders",isAdmin,loadOrders);
route.get("/orderDetail/:id",isAdmin,loadOrderDetail);
route.put("/orderDetail/:id/status",isAdmin,updateOrderStatus);

route.get("/returns",isAdmin,loadReturnManagement);
route.get("/returns/:id",isAdmin,loadReturnDetail);
route.put("/returns/:id/approve",isAdmin,approveReturn);
route.put("/returns/:id/reject",isAdmin,rejectReturn);
route.put("/returns/:id/pickup",isAdmin,schedulePickup);
route.put("/returns/:id/refund",isAdmin,processRefund);

route.get("/coupons",loadCoupon);
route.post("/coupons/add",createCoupon);
route.put("/coupons/edit/:id",updateCoupon);
route.patch("/coupons/toggle/:id",toggleCouponStatus);
route.delete("/coupons/delete/:id",deleteCoupon);
route.get("/coupons/:id",getCouponById);

route.get("/products/metadata", getProductsMetadata);
route.get("/categories/metadata", getCategoriesMetadata);

route.get("/offers",loadOffer);
route.post("/offers/add",createOffer);
route.put("/offers/edit/:id",updateOffer);
route.patch("/offers/toggle/:id",toggleOfferStatus);
route.delete("/offers/delete/:id",deleteOffer);
route.get("/offers/:id",getOfferById);



export default route;