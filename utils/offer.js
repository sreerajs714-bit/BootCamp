import Offer from "../Model/offerModel.js";

export async function getActiveOffers() {
    const now = new Date();
    return await Offer.find({
        isActive: true,
        startDate: { $lte: now },
        expiryDate: { $gte: now },
    }).lean();
}

export function calculateOfferPrice(originalPrice, product, activeOffers) {
    let bestDiscount = 0;
    let appliedOffer = null;

    
    const productCategoryId = product.category?._id
        ? product.category._id.toString()
        : product.category
        ? product.category.toString()
        : null;


    for (const offer of activeOffers) {

        const matchesProduct =
            offer.applicableTo === 'product' &&
            offer.targetId.toString() === product._id.toString();

        const matchesCategory =
            offer.applicableTo === 'category' &&
            productCategoryId &&
            offer.targetId.toString() === productCategoryId;

        if (!matchesProduct && !matchesCategory) continue;

        let discount = 0;
        if (offer.discountType === 'percentage') {
            discount = Math.round((originalPrice * offer.discountValue) / 100);
            if (offer.maxCap && discount > offer.maxCap) discount = offer.maxCap;
        } else if (offer.discountType === 'flat') {
            discount = offer.discountValue;
        }

        if (discount > bestDiscount) {
            bestDiscount = discount;
            appliedOffer = offer;
        }
    }

    return {
        originalPrice,
        discountedPrice: Math.max(0, originalPrice - bestDiscount),
        discount: bestDiscount,
        hasOffer: bestDiscount > 0,
        offer: appliedOffer,
    };
}