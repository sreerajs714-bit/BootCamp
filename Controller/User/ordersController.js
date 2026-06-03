import Order from "../../Model/orderModel.js";



export const loadMyOrders = async (req, res) => {
    try {
        const userId =
            req.session?.user?.id ||
            req.session?.user?._id ||
            req.user?._id;

        if (!userId) return res.redirect('/users/login');

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 })
            .lean();

        const formattedOrders = orders.map(order => ({
            _id: order._id,
            orderId: order._id.toString().slice(-8).toUpperCase(),
            createdAt: order.createdAt,
            totalPrice: order.totalAmount,
            status: order.orderStatus,
            items: order.items.map(item => ({
                product: {
                    _id: item.product?._id,
                    productName: item.product?.productName || 'Product',
                    images: item.product?.variants?.[0]?.images || [],
                },
                quantity: item.quantity,
                price: item.price,
                size: item.size || 'N/A',
            }))
        }));

        return res.render('users/myOrders', {
            orders: formattedOrders,
        });

    } catch (error) {
        console.error('loadOrders error:', error);
        return res.redirect('/users/home');
    }
};

export const loadOrderDetail =(req,res)=>{
    res.render("users/orderDetail");
}