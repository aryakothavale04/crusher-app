const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const session = require("express-session");
const { default: MongoStore } = require("connect-mongo");

const Diary1 = require("./models/Diary1");
const Diary2 = require("./models/Diary2");

function loadEnvFile(filename, overrideExisting = false) {
    const envPath = path.join(__dirname, filename);

    if (!fs.existsSync(envPath)) {
        return;
    }

    const fileContents = fs.readFileSync(envPath, "utf8");

    for (const rawLine of fileContents.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line || line.startsWith("#")) {
            continue;
        }

        const separatorIndex = line.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();

        if (key && (overrideExisting || process.env[key] === undefined)) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const DEFAULT_MONGO_URL = isProduction
    ? "mongodb+srv://aryakothavale04:arya123@cluster0.zs59bje.mongodb.net/?appName=Cluster0"
    : "mongodb://127.0.0.1:27017/crusherDB";
const MONGO_URL = process.env.MONGO_URL || DEFAULT_MONGO_URL;
const SESSION_SECRET = process.env.SESSION_SECRET || "crusher-management-secret";
const ACCESS_PIN = process.env.ACCESS_PIN || "4321";

if (isProduction && SESSION_SECRET === "crusher-management-secret") {
    throw new Error("SESSION_SECRET must be set in production.");
}

if (isProduction && ACCESS_PIN === "4321") {
    throw new Error("ACCESS_PIN must be set in production.");
}

const dayFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" });
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});
const dateDisplayFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
});

function normalizeDateOnly(value) {
    if (!value) {
        return null;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getDayName(value) {
    const date = value instanceof Date ? value : normalizeDateOnly(value);
    return date ? dayFormatter.format(date) : "";
}

function formatDateInput(value) {
    if (!value) {
        return "";
    }

    return dateFormatter.format(value);
}

function formatDateDisplay(value) {
    if (!value) {
        return "";
    }

    return dateDisplayFormatter.format(value);
}

function formatReportDateRange(startValue, endValueExclusive) {
    const start = startValue instanceof Date ? new Date(startValue.getTime()) : normalizeDateOnly(startValue);
    const endExclusive = endValueExclusive instanceof Date
        ? new Date(endValueExclusive.getTime())
        : normalizeDateOnly(endValueExclusive);

    if (!start || !endExclusive) {
        return "";
    }

    const inclusiveEnd = new Date(endExclusive.getTime());
    inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);

    return `${formatDateDisplay(start)} to ${formatDateDisplay(inclusiveEnd)}`;
}

function escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPaginationParams(query = {}) {
    const allowedLimits = [20, 50];
    const requestedLimit = Number(query.limit);
    const limit = allowedLimits.includes(requestedLimit) ? requestedLimit : 20;
    const requestedPage = Number(query.page);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
}

function buildPagination(totalRecords, page, limit) {
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    const currentPage = Math.min(page, totalPages);

    return {
        page: currentPage,
        limit,
        totalRecords,
        totalPages,
        hasPreviousPage: currentPage > 1,
        hasNextPage: currentPage < totalPages,
        previousPage: currentPage > 1 ? currentPage - 1 : 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : totalPages
    };
}

const ACTIVE_FILTER = { deletedAt: null };

function getFridayWeekStart(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : normalizeDateOnly(value);

    if (!date) {
        return null;
    }

    const start = new Date(date.getTime());
    const day = start.getUTCDay();
    const diffToFriday = (day - 5 + 7) % 7;
    start.setUTCDate(start.getUTCDate() - diffToFriday);
    start.setUTCHours(0, 0, 0, 0);
    return start;
}

function buildDiary2SalaryTotals(weekSummary) {
    const getHawariAmount = (person) => (
        ((weekSummary.hawariTotals.tractor[person] || 0) * 30)
        + ((weekSummary.hawariTotals.dumper[person] || 0) * 40)
    );

    const salaryTotals = {
        mukadam: (weekSummary.rawalTotal * 280) + (weekSummary.dabar * 260),
        piraji: (weekSummary.loaderTractor * 15)
            + (weekSummary.loaderDumper * 30)
            + (weekSummary.tractorTrip * 50)
            + getHawariAmount("piraji"),
        ranga: getHawariAmount("ranga"),
        dada: (weekSummary.dalni * 100) + getHawariAmount("dada"),
        rama: getHawariAmount("rama"),
        hole: weekSummary.holes * 200
    };

    salaryTotals.totalToGive = salaryTotals.mukadam
        + salaryTotals.piraji
        + salaryTotals.ranga
        + salaryTotals.dada
        + salaryTotals.rama
        + salaryTotals.hole;

    return salaryTotals;
}

function buildDiary2ExpenseTotals(summary, salaryTotals = buildDiary2SalaryTotals(summary)) {
    const dieselExpense = summary.dieselExpense || 0;
    const maintenanceExpense = summary.maintenanceExpense || 0;
    const otherExpense = summary.otherExpense || 0;

    return {
        salary: salaryTotals.totalToGive || 0,
        diesel: dieselExpense,
        maintenance: maintenanceExpense,
        other: otherExpense,
        totalExpense: (salaryTotals.totalToGive || 0) + dieselExpense + maintenanceExpense + otherExpense
    };
}

function buildDiary1IncomeMaps(entries) {
    const incomeByDate = new Map();
    const incomeByWeek = new Map();

    entries.forEach((entry) => {
        if (!entry.entryDate) {
            return;
        }

        const dateKey = formatDateInput(entry.entryDate);
        const weekStart = getFridayWeekStart(entry.entryDate);
        const weekKey = weekStart ? formatDateInput(weekStart) : "";
        const total = entry.total || 0;

        incomeByDate.set(dateKey, (incomeByDate.get(dateKey) || 0) + total);

        if (weekKey) {
            incomeByWeek.set(weekKey, (incomeByWeek.get(weekKey) || 0) + total);
        }
    });

    return { incomeByDate, incomeByWeek };
}

function buildDiary2WeeklySummaries(entries, diary1IncomeByWeek = new Map()) {
    const weeklyMap = new Map();

    entries.forEach((entry) => {
        const weekStart = getFridayWeekStart(entry.entryDate);

        if (!weekStart) {
            return;
        }

        const weekKey = formatDateInput(weekStart);

        if (!weeklyMap.has(weekKey)) {
            const weekEnd = new Date(weekStart.getTime());
            weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

            weeklyMap.set(weekKey, {
                weekKey,
                weekStart,
                weekEnd,
                weekLabel: formatReportDateRange(weekStart, weekEnd),
                entryCount: 0,
                rawalForMachine: 0,
                rawalForOutside: 0,
                dalni: 0,
                dabar: 0,
                loaderQty: 0,
                loaderTractor: 0,
                loaderDumper: 0,
                holes: 0,
                tractorTrip: 0,
                salaryPaidToPiraji: 0,
                dieselExpense: 0,
                maintenanceExpense: 0,
                otherExpense: 0,
                tractorHawari: 0,
                dumperHawari: 0,
                rawalTotal: 0,
                hawariTotals: {
                    tractor: {
                        ranga: 0,
                        piraji: 0,
                        dada: 0,
                        rama: 0,
                        other: 0
                    },
                    dumper: {
                        ranga: 0,
                        piraji: 0,
                        dada: 0,
                        rama: 0,
                        other: 0
                    }
                },
                salaryTotals: {
                    mukadam: 0,
                    piraji: 0,
                    ranga: 0,
                    dada: 0,
                    rama: 0,
                    hole: 0,
                    totalToGive: 0
                },
                expenseTotals: {
                    salary: 0,
                    diesel: 0,
                    maintenance: 0,
                    other: 0,
                    totalExpense: 0
                },
                incomeTotal: diary1IncomeByWeek.get(weekKey) || 0
            });
        }

        const weekSummary = weeklyMap.get(weekKey);
        const tractorHawari = (entry.tractorHawari?.ranga || 0)
            + (entry.tractorHawari?.piraji || 0)
            + (entry.tractorHawari?.dada || 0)
            + (entry.tractorHawari?.rama || 0)
            + (entry.tractorHawari?.other || 0);
        const dumperHawari = (entry.dumperHawari?.ranga || 0)
            + (entry.dumperHawari?.piraji || 0)
            + (entry.dumperHawari?.dada || 0)
            + (entry.dumperHawari?.rama || 0)
            + (entry.dumperHawari?.other || 0);

        weekSummary.entryCount += 1;
        weekSummary.rawalForMachine += entry.rawalForMachine || 0;
        weekSummary.rawalForOutside += entry.rawalForOutside || 0;
        weekSummary.rawalTotal += (entry.rawalForMachine || 0) + (entry.rawalForOutside || 0);
        weekSummary.dalni += entry.dalni || 0;
        weekSummary.dabar += entry.dabar || 0;
        const loaderTractor = entry.loaderTractor ?? entry.loaderQty ?? 0;
        const loaderDumper = entry.loaderDumper ?? 0;

        weekSummary.loaderQty += (entry.loaderQty ?? (loaderTractor + loaderDumper)) || 0;
        weekSummary.loaderTractor += loaderTractor;
        weekSummary.loaderDumper += loaderDumper;
        weekSummary.holes += entry.holes || 0;
        weekSummary.tractorTrip += entry.tractorTrip || 0;
        weekSummary.salaryPaidToPiraji += entry.salaryPaidToPiraji || 0;
        weekSummary.dieselExpense += entry.dieselExpense || 0;
        weekSummary.maintenanceExpense += entry.maintenanceExpense || 0;
        weekSummary.otherExpense += entry.otherExpense || 0;
        weekSummary.tractorHawari += tractorHawari;
        weekSummary.dumperHawari += dumperHawari;
        weekSummary.hawariTotals.tractor.ranga += entry.tractorHawari?.ranga || 0;
        weekSummary.hawariTotals.tractor.piraji += entry.tractorHawari?.piraji || 0;
        weekSummary.hawariTotals.tractor.dada += entry.tractorHawari?.dada || 0;
        weekSummary.hawariTotals.tractor.rama += entry.tractorHawari?.rama || 0;
        weekSummary.hawariTotals.tractor.other += entry.tractorHawari?.other || 0;
        weekSummary.hawariTotals.dumper.ranga += entry.dumperHawari?.ranga || 0;
        weekSummary.hawariTotals.dumper.piraji += entry.dumperHawari?.piraji || 0;
        weekSummary.hawariTotals.dumper.dada += entry.dumperHawari?.dada || 0;
        weekSummary.hawariTotals.dumper.rama += entry.dumperHawari?.rama || 0;
        weekSummary.hawariTotals.dumper.other += entry.dumperHawari?.other || 0;
        weekSummary.salaryTotals = buildDiary2SalaryTotals(weekSummary);
        weekSummary.expenseTotals = buildDiary2ExpenseTotals(weekSummary, weekSummary.salaryTotals);
    });

    return Array.from(weeklyMap.values()).sort((a, b) => b.weekStart - a.weekStart);
}

function getDiary2WeeklyReportData(entries, selectedWeekKey, diary1IncomeByWeek = new Map()) {
    const weeklyDiary2 = buildDiary2WeeklySummaries(entries, diary1IncomeByWeek);
    const selectedWeekIndex = Math.max(
        weeklyDiary2.findIndex((week) => week.weekKey === selectedWeekKey),
        0
    );

    return {
        weeklyDiary2,
        selectedDiary2WeekKey: weeklyDiary2[selectedWeekIndex]?.weekKey || "",
        activeDiary2Week: weeklyDiary2[selectedWeekIndex] || null,
        newerDiary2Week: selectedWeekIndex > 0 ? weeklyDiary2[selectedWeekIndex - 1] : null,
        olderDiary2Week: selectedWeekIndex >= 0 && selectedWeekIndex < weeklyDiary2.length - 1
            ? weeklyDiary2[selectedWeekIndex + 1]
            : null
    };
}

function getDiary1FormData(entry = {}) {
    return {
        today: entry.entryDate ? formatDateInput(entry.entryDate) : formatDateInput(new Date()),
        values: {
            name: entry.name || "",
            city: entry.city || "",
            vehicleType: entry.vehicleType || "Tractor",
            quantity: entry.quantity ?? "",
            rate: entry.rate ?? "",
            paymentStatus: entry.paymentStatus || "Unpaid",
            paidAmount: entry.paidAmount ?? ""
        }
    };
}

function getDiary2FormData(entry = {}) {
    return {
        today: entry.entryDate ? formatDateInput(entry.entryDate) : formatDateInput(new Date()),
        values: {
            rawalForMachine: entry.rawalForMachine ?? 0,
            rawalForOutside: entry.rawalForOutside ?? 0,
            dabar: entry.dabar ?? 0,
            dalni: entry.dalni ?? 0,
            tractorHawari: {
                ranga: entry.tractorHawari?.ranga ?? 0,
                piraji: entry.tractorHawari?.piraji ?? 0,
                dada: entry.tractorHawari?.dada ?? 0,
                rama: entry.tractorHawari?.rama ?? 0,
                other: entry.tractorHawari?.other ?? 0
            },
            dumperHawari: {
                ranga: entry.dumperHawari?.ranga ?? 0,
                piraji: entry.dumperHawari?.piraji ?? 0,
                dada: entry.dumperHawari?.dada ?? 0,
                rama: entry.dumperHawari?.rama ?? 0,
                other: entry.dumperHawari?.other ?? 0
            },
            holes: entry.holes ?? 0,
            loaderTractor: entry.loaderTractor ?? entry.loaderQty ?? 0,
            loaderDumper: entry.loaderDumper ?? 0,
            tractorTrip: entry.tractorTrip ?? 0,
            salaryPaidToPiraji: entry.salaryPaidToPiraji ?? 0,
            dieselExpense: entry.dieselExpense ?? 0,
            maintenanceExpense: entry.maintenanceExpense ?? 0,
            otherExpense: entry.otherExpense ?? 0
        }
    };
}

async function getDashboardData(selectedWeekKey, unpaidPage, unpaidLimit) {
    const diary1Count = await Diary1.countDocuments(ACTIVE_FILTER);
    const diary2Count = await Diary2.countDocuments(ACTIVE_FILTER);

    const diary1Totals = await Diary1.aggregate([
        {
            $match: ACTIVE_FILTER
        },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: "$total" },
                totalQuantity: { $sum: "$quantity" }
            }
        }
    ]);

    const pendingDiary1Filter = {
        ...ACTIVE_FILTER,
        $expr: { $lt: ["$paidAmount", "$total"] }
    };
    const pendingDiary1TotalRecords = await Diary1.countDocuments(pendingDiary1Filter);
    const pendingDiary1Pagination = buildPagination(pendingDiary1TotalRecords, unpaidPage, unpaidLimit);
    const pendingDiary1 = await Diary1.find(pendingDiary1Filter)
        .sort({ entryDate: -1, createdAt: -1 })
        .skip((pendingDiary1Pagination.page - 1) * pendingDiary1Pagination.limit)
        .limit(pendingDiary1Pagination.limit);
    const allDiary1 = await Diary1.find(ACTIVE_FILTER).sort({ entryDate: -1, createdAt: -1 });
    const allDiary2 = await Diary2.find(ACTIVE_FILTER).sort({ entryDate: -1, createdAt: -1 });
    const { incomeByWeek } = buildDiary1IncomeMaps(allDiary1);
    const weeklyReport = getDiary2WeeklyReportData(allDiary2, selectedWeekKey, incomeByWeek);

    return {
        counts: {
            diary1: diary1Count,
            diary2: diary2Count
        },
        totals: diary1Totals[0] || { totalAmount: 0, totalQuantity: 0 },
        pendingDiary1,
        pendingDiary1Pagination,
        ...weeklyReport
    };
}

mongoose.connect(MONGO_URL)
    .then(() => console.log("DB Connected"))
    .catch((error) => console.log("MongoDB connection error:", error.message));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

if (isProduction) {
    app.set("trust proxy", 1);
}

app.use(session({
    name: "crusher.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    store: MongoStore.create({
        mongoUrl: MONGO_URL,
        collectionName: "sessions",
        ttl: 14 * 24 * 60 * 60,
        autoRemove: "native",
        crypto: {
            secret: SESSION_SECRET
        }
    }),
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 14 * 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.isVerified ? { role: "admin" } : null;
    res.locals.formatDateInput = formatDateInput;
    res.locals.formatDateDisplay = formatDateDisplay;
    res.locals.getDayName = getDayName;
    next();
});

function isLoggedIn(req, res, next) {
    if (req.session.isVerified) {
        return next();
    }

    return res.redirect("/login");
}

app.get("/", (req, res) => {
    if (req.session.isVerified) {
        return res.redirect("/dashboard");
    }

    return res.redirect("/login");
});

app.get("/login", (req, res) => {
    if (req.session.isVerified) {
        return res.redirect("/dashboard");
    }

    return res.render("login", { error: req.query.error });
});

app.post("/login", (req, res) => {
    if (req.body.pin === ACCESS_PIN) {
        req.session.isVerified = true;
        return res.redirect("/dashboard");
    }

    return res.redirect("/login?error=1");
});

app.get("/dashboard", isLoggedIn, async (req, res) => {
    const { page: unpaidPage, limit: unpaidLimit } = getPaginationParams({
        page: req.query.unpaidPage,
        limit: req.query.unpaidLimit
    });
    const dashboardData = await getDashboardData(req.query.week, unpaidPage, unpaidLimit);
    res.render("dashboard", dashboardData);
});

app.get("/trash", isLoggedIn, async (req, res) => {
    const [deletedDiary1, deletedDiary2] = await Promise.all([
        Diary1.find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1, entryDate: -1 }),
        Diary2.find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1, entryDate: -1 })
    ]);

    res.render("trash", {
        deletedDiary1,
        deletedDiary2,
        error: req.query.error
    });
});

app.get("/diary1", isLoggedIn, async (req, res) => {
    const searchTerm = (req.query.name || "").trim();
    const filters = { ...ACTIVE_FILTER };
    const { page, limit } = getPaginationParams(req.query);

    if (searchTerm) {
        filters.name = { $regex: escapeRegex(searchTerm), $options: "i" };
    }

    const totalRecords = await Diary1.countDocuments(filters);
    const pagination = buildPagination(totalRecords, page, limit);
    const data = await Diary1.find(filters)
        .sort({ entryDate: -1, createdAt: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit);

    res.render("diary1/index", {
        data,
        searchTerm,
        pagination
    });
});

app.get("/diary1/new", isLoggedIn, (req, res) => {
    res.render("diary1/new", getDiary1FormData());
});

app.post("/diary1", isLoggedIn, async (req, res) => {
    const {
        entryDate,
        name,
        city,
        vehicleType,
        quantity,
        rate,
        paymentStatus,
        paidAmount
    } = req.body;

    const normalizedDate = normalizeDateOnly(entryDate);

    await Diary1.create({
        entryDate: normalizedDate,
        day: getDayName(normalizedDate),
        name,
        city,
        vehicleType,
        quantity: Number(quantity) || 0,
        rate: Number(rate) || 0,
        paymentStatus,
        paidAmount: Number(paidAmount) || 0
    });

    res.redirect("/diary1");
});

app.get("/diary1/:id/edit", isLoggedIn, async (req, res) => {
    const entry = await Diary1.findOne({ _id: req.params.id, ...ACTIVE_FILTER });

    if (!entry) {
        return res.redirect("/diary1");
    }

    return res.render("diary1/edit", {
        entry,
        ...getDiary1FormData(entry)
    });
});

app.put("/diary1/:id", isLoggedIn, async (req, res) => {
    const {
        entryDate,
        name,
        city,
        vehicleType,
        quantity,
        rate,
        paymentStatus,
        paidAmount
    } = req.body;

    const normalizedDate = normalizeDateOnly(entryDate);

    const entry = await Diary1.findOne({ _id: req.params.id, ...ACTIVE_FILTER });

    if (!entry) {
        return res.redirect("/diary1");
    }

    entry.entryDate = normalizedDate;
    entry.day = getDayName(normalizedDate);
    entry.name = name;
    entry.city = city;
    entry.vehicleType = vehicleType;
    entry.quantity = Number(quantity) || 0;
    entry.rate = Number(rate) || 0;
    entry.paymentStatus = paymentStatus;
    entry.paidAmount = Number(paidAmount) || 0;

    await entry.save();

    return res.redirect("/diary1");
});

app.post("/diary1/:id/payment", isLoggedIn, async (req, res) => {
    const entry = await Diary1.findOne({ _id: req.params.id, ...ACTIVE_FILTER });

    if (!entry) {
        return res.status(404).json({ ok: false });
    }

    const requestedPaidAmount = Number(req.body.paidAmount);
    const normalizedPaidAmount = Number.isFinite(requestedPaidAmount)
        ? Math.max(0, Math.min(requestedPaidAmount, entry.total || 0))
        : 0;

    entry.paidAmount = normalizedPaidAmount;

    if (normalizedPaidAmount <= 0) {
        entry.paymentStatus = "Unpaid";
    } else if (normalizedPaidAmount >= (entry.total || 0)) {
        entry.paymentStatus = "Paid";
    } else {
        entry.paymentStatus = "Partial";
    }

    await entry.save();

    return res.json({
        ok: true,
        paidAmount: entry.paidAmount,
        paymentStatus: entry.paymentStatus,
        total: entry.total
    });
});

app.delete("/diary1/:id", isLoggedIn, async (req, res) => {
    await Diary1.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
    res.redirect("/diary1");
});

app.post("/diary1/:id/restore", isLoggedIn, async (req, res) => {
    await Diary1.findByIdAndUpdate(req.params.id, { deletedAt: null });
    res.redirect("/trash");
});

app.delete("/diary1/:id/permanent", isLoggedIn, async (req, res) => {
    await Diary1.findOneAndDelete({ _id: req.params.id, deletedAt: { $ne: null } });
    res.redirect("/trash");
});

app.delete("/trash/diary1", isLoggedIn, async (req, res) => {
    await Diary1.deleteMany({ deletedAt: { $ne: null } });
    res.redirect("/trash");
});

app.get("/diary2", isLoggedIn, async (req, res) => {
    const { page, limit } = getPaginationParams(req.query);
    const totalRecords = await Diary2.countDocuments(ACTIVE_FILTER);
    const pagination = buildPagination(totalRecords, page, limit);
    const data = await Diary2.find(ACTIVE_FILTER)
        .sort({ entryDate: -1, createdAt: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit);
    const diary1Entries = await Diary1.find(ACTIVE_FILTER).sort({ entryDate: -1, createdAt: -1 });
    const { incomeByDate } = buildDiary1IncomeMaps(diary1Entries);

    const dataWithIncome = data.map((entry) => {
        const entryObject = entry.toObject();
        const salaryTotals = buildDiary2SalaryTotals({
            rawalTotal: (entryObject.rawalForMachine || 0) + (entryObject.rawalForOutside || 0),
            dabar: entryObject.dabar || 0,
            loaderTractor: entryObject.loaderTractor ?? entryObject.loaderQty ?? 0,
            loaderDumper: entryObject.loaderDumper ?? 0,
            tractorTrip: entryObject.tractorTrip || 0,
            dalni: entryObject.dalni || 0,
            holes: entryObject.holes || 0,
            hawariTotals: {
                tractor: {
                    ranga: entryObject.tractorHawari?.ranga || 0,
                    piraji: entryObject.tractorHawari?.piraji || 0,
                    dada: entryObject.tractorHawari?.dada || 0,
                    rama: entryObject.tractorHawari?.rama || 0,
                    other: entryObject.tractorHawari?.other || 0
                },
                dumper: {
                    ranga: entryObject.dumperHawari?.ranga || 0,
                    piraji: entryObject.dumperHawari?.piraji || 0,
                    dada: entryObject.dumperHawari?.dada || 0,
                    rama: entryObject.dumperHawari?.rama || 0,
                    other: entryObject.dumperHawari?.other || 0
                }
            }
        });

        return {
            ...entryObject,
            salaryTotals,
            expenseTotals: buildDiary2ExpenseTotals(entryObject, salaryTotals),
            incomeTotal: incomeByDate.get(formatDateInput(entry.entryDate)) || 0
        };
    });

    res.render("diary2/index", {
        data: dataWithIncome,
        pagination
    });
});

app.get("/diary2/weekly-report", isLoggedIn, async (req, res) => {
    const allDiary1 = await Diary1.find(ACTIVE_FILTER).sort({ entryDate: -1, createdAt: -1 });
    const allDiary2 = await Diary2.find(ACTIVE_FILTER).sort({ entryDate: -1, createdAt: -1 });
    const { incomeByWeek } = buildDiary1IncomeMaps(allDiary1);
    res.render("diary2/weekly-report", getDiary2WeeklyReportData(allDiary2, req.query.week, incomeByWeek));
});

app.get("/diary2/new", isLoggedIn, async (req, res) => {
    res.render("diary2/new", getDiary2FormData());
});

app.get("/diary2/:id/edit", isLoggedIn, async (req, res) => {
    const entry = await Diary2.findOne({ _id: req.params.id, ...ACTIVE_FILTER });

    if (!entry) {
        return res.redirect("/diary2");
    }

    return res.render("diary2/edit", {
        entry,
        ...getDiary2FormData(entry)
    });
});

app.post("/diary2", isLoggedIn, async (req, res) => {
    const {
        entryDate,
        rawalForMachine,
        rawalForOutside,
        dabar,
        tractorRanga,
        tractorPiraji,
        tractorDada,
        tractorRama,
        tractorOther,
        dumperRanga,
        dumperPiraji,
        dumperDada,
        dumperRama,
        dumperOther,
        holes,
        loaderTractor,
        loaderDumper,
        tractorTrip,
        salaryPaidToPiraji,
        dieselExpense,
        maintenanceExpense,
        otherExpense
    } = req.body;

    const normalizedDate = normalizeDateOnly(entryDate);
    const existingEntry = await Diary2.findOne({ entryDate: normalizedDate, ...ACTIVE_FILTER });

    const normalizedLoaderTractor = Number(loaderTractor) || 0;
    const normalizedLoaderDumper = Number(loaderDumper) || 0;

    const payload = {
        entryDate: normalizedDate,
        day: getDayName(normalizedDate),
        rawalForMachine: Number(rawalForMachine) || 0,
        rawalForOutside: Number(rawalForOutside) || 0,
        dabar: Number(dabar) || 0,
        dalni: Number(rawalForMachine) || 0,
        tractorHawari: {
            ranga: Number(tractorRanga) || 0,
            piraji: Number(tractorPiraji) || 0,
            dada: Number(tractorDada) || 0,
            rama: Number(tractorRama) || 0,
            other: Number(tractorOther) || 0
        },
        dumperHawari: {
            ranga: Number(dumperRanga) || 0,
            piraji: Number(dumperPiraji) || 0,
            dada: Number(dumperDada) || 0,
            rama: Number(dumperRama) || 0,
            other: Number(dumperOther) || 0
        },
        holes: Number(holes) || 0,
        loaderQty: normalizedLoaderTractor + normalizedLoaderDumper,
        loaderTractor: normalizedLoaderTractor,
        loaderDumper: normalizedLoaderDumper,
        tractorTrip: Number(tractorTrip) || 0,
        salaryPaidToPiraji: Number(salaryPaidToPiraji) || 0,
        dieselExpense: Number(dieselExpense) || 0,
        maintenanceExpense: Number(maintenanceExpense) || 0,
        otherExpense: Number(otherExpense) || 0
    };

    if (existingEntry) {
        existingEntry.set(payload);
        await existingEntry.save();
    } else {
        await Diary2.create(payload);
    }

    res.redirect("/diary2");
});

app.put("/diary2/:id", isLoggedIn, async (req, res) => {
    const {
        entryDate,
        rawalForMachine,
        rawalForOutside,
        dabar,
        tractorRanga,
        tractorPiraji,
        tractorDada,
        tractorRama,
        tractorOther,
        dumperRanga,
        dumperPiraji,
        dumperDada,
        dumperRama,
        dumperOther,
        holes,
        loaderTractor,
        loaderDumper,
        tractorTrip,
        salaryPaidToPiraji,
        dieselExpense,
        maintenanceExpense,
        otherExpense
    } = req.body;

    const entry = await Diary2.findOne({ _id: req.params.id, ...ACTIVE_FILTER });

    if (!entry) {
        return res.redirect("/diary2");
    }

    const normalizedDate = normalizeDateOnly(entryDate);

    entry.entryDate = normalizedDate;
    entry.day = getDayName(normalizedDate);
    entry.rawalForMachine = Number(rawalForMachine) || 0;
    entry.rawalForOutside = Number(rawalForOutside) || 0;
    entry.dabar = Number(dabar) || 0;
    entry.dalni = Number(rawalForMachine) || 0;
    entry.tractorHawari = {
        ranga: Number(tractorRanga) || 0,
        piraji: Number(tractorPiraji) || 0,
        dada: Number(tractorDada) || 0,
        rama: Number(tractorRama) || 0,
        other: Number(tractorOther) || 0
    };
    entry.dumperHawari = {
        ranga: Number(dumperRanga) || 0,
        piraji: Number(dumperPiraji) || 0,
        dada: Number(dumperDada) || 0,
        rama: Number(dumperRama) || 0,
        other: Number(dumperOther) || 0
    };
    entry.holes = Number(holes) || 0;
    entry.loaderTractor = Number(loaderTractor) || 0;
    entry.loaderDumper = Number(loaderDumper) || 0;
    entry.loaderQty = entry.loaderTractor + entry.loaderDumper;
    entry.tractorTrip = Number(tractorTrip) || 0;
    entry.salaryPaidToPiraji = Number(salaryPaidToPiraji) || 0;
    entry.dieselExpense = Number(dieselExpense) || 0;
    entry.maintenanceExpense = Number(maintenanceExpense) || 0;
    entry.otherExpense = Number(otherExpense) || 0;

    await entry.save();

    return res.redirect("/diary2");
});

app.delete("/diary2/:id", isLoggedIn, async (req, res) => {
    await Diary2.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
    res.redirect("/diary2");
});

app.post("/diary2/:id/restore", isLoggedIn, async (req, res) => {
    const entry = await Diary2.findById(req.params.id);

    if (!entry) {
        return res.redirect("/trash");
    }

    const existingActiveEntry = await Diary2.findOne({
        _id: { $ne: entry._id },
        entryDate: entry.entryDate,
        ...ACTIVE_FILTER
    });

    if (existingActiveEntry) {
        return res.redirect("/trash?error=diary2-duplicate");
    }

    await Diary2.findByIdAndUpdate(req.params.id, { deletedAt: null });
    res.redirect("/trash");
});

app.delete("/diary2/:id/permanent", isLoggedIn, async (req, res) => {
    await Diary2.findOneAndDelete({ _id: req.params.id, deletedAt: { $ne: null } });
    res.redirect("/trash");
});

app.delete("/trash/diary2", isLoggedIn, async (req, res) => {
    await Diary2.deleteMany({ deletedAt: { $ne: null } });
    res.redirect("/trash");
});

app.get("/logout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        return res.redirect("/login");
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
