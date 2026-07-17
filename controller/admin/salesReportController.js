import {
    loadSalesReportService,
    exportSalesReportExcelService,
    exportSalesReportPDFService
} from "../../services/admin/salesReportService.js";
import { statuscodes } from "../../utils/status_codes.js";

export const loadSalesReport = async (req, res) => {
    try {
        const { period = 'month', startDate, endDate } = req.query;

        const data = await loadSalesReportService({ period, startDate, endDate });

        return res.json({
            success: true,
            data
        });

    } catch (err) {
        console.error('[SalesReport] Error:', err);
        return res.status(statuscodes.SERVER_ERROR).json({ success: false, message: 'Failed to generate sales report.' });
    }
};

export const loadSalesReportPage = (req, res) => {
    res.render('admin/salesReport');
};

export const exportSalesReportExcel = async (req, res) => {
    try {
        const { period = 'month', startDate, endDate } = req.query;

        const { wb, filename } = await exportSalesReportExcelService({ period, startDate, endDate });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await wb.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('[ExportExcel] Error:', err);
        res.status(statuscodes.SERVER_ERROR).send('Internal Server Error');
    }
};

export const exportSalesReportPDF = async (req, res) => {
    try {
        const { period = 'month', startDate, endDate } = req.query;

        const { doc, filename } = await exportSalesReportPDFService({ period, startDate, endDate });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);
        doc.end();

    } catch (err) {
        console.error('[ExportPDF] Error:', err);
        res.status(statuscodes.SERVER_ERROR).send('Internal Server Error');
    }
};