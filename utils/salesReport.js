import User from "../Model/userModel.js";
import Order from "../Model/orderModel.js";


export function getDateRange(period, startDate, endDate) {
  const now = new Date();
  let start, end, prevStart, prevEnd, label;
 
  switch (period) {
    case 'day': {
      start    = new Date(now); start.setHours(0, 0, 0, 0);
      end      = new Date(now); end.setHours(23, 59, 59, 999);
      prevEnd  = new Date(start - 1);
      prevStart = new Date(prevEnd); prevStart.setHours(0, 0, 0, 0);
      label    = `Today — ${fmtDate(start)}`;
      break;
    }
    case 'week': {
      const day = now.getDay();                       // 0 Sun … 6 Sat
      start    = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end      = new Date(now); end.setHours(23, 59, 59, 999);
      prevEnd  = new Date(start - 1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
      label    = `${fmtDate(start)} – ${fmtDate(end)}`;
      break;
    }
    case 'year': {
      start    = new Date(now.getFullYear(), 0, 1);
      end      = new Date(now); end.setHours(23, 59, 59, 999);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd  = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      label    = `Year ${now.getFullYear()}`;
      break;
    }
    case 'custom': {
      start    = new Date(startDate); start.setHours(0, 0, 0, 0);
      end      = new Date(endDate);   end.setHours(23, 59, 59, 999);
      const rangeMs = end - start;
      prevEnd  = new Date(start - 1);
      prevStart = new Date(prevEnd - rangeMs);
      label    = `${fmtDate(start)} – ${fmtDate(end)}`;
      break;
    }
    default: {                                       // 'month' (default)
      start    = new Date(now.getFullYear(), now.getMonth(), 1);
      end      = new Date(now); end.setHours(23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd  = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label    = `${fmtDate(start)} – ${fmtDate(end)}`;
      break;
    }
  }
 
  return { start, end, prevStart, prevEnd, label };
}
 
/** Format a Date as M/D/YYYY */
export function fmtDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
 
/** Group orders into chart buckets and return { labels[], data[] } */
export function buildChartData(orders, period, start, end) {
  const buckets = {};
 
  // Build bucket keys
  if (period === 'day') {
    // Hourly buckets: "0h", "1h" … "23h"
    for (let h = 0; h < 24; h++) buckets[`${h}h`] = 0;
  } else if (period === 'week') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => (buckets[d] = 0));
  } else if (period === 'year') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    months.forEach(m => (buckets[m] = 0));
  } else {
    // month / custom → daily buckets
    const cursor = new Date(start);
    while (cursor <= end) {
      buckets[fmtDate(cursor)] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
 
  // Fill buckets
  orders.forEach(order => {
    const d = new Date(order.createdAt);
    let key;
    if (period === 'day')        key = `${d.getHours()}h`;
    else if (period === 'week')  key = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    else if (period === 'year')  key = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    else                         key = fmtDate(d);
 
    if (key in buckets) {
  const subtotal = (order.items || [])
    .filter(i => i.status === 'Active')
    .reduce((s, i) => s + (i.price * i.quantity), 0);
  buckets[key] += subtotal - (order.couponDiscount || 0);
}
  });
 
  return {
    labels: Object.keys(buckets),
    data:   Object.values(buckets),
  };
}
 
/** Build coupon usage summary from orders */
export function buildCouponUsage(orders) {
  const map = {};
  orders.forEach(order => {
    if (!order.couponCode) return;
    const code = order.couponCode.toUpperCase();
    if (!map[code]) map[code] = { code, usageCount: 0, totalDiscount: 0 };
    map[code].usageCount++;
    map[code].totalDiscount += order.couponDiscount || 0;
  });
  return Object.values(map).sort((a, b) => b.usageCount - a.usageCount);
}
 
/** Generate an analysis blurb based on growth % */
export function growthAnalysis(current, previous) {
  if (previous === 0) return 'No previous period data to compare.';
  const pct = (((current - previous) / previous) * 100).toFixed(1);
  if (pct > 50)   return `Exceptional growth of ${pct}% compared to last cycle.`;
  if (pct > 10)   return `Significant growth of ${pct}% in realized revenue compared to last cycle.`;
  if (pct > 0)    return `Modest improvement of ${pct}% compared to the previous period.`;
  if (pct === 0)  return 'Revenue is on par with the previous period.';
  return `Revenue declined by ${Math.abs(pct)}% compared to the previous period.`;
}