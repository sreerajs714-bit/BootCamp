import { fileURLToPath } from "url";
import path from "path";
import hbs from "hbs"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const registerHbsHelpers = () => {

hbs.registerHelper('slice', function (str, start, end) {
    if (!str) return '';
    str = str.toString();
    return typeof end === 'number' ? str.slice(start, end) : str.slice(start);
});

hbs.registerHelper("addIndex", (index, currentPage, limit) => {
    return (currentPage - 1) * limit + index + 1;
});

hbs.registerHelper('substring', (str, start, end) => {
    if (!str) return '';
    return str.toString().substring(start, end);
});

hbs.registerPartials(path.join(process.cwd(), "views/partials"));


hbs.registerHelper('gt', (a, b) => a > b);
hbs.registerHelper('gte', (a, b) => a >= b); 
hbs.registerHelper("add", (a, b) => a + b);
hbs.registerHelper('and', function(...args) {
    const values = args.slice(0, -1);
    return values.every(Boolean);
});

hbs.registerHelper('or', function(...args) {
    const values = args.slice(0, -1);
    return values.some(Boolean);
});

hbs.registerHelper('not', (a) => !a);
hbs.registerHelper('includes', (arr, val) => Array.isArray(arr) && arr.map(String).includes(String(val)));
hbs.registerHelper('eq', (a, b) => String(a) === String(b));
hbs.registerHelper('ne', (a, b) => a !== b);
hbs.registerHelper("lte", (a, b) => a <= b);
hbs.registerHelper("sub", (a, b) => a - b);
hbs.registerHelper("mul", (a, b) => a * b);
hbs.registerHelper('json', (context) => JSON.stringify(context));
hbs.registerHelper('selected', (a, b) => a && b && a.toString() === b.toString() ? 'selected' : '');
hbs.registerHelper('json', (context) => JSON.stringify(context));

hbs.registerHelper('initials', function (fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    return fullName
        .trim()
        .split(/\s+/)
        .map(word => word[0].toUpperCase())
        .join('');
});

hbs.registerHelper("formatDate", function (date) {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
});

hbs.registerHelper("formatTime", function (date) {
    if (!date) return "";

    return new Date(date).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
});

} 

