import express from "express"
import { Adminlogin, adminLogout, loadDashboard, loadLogin } from "../Controller/Admin/authController.js";
import { blockUser, loadUsers, unblockUser } from "../Controller/Admin/userManagementController.js";
import { isAdmin } from "../Middleware/adminAuth.js";
import { addCategory, deleteCategory, editCategory, loadCategory } from "../Controller/Admin/categoryController.js";
import { loadAddProduct, loadEditProduct, loadProduct } from "../Controller/Admin/productController.js";
const route=express.Router();

route.get("/",loadLogin);
route.post("/login",Adminlogin);
route.get("/login", loadLogin);
route.get("/dashboard",isAdmin,loadDashboard)
route.get("/userManagement",isAdmin,loadUsers);
route.patch('/userManagement/block/:id', blockUser);
route.patch('/userManagement/unblock/:id', unblockUser);
route.get("/category",loadCategory);
route.post("/category",addCategory);
route.put("/category/:id",editCategory);
route.delete("/category/:id",deleteCategory);
route.get("/product",loadProduct);
route.get("/addProduct",loadAddProduct);
route.get("/editProduct",loadEditProduct);
route.get('/logout', adminLogout);

export default route;