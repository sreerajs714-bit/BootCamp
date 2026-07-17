import Coupon from "../../model/couponModel.js";
import { validateCouponPayload } from "../../utils/coupon.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadCouponService = async ({ search = "", status = "all", sort = "default", page = 1 }) => {
    const LIMIT = 5;
    const currentPage = Math.max(1, parseInt(page));

    const filter = {};
    if (search.trim()) {
        filter.code = { $regex: search.trim(), $options: "i" };
    }
    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    let sortOption = { createdAt: -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };
    else if (sort === "oldest") sortOption = { createdAt: 1 };
    else if (sort === "az") sortOption = { code: 1 };
    else if (sort === "za") sortOption = { code: -1 };

    const totalFiltered = await Coupon.countDocuments(filter);
    const totalPages = Math.ceil(totalFiltered / LIMIT);
    const skip = (currentPage - 1) * LIMIT;

    const coupons = await Coupon.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(LIMIT)
        .lean();

    const [total, active] = await Promise.all([
        Coupon.countDocuments(),
        Coupon.countDocuments({ isActive: true }),
    ]);

    return {
        coupons,
        stats: {
            total,
            active,
            inactive: total - active,
        },
        pagination: {
            currentPage,
            totalPages,
            totalFiltered,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1,
            limit: LIMIT,
        },
    };
};

export const createCouponService = async (bodyData) => {
    const validation = validateCouponPayload(bodyData);
    if (validation.error) {
        const err = new Error(validation.error);
        err.statusCode = statuscodes.BAD_REQUEST;
        throw err;
    }

    const {
        upperCode, discountType, numericValue,
        numericLimit, numericMinOrder, numericMaxDiscount,
        parsedStart, parsedEnd,
    } = validation.data;

    const existing = await Coupon.findOne({ code: upperCode });
    if (existing) {
        const err = new Error("Coupon code already exists");
        err.statusCode = statuscodes.CONFLICT;
        throw err;
    }

    const { isActive } = bodyData;

    const coupon = await Coupon.create({
        code: upperCode,
        discountType,
        discountValue: numericValue,
        startDate: parsedStart,
        expiryDate: parsedEnd,
        usageLimit: numericLimit,
        minOrder: numericMinOrder,
        maxDiscount: discountType === "percentage" ? numericMaxDiscount : undefined,
        isActive: isActive === true || isActive === "true" || isActive === "on",
        usedCount: 0,
    });

    return { coupon, message: "Coupon created successfully" };
};

export const updateCouponService = async ({ id, bodyData }) => {
    const validation = validateCouponPayload(bodyData);
    if (validation.error) {
         const err = new Error(validation.error);
         err.statusCode = statuscodes.BAD_REQUEST;
         throw err;
    }

    const {
        upperCode, discountType, numericValue,
        numericLimit, numericMinOrder, numericMaxDiscount,
        parsedStart, parsedEnd,
    } = validation.data;

    const existing = await Coupon.findOne({ code: upperCode, _id: { $ne: id } });
    if (existing) {
         const err = new Error("Coupon code already exists");
         err.statusCode = statuscodes.CONFLICT;
         throw err;
    }

    const { isActive } = bodyData;

    const updated = await Coupon.findByIdAndUpdate(
        id,
        {
            code: upperCode,
            discountType,
            discountValue: numericValue,
            startDate: parsedStart,
            expiryDate: parsedEnd,
            usageLimit: numericLimit,
            minOrder: numericMinOrder,
            maxDiscount: discountType === "percentage" ? numericMaxDiscount : undefined,
            isActive: isActive === true || isActive === "true" || isActive === "on",
        },
        { returnDocument: 'after', runValidators: true }
    );

    if (!updated) {
        const err = new Error("Coupon not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    return { coupon: updated, message: "Coupon updated successfully" };
};

export const toggleCouponStatusService = async (id) => {
    const coupon = await Coupon.findById(id);

    if (!coupon) {
        const err = new Error("Coupon not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return {
        isActive: coupon.isActive,
        message: `Coupon ${coupon.isActive ? "activated" : "deactivated"}`,
    };
};

export const deleteCouponService = async (id) => {
    const deleted = await Coupon.findByIdAndDelete(id);

    if (!deleted) {
        const err = new Error("Coupon not found");
        err.statusCode = statuscodes.NOT_FOUND;
        throw err;
    }

    return { message: "Coupon deleted successfully" };
};

export const getCouponByIdService = async (id) => {
    const coupon = await Coupon.findById(id).lean();

    if (!coupon) {
         const err = new Error("Coupon not found");
         err.statusCode = statuscodes.NOT_FOUND;
         throw err;
    }

    return { coupon };
};
