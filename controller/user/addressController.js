import {
    getAddressesService,
    createAddressService,
    updateAddressService,
    deleteAddressService
} from "../../services/user/addressService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
 
    res.locals.breadcrumbs = [
      { label: 'Home', url: '/' },
      { label: 'Address' },
    ];
 
    const addresses = await getAddressesService(userId);
 
    res.render('users/address', {
      addresses,
      hasAddresses: addresses.length > 0,
      user: req.session.user,
    });
 
  } catch (error) {
    console.error('Load address error:', error);
    res.status(statuscodes.SERVER_ERROR).send('Something went wrong');
  }
};
 
export const addAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
 
    const {
      fullName,
      phoneNO,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      addressType,
    } = req.body;
 
    const isDefault = req.body.isDefault === true || req.body.isDefault === 'true';

    const newAddress = await createAddressService(userId, {
      fullName,
      phoneNO,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      addressType,
      isDefault
    });
 
    return res.status(statuscodes.CREATED).json({
      success: true,
      message: 'Address added successfully',
      address: newAddress,
    });
 
  } catch (error) {
    console.error('Add address error:', error);
    return res.status(statuscodes.SERVER_ERROR).json({
      success: false,
      message: 'Failed to add address',
      error: error.message,
    });
  }
};
 
export const editAddress = async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(statuscodes.UNAUTHORIZED).json({ success: false, message: 'Not authorized' });
    }
 
    const { id } = req.params;
    const userId = req.session.user.id;
 
    const {
      fullName,
      phoneNO,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      addressType,
    } = req.body;
 
    const isDefault = req.body.isDefault === true || req.body.isDefault === 'true';

    const updatedAddress = await updateAddressService(id, userId, {
      fullName,
      phoneNO,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      addressType,
      isDefault
    });
 
    return res.status(statuscodes.OK).json({
      success: true,
      message: 'Address updated successfully',
      address: updatedAddress,
    });
 
  } catch (error) {
    console.error('Edit address error:', error);
    return res.status(statuscodes.SERVER_ERROR).json({
      success: false,
      message: 'Failed to update address',
      error: error.message,
    });
  }
};
 
export const deleteAddress = async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(statuscodes.UNAUTHORIZED).json({ success: false, message: 'Not authorized, please login' });
    }
 
    const { id } = req.params;
    const userId = req.session.user.id;
 
    await deleteAddressService(id, userId);
 
    return res.status(statuscodes.OK).json({
      success: true,
      message: 'Address deleted successfully',
    });
 
  } catch (error) {
    console.error('Delete address error:', error);
    return res.status(statuscodes.SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message,
    });
  }
};
