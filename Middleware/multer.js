import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Profile storage (disk) ───────────────────────────────────
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/uploads/profiles"),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// ── Product storage (Cloudinary) ─────────────────────────────
const productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder:          "bootcamp/products",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation:  [{ width: 1000, height: 1000, crop: "fill" }],
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
    allowedTypes.test(file.mimetype);
    isValid ? cb(null, true) : cb(new Error("Only jpeg, jpg, png, webp allowed"));
};

export const uploadProfile = multer({
    storage: profileStorage,
    limits:  { fileSize: 2 * 1024 * 1024 },
    fileFilter,
});

export const uploadProduct = multer({
    storage: productStorage,
    limits:  { fileSize: 5 * 1024 * 1024 },
    fileFilter,
});