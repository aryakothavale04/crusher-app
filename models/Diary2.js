const mongoose = require("mongoose");

const hawariBreakdownSchema = new mongoose.Schema({
    ranga: {
        type: Number,
        default: 0,
        min: 0
    },
    piraji: {
        type: Number,
        default: 0,
        min: 0
    },
    dada: {
        type: Number,
        default: 0,
        min: 0
    },
    rama: {
        type: Number,
        default: 0,
        min: 0
    },
    other: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: false });

const diary2Schema = new mongoose.Schema({
    entryDate: {
        type: Date,
        required: true
    },
    day: {
        type: String,
        required: true,
        trim: true
    },
    rawalForMachine: {
        type: Number,
        required: true,
        min: 0
    },
    rawalForOutside: {
        type: Number,
        required: true,
        min: 0
    },
    dabar: {
        type: Number,
        required: true,
        min: 0
    },
    dalni: {
        type: Number,
        required: true,
        min: 0
    },
    tractorHawari: {
        type: hawariBreakdownSchema,
        default: () => ({})
    },
    dumperHawari: {
        type: hawariBreakdownSchema,
        default: () => ({})
    },
    holes: {
        type: Number,
        required: true,
        min: 0
    },
    loaderQty: {
        type: Number,
        required: true,
        min: 0
    },
    loaderTractor: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    loaderDumper: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    tractorTrip: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    salaryPaidToPiraji: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

diary2Schema.pre("validate", function syncDalni() {
    this.dalni = this.rawalForMachine || 0;
});

module.exports = mongoose.model("Diary2", diary2Schema);
