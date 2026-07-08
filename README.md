BootCamp

A full-stack e-commerce web app built with Node.js, Express, MongoDB (Mongoose), and Handlebars.
Includes customer-facing shopping (catalog, cart, wishlist, checkout, coupons, offers, wallet, referrals)
and an admin panel (products, categories, brands, orders, offers, coupons, sales reports).

Features

Customer

* Email/password auth with OTP verification, Google OAuth login, password reset
* Product catalog with categories, brands, variants (color/size/stock), and limited-edition items
* Server-side search, sort (price, name, brand), price-range filtering, and pagination on all product listing pages
* Cart, wishlist, and checkout with saved addresses
* Coupons and product/category offers
* Razorpay online payments, Cash on Delivery, and an in-app wallet
* Order tracking, cancellation, and return requests with invoice download (PDF)
* Referral program with wallet credit for both referrer and referee
* Order, wishlist, and cart displays consistently reflect the exact color/variant a customer selected or purchased

Admin

* Product, category, and brand management (with image uploads via Cloudinary)
* Coupon and offer management
* Order management and return approvals
* Sales reports (Excel export)
* User management (block/unblock)
* Dashboard with earnings, order status breakdown, top categories, and best-selling products

  
Tech Stack

Backend

* Node.js — runtime
* Express 5 — web framework
* Mongoose — MongoDB ODM
* Passport.js (passport-google-oauth20) — Google OAuth login
* express-session — separate user/admin sessions
* bcrypt — password hashing
* nodemailer — OTP / email delivery
* nocache — disable browser caching on protected routes

Views

* hbs (Handlebars) — server-rendered views, with custom helpers (config/hbsHelpers.js)

File Storage & Media

* Cloudinary + multer-storage-cloudinary — image uploads (products, profile photos, return proofs)
* Multer — multipart form handling

Payments

* Razorpay — online payments, retries, wallet top-ups

Reporting & Documents

* ExcelJS — sales report export
* PDFKit — invoice generation

Dev Tools

* nodemon — auto-restart in development
* dotenv — environment variable management

BootCamp/
├── Controller/
│   ├── Admin/              
│   ├── User/               
│   ├── service/
│   └── otpcontroller.js
├── Middleware/              
├── Model/                   
├── Routes/                  
├── Views/
│   ├── Admin/                
│   ├── users/                
│   └── partials/
├── config/                  
├── mongo_db/                 
├── utils/                    
├── public/                   
├── Server.js                 
└── package.json
