import Offer from "../../model/offerModel.js";
import Product from "../../model/productModel.js";
import Category from "../../model/categoryModel.js";
import { validateOfferPayload } from "../../utils/offer.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadOfferService = async ({ search = "", type = "all", status = "all", page = 1 }) => {
    const LIMIT = 5;
    const currentPage = Math.max(1, parseInt(page));
    const now = new Date();

    const filter = {};

    if (search.trim()) {
        filter.label = { $regex: search.trim(), $options: "i" };
    }

    if (type === "product") filter.applicableTo = "product";
    else if (type === "category") filter.applicableTo = "category";

    if (status === "active") {
        filter.isActive = true;
        filter.expiryDate = { $gte: now };
    } else if (status === "expired") {
        filter.expiryDate = { $lt: now };
    }

    const totalResults = await Offer.countDocuments(filter);
    const totalPages   = Math.ceil(totalResults / LIMIT);
    const skip         = (currentPage - 1) * LIMIT;

    const offers = await Offer.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(LIMIT)
        .lean();

    const enriched = offers.map(o => ({
        ...o,
        isActive: o.isActive && new Date(o.expiryDate) >= now,
    }));

    const [total, active] = await Promise.all([
        Offer.countDocuments(),
        Offer.countDocuments({ isActive: true, expiryDate: { $gte: now } }),
    ]);

    return {
        offers: enriched,
        stats: {
            total,
            active,
            inactive: total - active,
        },
        pagination: {
            currentPage,
            totalPages,
            totalResults,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1,
            limit: LIMIT,
        },
    };
};

export const getOfferByIdService = async (id) => {
    const offer = await Offer.findById(id).lean();

    if (!offer) {
        const err = new Error("Offer not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    return { offer };
};

export const createOfferService = async (bodyData) => {
    const validation = validateOfferPayload(bodyData);
    if (validation.error) {
        const err = new Error(validation.error);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const {
        label, applicableTo, target,
        discountType, numAmount,
        numMaxCap, numMinOrder,
        parsedStart, parsedEnd,
    } = validation.data;

    let targetName;

if (applicableTo === "product") {
    const product = await Product.findById(target).lean();
    if (!product) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    targetName = product.productName || product.name;
} else {
    const category = await Category.findById(target).lean();
    if (!category) {
        const err = new Error("Category not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    targetName = category.name;
}

    const existing = await Offer.findOne({
        targetId: target,
        isActive: true,
    }).lean();
    if (existing) {
        const err = new Error(`An active offer ("${existing.label}") already exists for this ${applicableTo}`);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const offer = await Offer.create({
        label,
        applicableTo,
        targetId:      target,
        targetName:    targetName,
        discountType,
        discountValue: numAmount,
        maxCap:        numMaxCap,
        minOrder:      numMinOrder,
        startDate:     parsedStart,
        expiryDate:    parsedEnd,
        isActive:      true,
    });

    return { offer, message: "Offer created successfully" };
};

export const updateOfferService = async ({ id, bodyData }) => {
    const validation = validateOfferPayload(bodyData);
    if (validation.error) {
        const err = new Error(validation.error);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const {
        label, applicableTo, target,
        discountType, numAmount,
        numMaxCap, numMinOrder,
        parsedStart, parsedEnd,
    } = validation.data;

   let targetName;

if (applicableTo === "product") {
    const product = await Product.findById(target).lean();
    if (!product) {
        const err = new Error("Product not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    targetName = product.productName || product.name;
} else {
    const category = await Category.findById(target).lean();
    if (!category) {
        const err = new Error("Category not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    targetName = category.name;
}

    const existing = await Offer.findOne({
        targetId: target,
        isActive: true,
        _id: { $ne: id },
    }).lean();
    if (existing) {
        const err = new Error(`An active offer ("${existing.label}") already exists for this ${applicableTo}`);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const updated = await Offer.findByIdAndUpdate(
        id,
        {
            label,
            applicableTo,
            targetId:      target,
            targetName,
            discountType,
            discountValue: numAmount,
            maxCap:        numMaxCap,
            minOrder:      numMinOrder,
            startDate:     parsedStart,
            expiryDate:    parsedEnd,
        },
        { new: true, runValidators: true }
    );

    if (!updated) {
        const err = new Error("Offer not found");
        err.statusCode = 404;
        throw err;
    }

    return { offer: updated, message: "Offer updated successfully" };
};

export const toggleOfferStatusService = async (id) => {
    const offer = await Offer.findById(id);

    if (!offer) {
        const err = new Error("Offer not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    const now = new Date();
    if (!offer.isActive && new Date(offer.expiryDate) < now) {
        const err = new Error("Cannot activate an expired offer. Update the dates first.");
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    return {
        isActive: offer.isActive,
        message: `Offer ${offer.isActive ? "activated" : "deactivated"}`,
    };
};

export const deleteOfferService = async (id) => {
    const deleted = await Offer.findByIdAndDelete(id);

    if (!deleted) {
        const err = new Error("Offer not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    return { message: "Offer deleted successfully" };
};

export const getProductsMetadataService = async () => {
    const products = await Product.find({ isDeleted: { $ne: true } })
        .select("_id productName")
        .sort({ productName: 1 })
        .lean();

    return products.map(p => ({
        _id: p._id,
        name: p.productName || p.name
    }));
};

export const getCategoriesMetadataService = async () => {
    return Category.find({ isDeleted: { $ne: true } })
        .select("_id name")
        .sort({ name: 1 })
        .lean();
};
