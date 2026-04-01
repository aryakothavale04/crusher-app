const mongoose = require("mongoose");

const diary1Schema = new mongoose.Schema({
    entryDate: {
        type: Date,
        required: true
    },
    day: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    vehicleType: {
        type: String,
        enum: ["Tractor", "Dumper"],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    hawariBy: {
        type: String,
        trim: true,
        default: ""
    },
    rate: {
        type: Number,
        required: true,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ["Paid", "Partial", "Unpaid"],
        default: "Unpaid",
        required: true
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        default: 0,
        min: 0
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

diary1Schema.pre("validate", function setTotal() {
    this.total = (this.quantity || 0) * (this.rate || 0);

    if (this.paymentStatus === "Paid") {
        this.paidAmount = this.total;
    } else if (this.paymentStatus === "Unpaid") {
        this.paidAmount = 0;
    } else {
        this.paidAmount = Math.min(this.paidAmount || 0, this.total);
    }
});

module.exports = mongoose.model("Diary1", diary1Schema);
