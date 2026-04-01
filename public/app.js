const diary1Form = document.querySelector("#diary1-form");

if (diary1Form) {
    const quantityInput = diary1Form.querySelector('input[name="quantity"]');
    const rateInput = diary1Form.querySelector('input[name="rate"]');
    const totalOutput = document.querySelector("#diary1-total");
    const paymentStatusInput = diary1Form.querySelector("#payment-status");
    const paidAmountField = diary1Form.querySelector("#paid-amount-field");
    const paidAmountInput = diary1Form.querySelector("#paid-amount-input");

    const updateTotal = () => {
        const quantity = Number(quantityInput.value) || 0;
        const rate = Number(rateInput.value) || 0;
        const total = quantity * rate;
        totalOutput.textContent = total.toFixed(2);

        if (!paymentStatusInput) {
            return;
        }

        if (paymentStatusInput.value === "Paid") {
            paidAmountInput.value = total ? total.toFixed(2) : "";
        } else if (paymentStatusInput.value === "Unpaid") {
            paidAmountInput.value = "";
        }
    };

    const syncPaymentField = () => {
        if (!paymentStatusInput) {
            return;
        }

        const status = paymentStatusInput.value;
        const shouldShowAmount = status === "Partial" || status === "Paid";

        paidAmountField.hidden = !shouldShowAmount;
        paidAmountInput.required = status === "Partial";

        if (status === "Paid") {
            const total = (Number(quantityInput.value) || 0) * (Number(rateInput.value) || 0);
            paidAmountInput.value = total ? total.toFixed(2) : "";
            paidAmountInput.readOnly = true;
        } else {
            paidAmountInput.readOnly = false;
            if (status === "Unpaid") {
                paidAmountInput.value = "";
            }
        }
    };

    quantityInput.addEventListener("input", updateTotal);
    rateInput.addEventListener("input", updateTotal);
    if (paymentStatusInput) {
        paymentStatusInput.addEventListener("change", syncPaymentField);
    }
    updateTotal();
    syncPaymentField();
}

const rawalForMachineInput = document.querySelector("#rawal-for-machine");

if (rawalForMachineInput) {
    const dalniOutput = document.querySelector("#dalni-output");

    const syncDalni = () => {
        dalniOutput.value = rawalForMachineInput.value || "0";
    };

    rawalForMachineInput.addEventListener("input", syncDalni);
    syncDalni();
}

const topbar = document.querySelector(".topbar");
const navToggle = document.querySelector(".nav-toggle");

if (topbar && navToggle) {
    const syncNavState = (isOpen) => {
        topbar.classList.toggle("nav-open", isOpen);
        navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        navToggle.textContent = isOpen ? "Close" : "Menu";
    };

    syncNavState(false);

    navToggle.addEventListener("click", () => {
        syncNavState(!topbar.classList.contains("nav-open"));
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 720) {
            syncNavState(false);
        }
    });
}
