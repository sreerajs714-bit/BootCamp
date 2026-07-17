import {
    getUserProfileService,
    changeUserPasswordService,
    changeUserEmailService,
    updateUserProfileService,
    updateProfilePhotoService,
    deleteProfilePhotoService
} from "../../services/user/profileService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    res.locals.breadcrumbs = [
       { label: 'Home', url: '/' },
       { label: "Profile" },
    ];
    const user = await getUserProfileService(userId);

    return res.render("users/profile", { 
      user,
      isGoogleUser: user.googleId ? true : false 
    });

  } catch (error) {
    console.log("LOAD PROFILE ERROR:", error.message);
    res.redirect("/users/home");
  }
};

export const loadEditProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    res.locals.breadcrumbs = [
       { label: 'Home', url: '/' },
        { label: 'Profile', url: '/users/profile' },
       { label: "editProfile" },
    ];

    const user = await getUserProfileService(userId);

    return res.render("users/editProfile", { user });

  } catch (error) {
    console.log("LOAD EDIT PROFILE ERROR:", error.message);
    res.redirect("/users/home");
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const message = await changeUserPasswordService(userId, { currentPassword, newPassword, confirmPassword });
    return res.json({ success: true, message });

  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: error.message || "Something went wrong" });
  }
};

export const changeEmail = async (req, res) => {
  try {
     const userId = req.session?.user?.id;
     const { newEmail } = req.body;

     const result = await changeUserEmailService(userId, newEmail);

     req.session.changeEmailUserId = userId;
     req.session.otpPurpose = "changeEmail";
     req.session.newEmail = result.newEmail;

     req.session.save(async () => {
         return res.json({
             success: true,
             message: "OTP sent successfully"
         });
     });

  } catch (error) {
     console.log(error);
     return res.status(error.message === "Email already exists" ? 400 : 500).json({
         success: false,
         message: error.message || "Something went wrong"
     });
  }
};

export const editProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { username, phoneNO } = req.body;

    const updated = await updateUserProfileService(userId, username, phoneNO);

    req.session.user.username = updated.username;
    req.session.user.phoneNO = updated.phoneNO;

    return res.json({ success: true, message: 'Profile updated successfully' });

  } catch (err) {
    console.error('editProfile error:', err);
    return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: err.message || 'Server error. Please try again.' });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(statuscodes.BAD_REQUEST).json({ success: false, message: "No file uploaded" });
    }

    const userId = req.session.user.id;
    const profilePhoto = await updateProfilePhotoService(userId, req.file.filename);

    return res.json({ success: true, profilePhoto });

  } catch (error) {
    console.log("UPLOAD ERROR:", error.message);
    return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Upload failed" });
  }
};

export const removeProfilePhoto = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await deleteProfilePhotoService(userId);
    return res.json({ success: true });

  } catch (error) {
    console.log("REMOVE PHOTO ERROR:", error.message);
    return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: "Something went wrong" });
  }
};
