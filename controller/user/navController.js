import { getNavCountsService } from "../../services/user/navService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const getCounts = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(statuscodes.OK).json({ cartCount: 0, wishlistCount: 0 });
        }

        const userId = req.session.user?._id || req.session.user?.id;
        
        if (!userId) {
            return res.json({ success: true, cartCount: 0, wishlistCount: 0 });
        }

        const counts = await getNavCountsService(userId);

        return res.json({ success: true, ...counts });

    } catch (err) {
        console.error('getCounts error:', err);
        return res.json({ success: true, cartCount: 0, wishlistCount: 0 });
    }
};
