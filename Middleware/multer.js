// middleware/upload.js
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/profiles"); // ✅ folder to save images
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
                  allowedTypes.test(file.mimetype);
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error("Only jpeg, jpg, png, webp allowed"));
  }
};

export const uploadProfile = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, 
  fileFilter
});