import User from "../../model/userModel.js";

export const getUsersService = async ({ page, limit, search, filter, sort }) => {
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

    return {
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
};

export const blockUserService = async (id) => {
    const user = await User.findByIdAndUpdate(
        id,
        { isBlocked: true },
        { returnDocument: 'after' }
    );

    if (!user) {
        throw new Error("User not found");
    }

    return user;
};

export const unblockUserService = async (id) => {
    const user = await User.findByIdAndUpdate(
        id,
        { isBlocked: false },
        { returnDocument: 'after' }
    );

    if (!user) {
        throw new Error("User not found");
    }

    return user;
};
