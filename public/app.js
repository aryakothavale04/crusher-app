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
    const diary2Form = document.querySelector("#diary2-form");
    const dalniOutput = document.querySelector("#dalni-output");

    const syncDalni = () => {
        dalniOutput.value = rawalForMachineInput.value || "0";
    };

    const numericInputs = diary2Form
        ? Array.from(diary2Form.querySelectorAll('input[type="number"]:not([readonly])'))
        : [];

    const selectZeroValue = (event) => {
        if (event.target.value === "0") {
            event.target.select();
        }
    };

    const replaceZeroOnType = (event) => {
        const { target, key, ctrlKey, metaKey, altKey } = event;

        if (ctrlKey || metaKey || altKey || target.value !== "0") {
            return;
        }

        if (/^[0-9]$/.test(key)) {
            event.preventDefault();
            target.value = key;
            target.dispatchEvent(new Event("input", { bubbles: true }));
            return;
        }

        if (key === "Backspace" || key === "Delete") {
            event.preventDefault();
            target.value = "";
            target.dispatchEvent(new Event("input", { bubbles: true }));
        }
    };

    numericInputs.forEach((input) => {
        input.addEventListener("focus", selectZeroValue);
        input.addEventListener("click", selectZeroValue);
        input.addEventListener("keydown", replaceZeroOnType);
    });

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

const mutatingForms = Array.from(document.querySelectorAll("form"))
    .filter((form) => (form.getAttribute("method") || "GET").toUpperCase() !== "GET");

mutatingForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
        if (form.dataset.submitting === "true") {
            event.preventDefault();
            return;
        }

        form.dataset.submitting = "true";

        const submitButtons = Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'));

        submitButtons.forEach((button) => {
            if (!button.dataset.originalLabel) {
                button.dataset.originalLabel = button.tagName === "INPUT" ? button.value : button.textContent.trim();
            }

            button.disabled = true;

            if (button.tagName === "INPUT") {
                button.value = "Processing...";
            } else {
                button.textContent = "Processing...";
            }
        });
    });
});

const weekPickerTriggers = Array.from(document.querySelectorAll("[data-week-picker-open]"));

weekPickerTriggers.forEach((trigger) => {
    const dialogId = trigger.getAttribute("data-week-picker-open");
    const dialog = dialogId ? document.getElementById(dialogId) : null;

    if (!dialog) {
        return;
    }

    trigger.addEventListener("click", () => {
        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        }
    });

    dialog.addEventListener("click", (event) => {
        const rect = dialog.getBoundingClientRect();
        const isInside =
            event.clientX >= rect.left
            && event.clientX <= rect.right
            && event.clientY >= rect.top
            && event.clientY <= rect.bottom;

        if (!isInside) {
            dialog.close();
        }
    });
});

const weekPickerCloseButtons = Array.from(document.querySelectorAll("[data-week-picker-close]"));

weekPickerCloseButtons.forEach((button) => {
    const dialogId = button.getAttribute("data-week-picker-close");
    const dialog = dialogId ? document.getElementById(dialogId) : null;

    if (!dialog) {
        return;
    }

    button.addEventListener("click", () => {
        dialog.close();
    });
});

const quickPayTriggers = Array.from(document.querySelectorAll(".quick-pay-trigger"));

quickPayTriggers.forEach((trigger) => {
    trigger.addEventListener("click", async () => {
        const entryId = trigger.dataset.entryId;
        const entryName = trigger.dataset.entryName || "entry";
        const total = Number(trigger.dataset.total) || 0;
        const currentPaidAmount = Number(trigger.dataset.paidAmount) || 0;
        const nextValue = window.prompt(
            `Enter the amount paid by ${entryName}. Total amount: ${total}.`,
            currentPaidAmount ? currentPaidAmount.toString() : ""
        );

        if (nextValue === null) {
            return;
        }

        const paidAmount = Number(nextValue);

        if (!Number.isFinite(paidAmount) || paidAmount < 0) {
            window.alert("Please enter a valid paid amount.");
            return;
        }

        trigger.disabled = true;

        try {
            const response = await fetch(`/diary1/${entryId}/payment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json"
                },
                body: new URLSearchParams({
                    paidAmount: paidAmount.toString()
                })
            });

            if (!response.ok) {
                throw new Error("Request failed");
            }

            window.location.reload();
        } catch (error) {
            window.alert("Could not update the payment right now.");
            trigger.disabled = false;
        }
    });
});
