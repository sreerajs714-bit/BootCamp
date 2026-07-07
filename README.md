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

Layer             Technology

Runtime           Node.js
Framework         Express 5
Database          MongoDB with Mongoose (aggregation pipelines for catalog search/sort/filter/pagination)
Templating        Handlebars (hbs)
Auth              express-session, Passport (Google OAuth), bcrypt
Payments          Razorpay
Media             storageCloudinary (via multer-storage-cloudinary)
Email             Nodemailer
Reports/exports   ExcelJS, PDFKit
  
