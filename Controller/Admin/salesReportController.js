import PDFDocument from "pdfkit";
import ExcelJS from 'exceljs';
import Order from "../../Model/orderModel.js";
import User from "../../Model/userModel.js";
import { growthAnalysis, buildChartData, buildCouponUsage, fmtDate, getDateRange} from "../../utils/salesReport.js"

export const loadSalesReport = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;

    const { start, end, prevStart, prevEnd, label } = getDateRange(period, startDate, endDate);

    const currentOrders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      orderStatus: { $nin: ['Cancelled', 'Failed'] },
    }).sort({ createdAt: -1 }).lean();

    const previousOrders = await Order.find({
      createdAt: { $gte: prevStart, $lte: prevEnd },
      orderStatus: { $nin: ['Cancelled', 'Failed'] },
    }).lean();

    const calcFinal = (o) => {
    const subtotal = (o.items || [])
    .filter(i => i.status === 'Active')  // exclude cancelled items
    .reduce((s, i) => s + (i.price * i.quantity), 0);
    return Math.max(0, subtotal - (o.couponDiscount || 0));
    };

    // ✅ FIX: use totalAmount instead of finalAmount
    const totalRevenue = currentOrders.reduce((s, o) => s + calcFinal(o), 0);
    const totalOrders  = currentOrders.length;
    const totalProductsSold = currentOrders.reduce((s, o) =>
    s + (o.items || [])
    .filter(i => i.status === 'Active')
    .reduce((si, i) => si + (i.quantity || 1), 0), 0);

    // ✅ FIX: use totalAmount for previous period too
    const prevRevenue = previousOrders.reduce((s, o) => s + calcFinal(o), 0);


    // ✅ FIX: pass totalAmount field name to buildChartData
    const { labels: chartLabels, data: chartData } = buildChartData(currentOrders, period, start, end);
    const couponUsage = buildCouponUsage(currentOrders);

    // ✅ FIX: field is 'user' not 'userId'/'customerId'
    const top5 = currentOrders.slice(0, 5);
    const userIds = [...new Set(top5.map(o => o.user).filter(Boolean))];
    let userMap = {};
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } }).select('name username email').lean();
      users.forEach(u => {
        userMap[u._id.toString()] = u.name || u.username || u.email || 'Unknown';
      });
    }

   const recentOrders = top5.map(o => ({
    orderId:     o._id.toString().slice(-8).toUpperCase(),
    date:        fmtDate(new Date(o.createdAt)),
    userName:    userMap[o.user?.toString()] || 'Unknown',
    method:      o.paymentMethod || 'N/A',
    finalAmount: calcFinal(o),  // ← was o.totalAmount
    }));

    return res.json({
      success: true,
      data: {
        dateRangeLabel:   label,
        totalRevenue:     parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        totalProductsSold,
        chartLabels,
        chartData,
        growthComparison:  { current: totalRevenue, previous: prevRevenue },
        analysisResult:    growthAnalysis(totalRevenue, prevRevenue),
        couponUsage,
        recentOrders,
      }
    });

  } catch (err) {
    console.error('[SalesReport] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate sales report.' });
  }
};

export const loadSalesReportPage = (req, res) => {
  res.render('admin/salesReport');
};

export const exportSalesReportExcel = async (req, res) => {
  const { period = 'month', startDate, endDate } = req.query;
  const { start, end, label } = getDateRange(period, startDate, endDate);

  const orders = await Order.find({
    createdAt: { $gte: start, $lte: end },
    orderStatus: { $nin: ['Cancelled', 'Failed'] },
  }).populate('user', 'name email username').lean();

  const calcFinal = (o) => {
    const subtotal = (o.items || [])
      .filter(i => i.status === 'Active')
      .reduce((s, i) => s + (i.price * i.quantity), 0);
    return Math.max(0, subtotal - (o.couponDiscount || 0));
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'BOOTCAMP';

  // ── Sheet 1: Summary ──────────────────────────────────────────
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 30 }, { width: 20 }];

  const totalRevenue = orders.reduce((s, o) => s + calcFinal(o), 0);
  const totalOrders  = orders.length;
  const totalSold    = orders.reduce((s, o) =>
    s + (o.items || []).filter(i => i.status === 'Active')
      .reduce((si, i) => si + (i.quantity || 1), 0), 0);

  // Add rows WITHOUT chaining .font on addRow
  summary.addRow(['BOOTCAMP — Sales Report']);
  summary.addRow([`Period: ${label}`]);
  summary.addRow([]);
  summary.addRow(['Total Revenue',       `Rs. ${totalRevenue.toLocaleString('en-IN')}`]);
  summary.addRow(['Total Orders',        totalOrders]);
  summary.addRow(['Total Products Sold', totalSold]);

  // Style after adding
  summary.getRow(1).getCell(1).font = { bold: true, size: 16 };
  summary.getRow(2).getCell(1).font = { color: { argb: 'FF6B7280' }, size: 10 };
  [4, 5, 6].forEach(r => {
    summary.getRow(r).getCell(1).font = { bold: true, color: { argb: 'FF6B7280' }, size: 10 };
    summary.getRow(r).getCell(2).font = { bold: true, size: 11 };
  });

  // ── Sheet 2: Orders ───────────────────────────────────────────
  const sheet = wb.addWorksheet('Orders');
  sheet.columns = [
    { header: 'Order ID',       key: 'id',       width: 16 },
    { header: 'Date',           key: 'date',     width: 14 },
    { header: 'Customer',       key: 'customer', width: 20 },
    { header: 'Payment Method', key: 'method',   width: 16 },
    { header: 'Coupon',         key: 'coupon',   width: 12 },
    { header: 'Discount (Rs.)', key: 'disc',     width: 16 },
    { header: 'Final (Rs.)',    key: 'final',    width: 14 },
  ];

  sheet.getRow(1).eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    cell.alignment = { horizontal: 'center' };
  });

  orders.forEach((o, idx) => {
    const row = sheet.addRow({
      id:       o._id.toString().slice(-8).toUpperCase(),
      date:     fmtDate(new Date(o.createdAt)),
      customer: o.user?.name || o.user?.username || o.user?.email || 'Unknown',
      method:   (o.paymentMethod || 'N/A').toUpperCase(),
      coupon:   o.couponCode || '—',
      disc:     o.couponDiscount || 0,
      final:    calcFinal(o),
    });

    if (idx % 2 === 1) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      });
    }
  });

  // ── Sheet 3: Coupon Usage ─────────────────────────────────────
  const couponSheet = wb.addWorksheet('Coupon Usage');
  couponSheet.columns = [
    { header: 'Coupon Code',    key: 'code',     width: 20 },
    { header: 'Usage Count',    key: 'count',    width: 14 },
    { header: 'Total Discount', key: 'discount', width: 18 },
  ];

  couponSheet.getRow(1).eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  });

  const couponMap = {};
  orders.forEach(o => {
    if (!o.couponCode) return;
    const code = o.couponCode.toUpperCase();
    if (!couponMap[code]) couponMap[code] = { code, count: 0, discount: 0 };
    couponMap[code].count++;
    couponMap[code].discount += o.couponDiscount || 0;
  });
  Object.values(couponMap).forEach(c => couponSheet.addRow(c));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="sales-report-${period}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};

export const exportSalesReportPDF = async (req, res) => {
  const { period = 'month', startDate, endDate } = req.query;
  const { start, end, label } = getDateRange(period, startDate, endDate);

  const orders = await Order.find({
    createdAt: { $gte: start, $lte: end },
    orderStatus: { $nin: ['Cancelled', 'Failed'] },
  }).populate('user', 'name email').lean();

  const calcFinal = (o) => {
    const subtotal = (o.items || [])
      .filter(i => i.status === 'Active')
      .reduce((s, i) => s + (i.price * i.quantity), 0);
    return Math.max(0, subtotal - (o.couponDiscount || 0));
  };

  const totalRevenue = orders.reduce((s, o) => s + calcFinal(o), 0);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sales-report-${period}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(22).font('Helvetica-Bold').text('BOOTCAMP', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text(`Sales Report — ${label}`, 50, 80);
  doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#E5E7EB').stroke();

  // Summary boxes
  doc.fillColor('#111827');
  const stats = [
    ['TOTAL REVENUE', `Rs. ${totalRevenue.toLocaleString('en-IN')}`],
    ['TOTAL ORDERS', orders.length],
    ['PRODUCTS SOLD', orders.reduce((s, o) =>
      s + (o.items || []).filter(i => i.status === 'Active').reduce((si, i) => si + i.quantity, 0), 0)],
  ];
  stats.forEach(([title, value], idx) => {
    const x = 50 + idx * 165;
    doc.roundedRect(x, 115, 155, 60, 8).fillColor('#F9FAFB').fill();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#9CA3AF').text(title, x + 12, 128);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#111827').text(String(value), x + 12, 143);
  });

  // Orders table
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Recent Orders', 50, 200);
  doc.moveTo(50, 218).lineTo(545, 218).strokeColor('#E5E7EB').stroke();

  const cols = [50, 130, 210, 320, 410, 545];
  const headers = ['Order #', 'Date', 'Customer', 'Method', 'Amount'];

  // Table header
  doc.rect(50, 224, 495, 22).fillColor('#111827').fill();
  headers.forEach((h, i) => {
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text(h, cols[i] + 4, 230, { width: cols[i + 1] - cols[i] - 8 });
  });

  // Table rows
  let y = 246;
  orders.slice(0, 20).forEach((o, idx) => {
    if (y > 750) { doc.addPage(); y = 50; }
    if (idx % 2 === 0) doc.rect(50, y, 495, 20).fillColor('#F9FAFB').fill();
    const row = [
      '#' + o._id.toString().slice(-8).toUpperCase(),
      fmtDate(new Date(o.createdAt)),
      (o.user?.name || 'Unknown').slice(0, 14),
      o.paymentMethod || 'N/A',
      'Rs. ' + calcFinal(o).toLocaleString('en-IN'),
    ];
    row.forEach((val, i) => {
      doc.fontSize(8).font('Helvetica').fillColor('#374151')
        .text(String(val), cols[i] + 4, y + 6, { width: cols[i + 1] - cols[i] - 8, ellipsis: true });
    });
    y += 20;
  });

  // Footer
  doc.fontSize(7).fillColor('#9CA3AF')
    .text(`Generated on ${new Date().toLocaleDateString('en-IN')} — BOOTCAMP Admin`, 50, 800, { align: 'center' });

  doc.end();
};