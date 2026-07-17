import {
    loadReturnManagementService,
    loadReturnDetailService,
    approveReturnService,
    rejectReturnService,
    schedulePickupService,
    processRefundService
} from "../../services/admin/returnService.js";

export const loadReturnManagement = async (req, res) => {
    try {
        const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
        const { status = 'all', search = '', page = 1 } = req.query;

        const payload = await loadReturnManagementService({ status, search, page });

        if (isAjax) {
            return res.json({
                success: true,
                returns: payload.returns,
                totalFiltered: payload.totalFiltered,
                totalPages: payload.totalPages,
                currentPage: payload.currentPage,
                hasPrev: payload.hasPrev,
                hasNext: payload.hasNext,
                prevPage: payload.prevPage,
                nextPage: payload.nextPage
            });
        }

        return res.render('admin/returnManagement', {
            returns: payload.returns,
            stats: payload.stats,
            currentStatus: status,
            currentSearch: search,
            totalFiltered: payload.totalFiltered,
            currentPage: payload.currentPage,
            totalPages: payload.totalPages,
            pages: payload.pages,
            hasPrev: payload.hasPrev,
            hasNext: payload.hasNext,
            prevPage: payload.prevPage,
            nextPage: payload.nextPage
        });

    } catch (error) {
        console.error('loadReturnManagement error:', error);
        return res.redirect('/admin/dashboard');
    }
};

export const loadReturnDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const returnRequest = await loadReturnDetailService(id);

        return res.render('admin/returnDetail', { returnRequest });

    } catch (error) {
        console.error('loadReturnDetail error:', error);
        return res.redirect('/admin/returns');
    }
};

export const approveReturn = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await approveReturnService(id);

        return res.json(result);

    } catch (error) {
        console.error('approveReturn error:', error);
        return res.json({ success: false, message: error.message || 'Something went wrong' });
    }
};

export const rejectReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        const result = await rejectReturnService({ id, rejectionReason });

        return res.json(result);

    } catch (error) {
        console.error('rejectReturn error:', error);
        return res.json({ success: false, message: error.message || 'Something went wrong' });
    }
};

export const schedulePickup = async (req, res) => {
    try {
        const { id } = req.params;
        const { pickupDate, pickupTime } = req.body;

        const result = await schedulePickupService({ id, pickupDate, pickupTime });

        return res.json(result);

    } catch (error) {
        console.error('schedulePickup error:', error);
        return res.json({ success: false, message: error.message || 'Something went wrong' });
    }
};

export const processRefund = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await processRefundService(id);

        return res.json(result);

    } catch (error) {
        console.error('processRefund error:', error);
        return res.json({ success: false, message: error.message || 'Something went wrong' });
    }
};
