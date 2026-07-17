
export function parseDMY(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}


const CODE_REGEX = /^[A-Z0-9_-]{3,20}$/;

export function validateCouponPayload(body) {
  const {
    code, discountType, value,
    startDate, endDate,
    limit, minOrder, maxDiscount,
  } = body;

  
  if (!code || !discountType || !value || !startDate || !endDate) {
    return { error: "All required fields must be filled" };
  }

  
  const upperCode = code.trim().toUpperCase();
  if (!CODE_REGEX.test(upperCode)) {
    return { error: "Coupon code must be 3-20 characters: letters, numbers, _ or - only" };
  }

  
  if (!["flat", "percentage"].includes(discountType)) {
    return { error: "Invalid discount type" };
  }


  const numericValue = Number(value);
  if (isNaN(numericValue) || numericValue <= 0) {
    return { error: "Enter a valid discount amount greater than 0" };
  }
  if (discountType === "percentage" && numericValue > 100) {
    return { error: "Percentage discount cannot exceed 100%" };
  }

  
  let numericLimit = null;
  if (limit !== undefined && limit !== null && limit !== "") {
    numericLimit = Number(limit);
    if (isNaN(numericLimit) || !Number.isInteger(numericLimit) || numericLimit < 1) {
      return { error: "Usage limit must be a whole number of at least 1" };
    }
  }

  
  const numericMinOrder = (minOrder !== undefined && minOrder !== null && minOrder !== "")
    ? Number(minOrder)
    : 0;
  if (isNaN(numericMinOrder) || numericMinOrder < 0) {
    return { error: "Min order must be 0 or a positive number" };
  }

  
  let numericMaxDiscount = null;
  if (discountType === "percentage" && maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== "") {
    numericMaxDiscount = Number(maxDiscount);
    if (isNaN(numericMaxDiscount) || numericMaxDiscount <= 0) {
      return { error: "Max discount cap must be a positive number" };
    }
  }

  
  if (discountType === "flat") {
    if (numericMinOrder <= numericValue) {
      return { error: "Minimum order must be greater than the discount amount" };
    }
  } else if (discountType === "percentage" && numericMaxDiscount) {
    if (numericMinOrder <= numericMaxDiscount) {
      return { error: "Minimum order must be greater than the max discount cap" };
    }
  }

  
  const parsedStart = parseDMY(startDate);
  const parsedEnd   = parseDMY(endDate);
  if (!parsedStart || !parsedEnd) {
    return { error: "Invalid date format (use dd/mm/yyyy)" };
  }
  if (parsedEnd <= parsedStart) {
    return { error: "End date must be after start date" };
  }

  return {
    data: {
      upperCode,
      discountType,
      numericValue,
      numericLimit,
      numericMinOrder,
      numericMaxDiscount,
      parsedStart,
      parsedEnd,
    },
  };
}