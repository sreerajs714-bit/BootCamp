import User from "../../model/userModel.js";
import Product from "../../model/productModel.js";
import Cart from "../../model/cartModel.js";
import Wishlist from "../../model/wishlistModel.js";
import { generateOTP, sendOTPEmail } from "../../utils/mail.js";
import OTP from "../../model/otpModel.js";
import bcrypt from "bcrypt";
import { getActiveOffers, calculateOfferPrice } from "../../utils/offer.js";

const saltround = 10;

export const registerUserService = async ({ username, email, password, cfmpassword, referralCode }) => {
    const usernameRegex = /^[a-zA-Z_ ]{3,16}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!username || !usernameRegex.test(username.trim())) {
        throw new Error("Username must be 3-16 characters, letters only.");
    }

    if (!email || !emailRegex.test(email.trim())) {
        throw new Error("Please provide a valid email address.");
    }

    if (!password) {
        throw new Error("Password is required.");
    }

    const passwordChecks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };

    if (!Object.values(passwordChecks).every(Boolean)) {
        throw new Error("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.");
    }

    if (cfmpassword !== undefined && password !== cfmpassword) {
        throw new Error("Passwords do not match.");
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
        const error = new Error("An account with this email already exists.");
        error.statusCode = 409;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, saltround);

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    await OTP.deleteMany({ email: cleanEmail, purpose: "register" });
    await OTP.create({
        email: cleanEmail,
        otp: hashedOTP,
        purpose: "register",
        expiresAt: Date.now() + 1 * 60 * 1000
    });

    await sendOTPEmail(cleanEmail, otp);

    return {
        pendingUser: {
            username: username.trim(),
            email: cleanEmail,
            password: hashedPassword,
            referralCode: referralCode || null
        },
        cleanEmail
    };
};

export const loginUserService = async ({ email, password }) => {
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
        const error = new Error("User does not exist");
        error.statusCode = 404;
        throw error;
    }

    if (existingUser.isBlocked) {
        const error = new Error("Your Account Is Blocked By Admin");
        error.statusCode = 403;
        throw error;
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
         const error = new Error("Incorrect password");
         error.statusCode = 401;
         throw error;
    }

    return {
        id: existingUser._id,
        username: existingUser.username,
        email: existingUser.email,
        phoneNo: existingUser.phoneNO,
        profilePhoto: existingUser.profilePhoto || null
    };
};

export const loadHomeService = async (userId) => {
    const [newArrivals, limitedEdition, wishlist, activeOffers] = await Promise.all([
        Product.find({ status: "active", isDeleted: false })
            .sort({ createdAt: -1 })
            .limit(4)
            .populate("brand", "name")
            .populate("category", "name")
            .lean(),

        Product.find({ status: "active", isDeleted: false, isLimitedEdition: true })
            .sort({ createdAt: -1 })
            .limit(2)
            .populate("brand", "name")
            .populate("category", "name")
            .lean(),

        userId ? Wishlist.findOne({ userId }).lean() : Promise.resolve(null),
        getActiveOffers(),
    ]);

    const wishlistSet = new Set(
        wishlist?.products?.map((item) =>
            item.productId ? item.productId.toString() : item.toString()
        ) || []
    );

    let cartCount = 0;
    if (userId) {
        const cart = await Cart.findOne({ userId }).lean();
        cartCount = cart?.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) ?? 0;
    }

    const formatProduct = (p) => {
        const variant =
            p.variants?.find((v) => v.isDefault && v.isActive) ||
            p.variants?.find((v) => v.isActive) ||
            p.variants?.[0];

        let stock_label, stock_icon;
        if (!variant || variant.stock === 0) {
            stock_label = "Out of Stock";
            stock_icon = "cancel";
        } else if (variant.stock <= 10) {
            stock_label = `Only ${variant.stock} left`;
            stock_icon = "schedule";
        } else {
            stock_label = "In Stock";
            stock_icon = "check_circle";
        }

        const rawPrice = variant?.price || 0;
        const pricing = calculateOfferPrice(rawPrice, p, activeOffers);

        return {
            id: p._id.toString(),
            productName: p.productName,
            brand: p.brand?.name || "",
            rawPrice,
            discountedPrice: pricing.discountedPrice,
            hasOffer: pricing.hasOffer,
            offerPercentage: pricing.offer
                ? pricing.offer.discountType === 'percentage'
                    ? pricing.offer.discountValue
                    : Math.round((pricing.discount / rawPrice) * 100)
                : 0,
            images: variant?.images || [],
            isLimitedEdition: p.isLimitedEdition,
            createdAt: p.createdAt,
            inStock: !!(variant && variant.stock > 0),
            stock_label,
            stock_icon,
            isWishlisted: userId ? wishlistSet.has(p._id.toString()) : false,
            variantId: variant?._id?.toString() || "",
            defaultSize: Array.isArray(variant?.sizes) ? variant.sizes[0] : (variant?.sizes || ""),
        };
    };

    const formattedNewArrivals = newArrivals.map(formatProduct);
    const formattedLimited = limitedEdition.map(formatProduct);
    const wishlistCount = wishlist?.products?.length ?? 0;

    return {
        products: formattedNewArrivals,
        limitedProducts: formattedLimited,
        cartCount,
        wishlistCount
    };
};

export const resetPasswordService = async (email) => {
    email = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
        const error = new Error("User does not exist");
        error.statusCode = 404;
        throw error;
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    await OTP.deleteMany({ email, purpose: "reset" });
    await OTP.create({
        email,
        otp: hashedOTP,
        purpose: "reset",
        expiresAt: Date.now() + 60 * 1000
    });

    await sendOTPEmail(email, otp);
    return email;
};

export const setNewPasswordService = async ({ email, password }) => {
    const user = await User.findOne({ email });

    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    const isSame = await bcrypt.compare(password, user.password);

    if (isSame) {
        const error = new Error("New password cannot be same as old password");
        error.statusCode = 400;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();
};
