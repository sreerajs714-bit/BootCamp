import Admin from "../../model/adminModel.js"
import Order from "../../model/orderModel.js";
import Product from "../../model/productModel.js";
import Category from "../../model/categoryModel.js";
import User from "../../model/userModel.js";
import bcrypt from "bcrypt";
import { generateOTP } from "../service/mail.js";
import { sendOTPEmail } from "../service/mail.js";
import { growthAnalysis, buildChartData, buildCouponUsage, fmtDate, getDateRange} from "../../utils/salesReport.js"




export const loadLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login'); // renders your login.ejs / login.html
  } catch (error) {
    console.error('loadLogin error:', error);
    res.status(500).send('Server Error');
  }
};

export const adminlogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
        email
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    req.session.admin = {
      id: admin._id,
      email: admin.email
    };

    return res.json({
      success: true,
      message: "Login successful"
    });

  } catch (error) {
    console.error("login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export const loadDasboard = async (req, res) => {
    try {
        const period = (req.query.period || 'month').toLowerCase();

        
        const now = new Date();
        let startDate = new Date();

        if (period === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            startDate.setDate(now.getDate() - 7);
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const dateFilter  = { createdAt: { $gte: startDate, $lte: now } };
        const activeMatch = { ...dateFilter, orderStatus: { $nin: ['Cancelled','Returned'] } }; 

        
        const orderAgg = await Order.aggregate([
            { $match: activeMatch }, 
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: '$totalAmount' },
                    totalOrders:   { $sum: 1 }
                }
            }
        ]);
        const totalEarnings = orderAgg[0]?.totalEarnings ?? 0;
        const totalOrders   = orderAgg[0]?.totalOrders   ?? 0;

        
        const activeUsersCount = await User.countDocuments({
            isBlocked: false,
            ...dateFilter
        });

        
        let salesData = [0, 0, 0, 0];

        if (period === 'today') {
            const buckets = [0, 6, 12, 18, 24];
            const todayOrders = await Order.find(activeMatch) 
                .select('createdAt totalAmount');

            buckets.slice(0, 4).forEach((startHour, i) => {
                const endHour = buckets[i + 1];
                salesData[i] = todayOrders
                    .filter(o => {
                        const h = new Date(o.createdAt).getHours();
                        return h >= startHour && h < endHour;
                    })
                    .reduce((sum, o) => sum + o.totalAmount, 0);
            });

        } else if (period === 'year') {
            const yearOrders = await Order.find(activeMatch) // ✅ fixed
                .select('createdAt totalAmount');

            yearOrders.forEach(o => {
                const month = new Date(o.createdAt).getMonth();
                const qi    = Math.floor(month / 3);
                salesData[qi] += o.totalAmount;
            });

        } else {
            const totalMs   = now - startDate;
            const sliceMs   = totalMs / 4;
            const allOrders = await Order.find(activeMatch) 
                .select('createdAt totalAmount');

            allOrders.forEach(o => {
                const elapsed = new Date(o.createdAt) - startDate;
                const idx     = Math.min(Math.floor(elapsed / sliceMs), 3);
                salesData[idx] += o.totalAmount;
            });
        }

       
        const statusAgg = await Order.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
        ]);

        const statusMap = {};
        statusAgg.forEach(s => { statusMap[s._id] = s.count; });

        const orderStats = {
            delivered: statusMap['Delivered']  ?? 0,
            pending:  (statusMap['Pending']    ?? 0) + (statusMap['Confirmed']   ?? 0) +
                      (statusMap['Processing'] ?? 0) + (statusMap['Shipped']     ?? 0),
            cancelled: statusMap['Cancelled']                                            ?? 0,
            returned: (statusMap['Returned']   ?? 0) + (statusMap['Return Requested'] ?? 0),
            total:     statusAgg.reduce((a, s) => a + s.count, 0)
        };

       
        const categoryAgg = await Order.aggregate([
            { $match: activeMatch }, 
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productDoc'
                }
            },
            { $unwind: '$productDoc' },
            {
                $group: {
                    _id:   '$productDoc.category',
                    count: { $sum: '$items.quantity' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryDoc'
                }
            },
            { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } }
        ]);

        const maxCatCount    = categoryAgg[0]?.count ?? 1;
        const bestCategories = categoryAgg.map(c => ({
            name:       c.categoryDoc?.name ?? 'Unknown',
            count:      c.count,
            percentage: Math.round((c.count / maxCatCount) * 100)
        }));

        
        const allVariants = await Product.aggregate([
            { $match: { isDeleted: false } },
            { $unwind: '$variants' },
            { $project: { stock: '$variants.stock' } }
        ]);

        const outOfStockCount = allVariants.filter(v => v.stock === 0).length;
        const lowStockCount   = allVariants.filter(v => v.stock > 0 && v.stock <= 5).length;

        
        const recentOrders = await Order.find(dateFilter)
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'fullName name email')
            .lean();

        const recentAcquisitions = recentOrders.map(o => ({
            _id:     o._id,
            orderId: o._id.toString().slice(-8).toUpperCase(),
            client:  o.user?.fullName || o.user?.name || o.user?.email || 'Guest'
        }));

        
        const popularAgg = await Order.aggregate([
            { $match: activeMatch }, 
            { $unwind: '$items' },
            {
                $group: {
                    _id:       '$items.product',
                    soldCount: { $sum: '$items.quantity' }
                }
            },
            { $sort: { soldCount: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDoc'
                }
            },
            { $unwind: '$productDoc' }
        ]);

       const mostPopularProducts = popularAgg.map(p => {
    const variant =
        p.productDoc.variants?.find(v => v.isDefault && v.isActive) ||
        p.productDoc.variants?.find(v => v.isActive) ||
        p.productDoc.variants?.[0];

       return {
        _id:       p._id,
        name:      p.productDoc.productName,
        image:     variant?.images?.[0] ?? '/images/placeholder.jpg',
        soldCount: p.soldCount
      };
   });

        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({
                success: true,
                data: {
                    totalEarnings, totalOrders, activeUsersCount,
                    salesData, orderStats, bestCategories,
                    outOfStockCount, lowStockCount,
                    recentAcquisitions, mostPopularProducts
                }
            });
        }

        return res.render('admin/dashboard', {
            totalEarnings, totalOrders, activeUsersCount,
            salesData, orderStats, bestCategories,
            outOfStockCount, lowStockCount,
            recentAcquisitions, mostPopularProducts
        });

    } catch (error) {
        console.error('getDashboardData error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const adminLogout = async (req, res) => {

    try {

        req.session.destroy((err) => {

            if (err) {

                console.log("ADMIN LOGOUT ERROR:", err);

                return res.redirect('/admin/dashboard');
            }

            // CLEAR COOKIE
            res.clearCookie('admin.sid');

            return res.redirect('/admin/');
        });

    } catch (error) {

        console.log("ADMIN LOGOUT ERROR:", error);

        return res.redirect('/admin/dashboard');
    }
};