import Product from "../../Model/productModel.js";
import Wishlist from "../../Model/wishlistModel.js";
import Cart from "../../Model/cartModel.js";


import { getActiveOffers, calculateOfferPrice } from "../../utils/offer.js";



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

        const userId = req.session.user.id;

        res.locals.breadcrumbs = [
            { label: 'Home', url: '/' },
            { label: "Wishlist" },
        ];

        const [wishlist, activeOffers] = await Promise.all([
            Wishlist.findOne({ userId })
                .populate({
                    path: "products.productId",
                    populate: {
                        path: "brand",
                        model: "Brand"
                    }
                })
                .lean(),
            getActiveOffers()
        ]);

        if (!wishlist || wishlist.products.length === 0) {
            return res.render("users/wishlist", {
                wishlistItems: [],
                count: 0,
                isLoggedIn: true
            });
        }

        const idsToRemove = [];
        const validProducts = [];

        wishlist.products.forEach(item => {
            const product = item.productId;
            const isBlockedOrDeleted = !product || product.isDeleted || product.status !== "active";
            if (isBlockedOrDeleted) {
                idsToRemove.push(product?._id || item.productId);
            } else {
                validProducts.push(item);
            }
        });

        if (idsToRemove.length > 0) {
            await Wishlist.updateOne(
                { userId },
                { $pull: { products: { productId: { $in: idsToRemove } } } }
            );
        }

        if (validProducts.length === 0) {
            return res.render("users/wishlist", {
                wishlistItems: [],
                count: 0,
                isLoggedIn: true
            });
        }

        const cart = await Cart.findOne({ userId }).lean();
        const cartProductIds = (cart?.items || []).map(i => i.productId.toString());

        const wishlistItems = validProducts.map(item => {
            const product = item.productId;

            const variant =
            product.variants?.find(v => String(v._id) === String(item.variantId)) ||
            product.variants?.find(v => v.isDefault && v.isActive) ||
            product.variants?.find(v => v.isActive) ||
            product.variants?.[0];

            const rawImages = variant?.images || [];
            const images = rawImages.map(img => {
                if (typeof img === "string") return img;
                return img.url || img.path || img.src || "";
            }).filter(Boolean);

            const rawPrice = variant?.price || 0;
            const pricing = calculateOfferPrice(rawPrice, product, activeOffers);  

            return {
                id: product._id.toString(),                          
                productName: product.productName,
                brand: product.brand?.name || product.brand?.brandName || "Brand",
                rawPrice,
                price: pricing.hasOffer                              
                    ? `₹${pricing.discountedPrice.toLocaleString("en-IN")}`
                    : `₹${rawPrice.toLocaleString("en-IN")}`,
                hasOffer: pricing.hasOffer,                          
                discountedPrice: pricing.discountedPrice,           
                offerPercentage: pricing.hasOffer                    
                    ? (pricing.offer.discountType === 'percentage'
                        ? pricing.offer.discountValue
                        : Math.round((pricing.discount / rawPrice) * 100))
                    : 0,
                variantId: variant?._id?.toString() || "",           
                size: item.size || variant?.sizes?.[0] || '',
                images,
                color: variant?.color || "",
                isLimitedEdition: product.isLimitedEdition || false,
                stock: variant?.stock || 0,
                isOutOfStock: (variant?.stock || 0) === 0,
                isInCart: cartProductIds.includes(product._id.toString()),
            };
        });

        return res.render("users/wishlist", {
            wishlistItems,
            count: wishlistItems.length,
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
        const userId = req.session?.user?.id;
        const { productId, variantId  } = req.body;

        console.log("productId:", productId);
console.log("variantId:", variantId);
 
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to continue"
            });
        }
 
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }
 
        // Check product exists and is active
        const product = await Product.findById(productId).lean();
 
        if (!product || product.isDeleted || product.status !== 'active') {
            return res.status(404).json({
                success: false,
                message: "Product not available"
            });
        }
 
        let wishlist = await Wishlist.findOne({ userId });
 
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }
 
        const existingIndex = wishlist.products.findIndex(
            p => p.productId.toString() === productId
        );
 
        if (existingIndex > -1) {
            // Already wishlisted — remove it
            wishlist.products.splice(existingIndex, 1);
            await wishlist.save();
 
            return res.status(200).json({
                success: true,
                isWishlisted: false,
                message: "Removed from wishlist"
            });
 
        } else {
            // Not wishlisted — add it
            const variant = product.variants?.find(
                 v => String(v._id) === String(variantId)
                );
 
            wishlist.products.push({
                productId,
                variantId: variant?._id || null,
                size: variant?.sizes?.[0] || '' 
            });
 
            await wishlist.save();
 
            return res.status(200).json({
                success: true,
                isWishlisted: true,
                message: "Added to wishlist"
            });
        }
 
    } catch (err) {
        console.error('toggleWishlist error:', err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session?.user?.id;
        const { productId } = req.body;
 
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to continue"
            });
        }
 
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }
 
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );
 
        return res.status(200).json({
            success: true,
            message: "Removed from wishlist"
        });
 
    } catch (err) {
        console.error("removeFromWishlist error:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

export const clearWishlist = async (req, res) => {
    try {
        const userId =
      req.session?.user?.id ||
      req.session?.user?._id ||
      req.user?._id;

       const result= await Wishlist.findOneAndUpdate(
            { userId },
            { $set: { products: [] } }
        );

        res.json({ success: true, message: "Wishlist cleared successfully" });
    } catch (error) {
        console.error("Clear wishlist error:", error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

