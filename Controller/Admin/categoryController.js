import Category from "../../Model/categoryModel.js";
import Product from "../../Model/productModel.js";

export const loadCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const filterParam = req.query.filter || "all";
    const sort = req.query.sort || "default";

    // ── Build the query filter ──────────────────────────────────
    let dbFilter = {};

    if (filterParam === "deleted") {
      dbFilter.isDeleted = true;
    } else if (filterParam === "active") {
      dbFilter.isDeleted = false;
      dbFilter.isActive = true;
    } else if (filterParam === "inactive") {
      dbFilter.isDeleted = false;
      dbFilter.isActive = false;
    } else {
      dbFilter.isDeleted = false;
    }

    if (search) {
      dbFilter.name = { $regex: search, $options: "i" };
    }

    // ── Build the sort order ────────────────────────────────────
    let sortOrder = { createdAt: -1 };
    if (sort === "name-asc")  sortOrder = { createdAt: -1 };
    if (sort === "name-desc") sortOrder = { createdAt: 1 };

    // ── Fetch paginated categories ──────────────────────────────
    const [categories, totalCategories] = await Promise.all([
      Category.find(dbFilter).sort(sortOrder).skip(skip).limit(limit).lean(),
      Category.countDocuments(dbFilter),
    ]);

    // ── Attach product count to each category ───────────────────
for (let category of categories) {
  const count = await Product.countDocuments({
    category: category._id,
    isDeleted: false,
  });
  category.productCount = count;
}

    // ── Stats cards ─────────────────────────────────────────────
    const [totalCount, activeCount, inactiveCount] = await Promise.all([
      Category.countDocuments({ isDeleted: false }),
      Category.countDocuments({ isDeleted: false, isActive: true }),
      Category.countDocuments({ isDeleted: false, isActive: false }),
    ]);

    const totalPages = Math.ceil(totalCategories / limit);

    res.render("admin/category", {
      categories,
      currentPage: page,
      totalPages,
      totalCount,
      activeCount,
      inactiveCount,
      totalCategories,
      search,
      filter: filterParam,
      sort,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      pageNumbers: Array.from({ length: totalPages }, (_, i) => i + 1),
    });

  } catch (error) {
    console.error("loadCategory error:", error);
    res.status(500).send("Internal server error");
  }
};

export const addCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body;

     // 1. Presence check ← THIS IS MISSING
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // 2. Duplicate check (case-insensitive)
    const existing = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    // 3. Save
    const category = new Category({
      name: name.trim(),
      isActive: isActive ?? true,
    });

    await category.save();

    return res.status(201).json({
      success: true,
      message: "Category added successfully",
      data: category,
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }
    console.error("addCategory error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    // 1. Presence check
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // 2. Duplicate check — exclude current category from check
    const existing = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists",
      });
    }

    // 3. Update
   const updated = await Category.findByIdAndUpdate(
    id,
    {
      name: name.trim(),
      isActive,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
   );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updated,
    });

  } catch (error) {
    console.error("editCategory error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Soft delete — just sets isDeleted to true
    await Category.findByIdAndUpdate(id, { isDeleted: true });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });

  } catch (error) {
    console.error("deleteCategory error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const restoreCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndUpdate(
      id,
      { isDeleted: false, isActive: true },
      {returnDocument: "after"}
    );

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, message: "Category restored successfully" });

  } catch (error) {
    console.error("restoreCategory error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};