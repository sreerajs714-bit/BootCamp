
import Product from "../../Model/productModel.js"
import Brand from "../../Model/brandModel.js";


export const loadBrand = async (req, res) => {
    try {

        let { page = 1, search = "", filter = "all", sort = "default" } = req.query;

        page = parseInt(page);
        const limit = 5;
        const skip = (page - 1) * limit;

        
        const dbFilter = {};

         if (search) {
         dbFilter.name = { $regex: search, $options: "i" };
         }

        if (filter === "active") {
            dbFilter.isDeleted = false;
            dbFilter.isActive = true;
        } else if (filter === "inactive") {
            dbFilter.isDeleted = false;
            dbFilter.isActive = false;
        } else if (filter === "deleted") {
            dbFilter.isDeleted = true;
        } else {
            
        }

       
        let sortOption = { createdAt: -1 };
        if (sort === "name-asc")  sortOption = { createdAt: -1 };
        if (sort === "name-desc") sortOption = { createdAt: 1 };

        
        const brands = await Brand.find(dbFilter)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        
        for (let brand of brands) {
        const count = await Product.countDocuments({
        brand: brand._id,
        isDeleted: false,
  });
  brand.productCount = count;
}

        
        const [totalCount, activeCount, inactiveCount] = await Promise.all([
            Brand.countDocuments({ isDeleted: false }),
            Brand.countDocuments({ isDeleted: false, isActive: true }),
            Brand.countDocuments({ isDeleted: false, isActive: false }),
        ]);

        
        const filteredCount = await Brand.countDocuments(dbFilter);
        const totalPages = Math.ceil(filteredCount / limit);

        const pageNumbers = [];
        for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);

        res.render("admin/brandManagement", {
            brands,
            totalCount,
            activeCount,
            inactiveCount,
            currentPage: page,
            totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            pageNumbers,
            search,
            filter,
            sort,
        });

    } catch (error) {
        console.log("Get Brand Page Error:", error);
        res.status(500).send("Server Error");
    }
};

export const addBrand = async (req, res) => {
    try {
        let { name, isActive } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Brand name is required",
            });
        }

        name = name.trim();

        // Check existing brand
        const existingBrand = await Brand.findOne({
            name: { $regex: `^${name}$`, $options: "i" },
        });

        if (existingBrand && !existingBrand.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Brand already exists",
            });
        }

        // Restore deleted brand
        if (existingBrand && existingBrand.isDeleted) {
            existingBrand.isDeleted = false;
            existingBrand.isActive = isActive;

            await existingBrand.save();

            return res.json({
                success: true,
                message: "Brand restored successfully",
            });
        }

        // Create new
        const newBrand = new Brand({
            name,
            isActive,
        });

        await newBrand.save();

        res.json({
            success: true,
            message: "Brand added successfully",
        });

    } catch (error) {
        console.log("Add Brand Error:", error);

        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

export const editBrand = async (req, res) => {
    try {
        const { id } = req.params;
        let { name, isActive } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Brand name is required",
            });
        }

        name = name.trim();

        // Duplicate check
        const existingBrand = await Brand.findOne({
            _id: { $ne: id },
            name: { $regex: `^${name}$`, $options: "i" },
            isDeleted: false,
        });

        if (existingBrand) {
            return res.status(400).json({
                success: false,
                message: "Brand name already exists",
            });
        }

        await Brand.findByIdAndUpdate(id, {
            name,
            isActive,
        });

        res.json({
            success: true,
            message: "Brand updated successfully",
        });

    } catch (error) {
        console.log("Edit Brand Error:", error);

        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

export const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;

        const brand = await Brand.findById(id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: "Brand not found",
            });
        }

        // Soft delete
        brand.isDeleted = true;
        brand.isActive = false;

        await brand.save();

        res.json({
            success: true,
            message: "Brand deleted successfully",
        });

    } catch (error) {
        console.log("Delete Brand Error:", error);
          -- add .message
    console.log("Error name:", error.name); 

        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

export const restoreBrand = async (req, res) => {
    try {
        const { id } = req.params;

        const brand = await Brand.findById(id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: "Brand not found",
            });
        }

        if (!brand.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Brand is not deleted",
            });
        }

        brand.isDeleted = false;
        brand.isActive = true;

        await brand.save();

        res.json({
            success: true,
            message: "Brand restored successfully",
        });

    } catch (error) {
        console.log("Restore Brand Error:", error);

        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};