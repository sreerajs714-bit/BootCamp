import Admin from "../../model/adminModel.js"
import User from "../../model/userModel.js"


export const loadUsers = async (req, res) => {
    try {
        const page   = parseInt(req.query.page) || 1;
        const limit  = parseInt(req.query.limit) || 5;
        const search = req.query.search || '';
        const filter = req.query.filter || 'all';
        const sort   = req.query.sort || 'default';

        const query = {};

        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        if (filter === 'active') query.isBlocked = false;
        if (filter === 'blocked') query.isBlocked = true;

        let sortOption = { _id: -1 };
        if (sort === 'name-asc') sortOption = { username: 1 };
        if (sort === 'name-desc') sortOption = { username: -1 };
        if (sort === 'date-asc') sortOption = { createdAt: 1 };
        if (sort === 'date-desc') sortOption = { createdAt: -1 };

        const skip = (page - 1) * limit;

        const [users, totalFiltered, totalAll, totalActive, totalBlocked] = await Promise.all([
            User.find(query).sort(sortOption).skip(skip).limit(limit).select('-password').lean(),
            User.countDocuments(query),
            User.countDocuments({}),
            User.countDocuments({ isBlocked: false }),
            User.countDocuments({ isBlocked: true }),
        ]);

        const formattedUsers = users.map((user, index) => {
            const joinedDate = user.createdAt ? new Date(user.createdAt) : null;
            return {
                ...user,
                slNo: skip + index + 1,
                shortId: user._id ? user._id.toString().slice(-6).toUpperCase() : 'N/A',
                initials: user.username ? user.username.substring(0, 2).toUpperCase() : 'NA',
                dateLabel: joinedDate
                    ? joinedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'N/A',
                timeLabel: joinedDate
                    ? joinedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : 'N/A'
            };
        });

        const totalPages = Math.ceil(totalFiltered / limit);
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push({ num: i, isCurrent: i === page });
        }

        const payload = {
            users: formattedUsers,
            pagination: {
                currentPage: page,
                totalPages,
                totalFiltered,
                limit,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevPage: page - 1,
                nextPage: page + 1,
                pages
            },
            stats: { totalAll, totalActive, totalBlocked },
            filters: {
                search, filter, sort,
                isAll: filter === 'all',
                isActive: filter === 'active',
                isBlocked: filter === 'blocked'
            }
        };

        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({ success: true, ...payload });
        }

        res.render('admin/userManagement', payload);

    } catch (error) {
        console.error('loadUsers error:', error);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.status(500).send('Server error');
    }
};

export const blockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isBlocked: true },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: `${user.username} has been blocked`
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Failed to block user"
        });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isBlocked: false },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: `${user.username} has been unblocked`
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Failed to unblock user"
        });
    }
};

export const adminLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Admin logout error:", err);
      return res.redirect("/admin/dashboard");
    }
    res.clearCookie("connect.sid");
    return res.redirect("/admin/login");
  });
};