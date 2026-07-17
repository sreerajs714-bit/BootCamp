import Address from "../../model/addressModel.js";
import mongoose from "mongoose";

export const getAddressesService = async (userId) => {
    return await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
};

export const createAddressService = async (userId, addressData) => {
    const {
        fullName,
        phoneNO,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        addressType,
        isDefault
    } = addressData;

    const existingCount = await Address.countDocuments({ user: userId });
    const shouldBeDefault = existingCount === 0 ? true : isDefault;

    if (shouldBeDefault) {
        await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const newAddress = new Address({
        user: userId,
        fullName,
        phoneNO,
        addressLine1,
        addressLine2: addressLine2 || '',
        city,
        state,
        pincode,
        addressType: addressType || 'Home',
        isDefault: shouldBeDefault,
    });

    await newAddress.save();
    return newAddress;
};

export const updateAddressService = async (id, userId, addressData) => {
    const existingAddress = await Address.findOne({
        _id: new mongoose.Types.ObjectId(id),
        user: new mongoose.Types.ObjectId(userId),
    });

    if (!existingAddress) {
        throw new Error("Address not found");
    }

    const {
        fullName,
        phoneNO,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        addressType,
        isDefault
    } = addressData;

    if (isDefault) {
        await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const updatedAddress = await Address.findByIdAndUpdate(
        id,
        {
            fullName,
            phoneNO,
            addressLine1,
            addressLine2: addressLine2 || '',
            city,
            state,
            pincode,
            addressType: addressType || 'Home',
            isDefault,
        },
        { returnDocument: 'after', runValidators: true }
    );

    return updatedAddress;
};

export const deleteAddressService = async (id, userId) => {
    const existingAddress = await Address.findOne({ _id: id, user: userId });

    if (!existingAddress) {
        throw new Error("Address not found");
    }

    await Address.findByIdAndDelete(id);

    if (existingAddress.isDefault) {
        const nextAddress = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
        if (nextAddress) {
            nextAddress.isDefault = true;
            await nextAddress.save();
        }
    }

    return true;
};
