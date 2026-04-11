const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Diary1 = require("../models/Diary1");
const Diary2 = require("../models/Diary2");

const TARGET_CLUSTER_URL = "mongodb+srv://aryakothavale04:arya123@cluster0.zs59bje.mongodb.net/?appName=Cluster0";
const DEFAULT_MONGO_URL = TARGET_CLUSTER_URL;

function loadEnvFile(filename, overrideExisting = false) {
    const envPath = path.join(__dirname, "..", filename);

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

const mongoUrl = process.env.SEED_MONGO_URL || process.env.MONGO_URL || DEFAULT_MONGO_URL;

function utcDate(value) {
    return new Date(`${value}T00:00:00.000Z`);
}

const diary1Samples = [
    {
        entryDate: utcDate("2026-04-01"),
        day: "Wednesday",
        name: "Shivam Transport",
        city: "Kolhapur",
        vehicleType: "Tractor",
        quantity: 18,
        hawariBy: "Ranga",
        rate: 950,
        paymentStatus: "Paid"
    },
    {
        entryDate: utcDate("2026-04-02"),
        day: "Thursday",
        name: "Sai Earth Movers",
        city: "Sangli",
        vehicleType: "Dumper",
        quantity: 24,
        hawariBy: "Piraji",
        rate: 1200,
        paymentStatus: "Partial",
        paidAmount: 16000
    },
    {
        entryDate: utcDate("2026-04-03"),
        day: "Friday",
        name: "Om Logistics",
        city: "Karad",
        vehicleType: "Tractor",
        quantity: 15,
        hawariBy: "Dada",
        rate: 900,
        paymentStatus: "Unpaid"
    },
    {
        entryDate: utcDate("2026-04-04"),
        day: "Saturday",
        name: "Mahalaxmi Buildcon",
        city: "Satara",
        vehicleType: "Dumper",
        quantity: 28,
        hawariBy: "Rama",
        rate: 1250,
        paymentStatus: "Paid"
    },
    {
        entryDate: utcDate("2026-04-05"),
        day: "Sunday",
        name: "Patil Crusher Supply",
        city: "Miraj",
        vehicleType: "Tractor",
        quantity: 20,
        hawariBy: "Other",
        rate: 980,
        paymentStatus: "Partial",
        paidAmount: 9000
    },
    {
        entryDate: utcDate("2026-04-06"),
        day: "Monday",
        name: "Ganesh Construction",
        city: "Ichalkaranji",
        vehicleType: "Dumper",
        quantity: 22,
        hawariBy: "Ranga",
        rate: 1180,
        paymentStatus: "Unpaid"
    }
];

const diary2Samples = [
    {
        entryDate: utcDate("2026-04-01"),
        day: "Wednesday",
        rawalForMachine: 14,
        rawalForOutside: 6,
        dabar: 3,
        dalni: 14,
        tractorHawari: { ranga: 1200, piraji: 800, dada: 400, rama: 0, other: 200 },
        dumperHawari: { ranga: 1500, piraji: 700, dada: 500, rama: 0, other: 0 },
        holes: 5,
        loaderQty: 11,
        loaderTractor: 7,
        loaderDumper: 4,
        tractorTrip: 18,
        salaryPaidToPiraji: 1200,
        dieselExpense: 3200,
        maintenanceExpense: 900,
        otherExpense: 350
    },
    {
        entryDate: utcDate("2026-04-02"),
        day: "Thursday",
        rawalForMachine: 16,
        rawalForOutside: 8,
        dabar: 4,
        dalni: 16,
        tractorHawari: { ranga: 1000, piraji: 900, dada: 300, rama: 250, other: 0 },
        dumperHawari: { ranga: 1700, piraji: 650, dada: 450, rama: 300, other: 100 },
        holes: 4,
        loaderQty: 13,
        loaderTractor: 8,
        loaderDumper: 5,
        tractorTrip: 20,
        salaryPaidToPiraji: 1500,
        dieselExpense: 3400,
        maintenanceExpense: 1200,
        otherExpense: 500
    },
    {
        entryDate: utcDate("2026-04-03"),
        day: "Friday",
        rawalForMachine: 12,
        rawalForOutside: 5,
        dabar: 2,
        dalni: 12,
        tractorHawari: { ranga: 900, piraji: 700, dada: 350, rama: 100, other: 0 },
        dumperHawari: { ranga: 1400, piraji: 500, dada: 400, rama: 200, other: 0 },
        holes: 3,
        loaderQty: 10,
        loaderTractor: 6,
        loaderDumper: 4,
        tractorTrip: 16,
        salaryPaidToPiraji: 1000,
        dieselExpense: 2800,
        maintenanceExpense: 600,
        otherExpense: 250
    },
    {
        entryDate: utcDate("2026-04-04"),
        day: "Saturday",
        rawalForMachine: 18,
        rawalForOutside: 9,
        dabar: 5,
        dalni: 18,
        tractorHawari: { ranga: 1300, piraji: 850, dada: 500, rama: 200, other: 100 },
        dumperHawari: { ranga: 1900, piraji: 900, dada: 550, rama: 350, other: 150 },
        holes: 6,
        loaderQty: 15,
        loaderTractor: 9,
        loaderDumper: 6,
        tractorTrip: 22,
        salaryPaidToPiraji: 1800,
        dieselExpense: 3900,
        maintenanceExpense: 1500,
        otherExpense: 650
    }
];

async function seed() {
    if (mongoUrl !== TARGET_CLUSTER_URL) {
        throw new Error("Seed aborted: sample data can only be inserted into the specified Atlas cluster.");
    }

    await mongoose.connect(mongoUrl);

    const existingDiary1 = await Diary1.countDocuments();
    const existingDiary2 = await Diary2.countDocuments();

    if (existingDiary1 > 0 || existingDiary2 > 0) {
        await Promise.all([
            Diary1.deleteMany({}),
            Diary2.deleteMany({})
        ]);
        console.log(`Existing diary data cleared. Diary1: ${existingDiary1}, Diary2: ${existingDiary2}`);
    }

    await Diary1.insertMany(diary1Samples);
    await Diary2.insertMany(diary2Samples);

    console.log("Sample data inserted successfully.");
    console.log(`Diary1 inserted: ${diary1Samples.length}`);
    console.log(`Diary2 inserted: ${diary2Samples.length}`);
}

seed()
    .catch((error) => {
        console.error("Sample data seed failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close();
    });
