import Address from "../../Model/addressModel.js"
import mongoose from "mongoose";

export const loadAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
     res.locals.breadcrumbs = [
       { label: 'Home', url: '/' },
       { label: "Address" },
       ];

    const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });

    res.render("users/address", {
      addresses,
      hasAddresses: addresses.length > 0,
      user: req.session.user,
    });

  } catch (error) {
    console.error('Load address error:', error);
    res.status(500).send('Something went wrong');
  }
};

export const addAddress = async (req, res) => {
  try {
    const {
      fullName,
      phoneNO,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      addressType,
      isDefault,
    } = req.body;

    const userId = req.session.user.id; 

    // If new address is set as default, unset all others first
    if (isDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    // If this is the user's first address, make it default automatically
    const existingCount = await Address.countDocuments({ user: userId });

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
      isDefault: existingCount === 0 ? true : isDefault || false,
    });

    await newAddress.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: newAddress,
    });

  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add address',
      error: error.message,
    });
  }
};

export const editAddress = async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const { id } = req.params;
    const userId = req.session.user.id;

    const existingAddress = await Address.findOne({
      _id: new mongoose.Types.ObjectId(id),
      user: new mongoose.Types.ObjectId(userId),
    });

    if (!existingAddress) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const { fullName, phoneNO, addressLine1, addressLine2, city, state, pincode, addressType, isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const updatedAddress = await Address.findByIdAndUpdate(
      id,
      { fullName, phoneNO, addressLine1, addressLine2: addressLine2 || '', city, state, pincode, addressType: addressType || 'Home', isDefault: isDefault || false },
       { returnDocument: 'after', runValidators: true }
    );

    return res.status(200).json({ success: true, message: 'Address updated successfully', address: updatedAddress });

  } catch (error) {
    console.error('Edit address error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update address', error: error.message });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, please login',
      });
    }

    const { id } = req.params;
    const userId = req.session.user.id;

    // Check address belongs to this user
    const existingAddress = await Address.findOne({ _id: id, user: userId });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    await Address.findByIdAndDelete(id);

    // If deleted address was default, make the next one default
    if (existingAddress.isDefault) {
      const nextAddress = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
    });

  } catch (error) {
    console.error('Delete address error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message,
    });
  }
};