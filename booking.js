const form = document.querySelector("#appointment-form");
const serviceInput = document.querySelector("#service-input");
const staffInput = document.querySelector("#staff-input");
const staffIdInput = document.querySelector("#staff-id");
const serviceOptions = document.querySelector("#service-options");
const staffOptions = document.querySelector("#staff-options");
const dateInput = document.querySelector("#date-input");
const timeSlots = document.querySelector("#time-slots");
const selectedTime = document.querySelector("#selected-time");
const slotHelper = document.querySelector("#slot-helper");
const statusMessage = document.querySelector("#booking-status");
const confirmationPanel = document.querySelector("#confirmation-panel");
const confirmationCopy = document.querySelector("#confirmation-copy");
const summaryService = document.querySelector("#summary-service");
const summaryStaff = document.querySelector("#summary-staff");
const summaryDate = document.querySelector("#summary-date");
const summaryTime = document.querySelector("#summary-time");
const selectedDayHours = document.querySelector("#selected-day-hours");
const emailInput = form?.elements.email;
const phoneInput = form?.elements.phone;
const manageForm = document.querySelector("#manage-booking-form");
const manageFirstNameInput = manageForm?.elements.lookupFirstName;
const manageLastNameInput = manageForm?.elements.lookupLastName;
const managePhoneInput = manageForm?.elements.lookupPhone;
const manageResults = document.querySelector("#manage-results");
const manageStatus = document.querySelector("#manage-status");
const cancelModal = document.querySelector("#cancel-modal");
const cancelModalCopy = document.querySelector("#cancel-modal-copy");
const confirmCancelButton = document.querySelector("#confirm-cancel");
const keepAppointmentButton = document.querySelector("#keep-appointment");

const defaultServices = [
  "Manicure Gel",
  "Manicure Gel and Pedicure Gel",
  "Manicure Gel and Pedicure Regular",
  "Manicure Regular",
  "Pedicure and Manicure and Regular",
  "Pedicure Regular",
  "Pedicure with Gel Color",
  "Spa Pedicure Volcano",
  "Spa Pedicure with Gel Color"
].sort((a, b) => a.localeCompare(b));

const defaultStaff = [
  { id: "any", name: "Any available tech" },
  { id: "kevin", name: "Kevin" },
  { id: "rumi", name: "Rumi" }
];

let config = { services: defaultServices, staff: defaultStaff };
let serviceMenuOpen = false;
let staffMenuOpen = false;
let pendingCancel = null;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function displayTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function displayDate(value) {
  const date = new Date(`${value}T12:00:00`);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function getDisplayHours(dateString) {
  const day = new Date(`${dateString}T12:00:00`).getDay();

  if (day === 0) {
    return "Sunday: 10 AM-5 PM";
  }

  if (day === 6) {
    return "Saturday: 9 AM-7 PM";
  }

  const weekday = new Date(`${dateString}T12:00:00`).toLocaleDateString([], { weekday: "long" });
  return `${weekday}: 9 AM-7:30 PM`;
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function setManageStatus(message, type = "") {
  manageStatus.textContent = message;
  manageStatus.dataset.type = type;
}

function normalizeName(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openCancelModal(booking, phone, firstName, lastName, card) {
  pendingCancel = { booking, phone, firstName, lastName, card };
  cancelModalCopy.textContent = `Are you sure you want to cancel ${booking.service} on ${displayDate(booking.date)} at ${displayTime(booking.time)}?`;
  cancelModal.classList.remove("is-hidden");
  confirmCancelButton.focus();
}

function closeCancelModal() {
  pendingCancel = null;
  cancelModal.classList.add("is-hidden");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function phoneDigits(value) {
  return value.replace(/\D/g, "");
}

function formatPhone(value) {
  const digits = phoneDigits(value).slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validateContactFields() {
  const email = emailInput.value.trim();
  const phone = phoneDigits(phoneInput.value);

  emailInput.setCustomValidity(isValidEmail(email) ? "" : "Enter a valid email address.");
  phoneInput.setCustomValidity(phone.length === 10 ? "" : "Enter a full 10 digit phone number.");

  return form.reportValidity();
}

function renderServiceOptions(filter = "") {
  const normalizedFilter = filter.trim().toLowerCase();
  const sourceServices = config.services.length ? config.services : defaultServices;
  const services = sourceServices
    .filter((service) => service.toLowerCase().includes(normalizedFilter))
    .sort((a, b) => a.localeCompare(b));

  serviceOptions.innerHTML = services.length
    ? services.map((service) => `<button type="button" role="option" data-service="${service}">${service}</button>`).join("")
    : '<p class="search-select-empty">No matching services</p>';
}

function setServiceMenuOpen(isOpen) {
  serviceMenuOpen = isOpen;
  serviceInput.setAttribute("aria-expanded", String(isOpen));
  serviceOptions.classList.toggle("is-open", isOpen);
}

function renderStaffOptions(filter = "") {
  const normalizedFilter = filter.trim().toLowerCase();
  const sourceStaff = config.staff.length ? config.staff : defaultStaff;
  const staffList = sourceStaff
    .filter((person) => person.name.toLowerCase().includes(normalizedFilter))
    .sort((a, b) => a.name.localeCompare(b.name));

  staffOptions.innerHTML = staffList.length
    ? staffList.map((person) => `<button type="button" role="option" data-staff-id="${person.id}" data-staff-name="${person.name}">${person.name}</button>`).join("")
    : '<p class="search-select-empty">No matching nail techs</p>';
}

function setStaffMenuOpen(isOpen) {
  staffMenuOpen = isOpen;
  staffInput.setAttribute("aria-expanded", String(isOpen));
  staffOptions.classList.toggle("is-open", isOpen);
}

function syncStaffId() {
  const typedStaff = staffInput.value.trim().toLowerCase();
  const selectedStaff = config.staff.find((person) => person.name.toLowerCase() === typedStaff);
  staffIdInput.value = selectedStaff?.id || "any";
  return staffIdInput.value;
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const serverConfig = await response.json();
  config = {
    services: serverConfig.services?.length ? serverConfig.services : defaultServices,
    staff: serverConfig.staff?.length ? serverConfig.staff : defaultStaff
  };

  renderServiceOptions();
  renderStaffOptions();
  serviceInput.value = "";
  staffInput.value = "Any available tech";
  syncStaffId();
  dateInput.min = todayIso();
  dateInput.value = todayIso();
  updateSummary();
  await loadAvailability();
}

async function loadAvailability() {
  const date = dateInput.value;
  const staffId = syncStaffId();

  selectedTime.value = "";
  summaryTime.textContent = "Choose a time";
  slotHelper.textContent = "Checking available times...";
  timeSlots.innerHTML = '<p class="slot-empty">Loading times...</p>';

  if (!date) {
    timeSlots.innerHTML = '<p class="slot-empty">Choose a date first.</p>';
    return;
  }

  const response = await fetch(`/api/availability?date=${encodeURIComponent(date)}&staffId=${encodeURIComponent(staffId)}`);
  const data = await response.json();
  const availableSlots = data.slots || [];

  if (availableSlots.length === 0) {
    timeSlots.innerHTML = '<p class="slot-empty">No salon hours found for this day.</p>';
    return;
  }

  timeSlots.innerHTML = availableSlots.map((slot) => {
    const disabled = slot.available ? "" : "disabled";
    return `<button class="time-slot" type="button" data-time="${slot.time}" ${disabled}>${displayTime(slot.time)}</button>`;
  }).join("");

  const selectedStaff = config.staff.find((person) => person.id === staffId);
  const staffLabel = selectedStaff?.id === "any" || !selectedStaff
    ? "any available tech"
    : selectedStaff.name;

  slotHelper.textContent = availableSlots.some((slot) => slot.available)
    ? `Showing openings for ${staffLabel}.`
    : `No openings for ${staffLabel} on this date.`;
}

function updateSummary() {
  syncStaffId();
  const selectedStaff = config.staff.find((person) => person.id === staffIdInput.value);
  summaryService.textContent = serviceInput.value || "Choose a service";
  summaryStaff.textContent = selectedStaff?.name || "Any available tech";
  summaryDate.textContent = dateInput.value ? displayDate(dateInput.value) : "Choose a date";
  summaryTime.textContent = selectedTime.value ? displayTime(selectedTime.value) : "Choose a time";
  selectedDayHours.textContent = dateInput.value ? getDisplayHours(dateInput.value) : getDisplayHours(todayIso());
}

timeSlots?.addEventListener("click", (event) => {
  const button = event.target.closest(".time-slot");

  if (!button || button.disabled) {
    return;
  }

  document.querySelectorAll(".time-slot.is-selected").forEach((slot) => slot.classList.remove("is-selected"));
  button.classList.add("is-selected");
  selectedTime.value = button.dataset.time;
  updateSummary();
});

[serviceInput, staffInput, dateInput].forEach((field) => {
  field?.addEventListener("change", async () => {
    updateSummary();

    if (field === staffInput || field === dateInput) {
      await loadAvailability();
    }
  });
});

dateInput?.addEventListener("click", () => {
  dateInput.showPicker?.();
});

dateInput?.addEventListener("focus", () => {
  dateInput.showPicker?.();
});

emailInput?.addEventListener("input", () => {
  emailInput.setCustomValidity(isValidEmail(emailInput.value) || !emailInput.value ? "" : "Enter a valid email address.");
});

phoneInput?.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
  const digits = phoneDigits(phoneInput.value);
  phoneInput.setCustomValidity(digits.length === 10 || digits.length === 0 ? "" : "Enter a full 10 digit phone number.");
});

managePhoneInput?.addEventListener("input", () => {
  managePhoneInput.value = formatPhone(managePhoneInput.value);
  const digits = phoneDigits(managePhoneInput.value);
  managePhoneInput.setCustomValidity(digits.length === 10 || digits.length === 0 ? "" : "Enter a full 10 digit phone number.");
});

serviceInput?.addEventListener("focus", () => {
  renderServiceOptions("");
  setServiceMenuOpen(true);
});

serviceInput?.addEventListener("click", () => {
  renderServiceOptions("");
  setServiceMenuOpen(true);
});

serviceInput?.addEventListener("input", () => {
  renderServiceOptions(serviceInput.value);
  setServiceMenuOpen(true);
  updateSummary();
});

serviceInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setServiceMenuOpen(false);
  }
});

serviceOptions?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-service]");

  if (!option) {
    return;
  }

  serviceInput.value = option.dataset.service;
  setServiceMenuOpen(false);
  updateSummary();
});

document.addEventListener("click", (event) => {
  if (serviceMenuOpen && !event.target.closest("#service-search")) {
    setServiceMenuOpen(false);
  }

  if (staffMenuOpen && !event.target.closest("#staff-search")) {
    setStaffMenuOpen(false);
  }
});

staffInput?.addEventListener("input", async () => {
  renderStaffOptions(staffInput.value);
  setStaffMenuOpen(true);
  updateSummary();
  await loadAvailability();
});

staffInput?.addEventListener("focus", () => {
  renderStaffOptions("");
  setStaffMenuOpen(true);
});

staffInput?.addEventListener("click", () => {
  renderStaffOptions("");
  setStaffMenuOpen(true);
});

staffInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setStaffMenuOpen(false);
  }
});

staffOptions?.addEventListener("click", async (event) => {
  const option = event.target.closest("[data-staff-id]");

  if (!option) {
    return;
  }

  staffInput.value = option.dataset.staffName;
  staffIdInput.value = option.dataset.staffId;
  setStaffMenuOpen(false);
  updateSummary();
  await loadAvailability();
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  if (!validateContactFields()) {
    return;
  }

  if (!selectedTime.value) {
    setStatus("Please choose an available appointment time.", "error");
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  data.phone = phoneDigits(data.phone);
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Booking...";

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to book appointment.");
    }

    const booking = result.booking;
    const sentChannels = (booking.notifications || [])
      .filter((notification) => notification.ok)
      .map((notification) => notification.channel);
    const notificationText = sentChannels.length
      ? ` Confirmation sent by ${sentChannels.join(" and ")}.`
      : " Confirmation saved. Email/text sending will activate after notification accounts are connected.";

    form.classList.add("is-hidden");
    confirmationPanel.classList.remove("is-hidden");
    confirmationCopy.textContent = `${booking.customerName}, your ${booking.service} appointment is confirmed for ${displayDate(booking.date)} at ${displayTime(booking.time)} with ${booking.staffName}.${notificationText}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    setStatus(error.message, "error");
    await loadAvailability();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirm Appointment";
  }
});

function renderManageResults(bookings, phone, firstName, lastName) {
  if (!bookings.length) {
    manageResults.innerHTML = '<p class="slot-empty">No active appointments found for that name and phone number.</p>';
    return;
  }

  manageResults.innerHTML = bookings.map((booking) => `
    <article class="manage-appointment-card" data-booking-card="${escapeHtml(booking.id)}" data-booking-date="${escapeHtml(booking.date)}" data-booking-time="${escapeHtml(booking.time)}">
      <div>
        <strong>${displayDate(booking.date)} at ${displayTime(booking.time)}</strong>
        <span>${escapeHtml(booking.staffName)}</span>
      </div>
      <h3>${escapeHtml(booking.service)}</h3>
      <p>${escapeHtml(booking.customerName)}</p>
      <button
        class="button button-secondary"
        type="button"
        data-cancel-booking="${escapeHtml(booking.id)}"
        data-phone="${escapeHtml(phone)}"
        data-first-name="${escapeHtml(firstName)}"
        data-last-name="${escapeHtml(lastName)}"
      >
        Cancel Appointment
      </button>
    </article>
  `).join("");
}

manageForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setManageStatus("");
  manageResults.innerHTML = '<p class="slot-empty">Looking up appointments...</p>';

  const phone = phoneDigits(managePhoneInput.value);
  const firstName = normalizeName(manageFirstNameInput.value);
  const lastName = normalizeName(manageLastNameInput.value);
  managePhoneInput.setCustomValidity(phone.length === 10 ? "" : "Enter a full 10 digit phone number.");

  if (!manageForm.reportValidity()) {
    return;
  }

  try {
    const lookupParams = new URLSearchParams({ phone, firstName, lastName });
    const response = await fetch(`/api/customer-bookings?${lookupParams.toString()}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to look up appointments.");
    }

    renderManageResults(result.bookings || [], phone, firstName, lastName);
  } catch (error) {
    manageResults.innerHTML = "";
    setManageStatus(error.message, "error");
  }
});

manageResults?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel-booking]");

  if (!button) {
    return;
  }

  setManageStatus("");
  const card = button.closest(".manage-appointment-card");
  const booking = {
    id: button.dataset.cancelBooking,
    service: card?.querySelector("h3")?.textContent || "appointment",
    date: card?.dataset.bookingDate || "",
    time: card?.dataset.bookingTime || ""
  };

  openCancelModal(booking, button.dataset.phone, button.dataset.firstName, button.dataset.lastName, card);
});

keepAppointmentButton?.addEventListener("click", closeCancelModal);

cancelModal?.addEventListener("click", (event) => {
  if (event.target === cancelModal) {
    closeCancelModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !cancelModal.classList.contains("is-hidden")) {
    closeCancelModal();
  }
});

confirmCancelButton?.addEventListener("click", async () => {
  if (!pendingCancel) {
    return;
  }

  const { booking, phone, firstName, lastName, card } = pendingCancel;
  confirmCancelButton.disabled = true;
  confirmCancelButton.textContent = "Cancelling...";

  try {
    const response = await fetch(`/api/customer-bookings/${booking.id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, firstName, lastName })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to cancel appointment.");
    }

    const sentChannels = (result.booking?.cancellationNotifications || [])
      .filter((notification) => notification.ok)
      .map((notification) => notification.channel);
    const notificationText = sentChannels.length
      ? ` Cancellation notice sent by ${sentChannels.join(" and ")}.`
      : " Cancellation saved. Email/text cancellation notice could not be sent yet.";

    closeCancelModal();
    setManageStatus(`Appointment cancelled. That time slot is now open again.${notificationText}`);
    card?.remove();
    await loadAvailability();

    if (!manageResults.querySelector(".manage-appointment-card")) {
      manageResults.innerHTML = '<p class="slot-empty">No active appointments found for that name and phone number.</p>';
    }
  } catch (error) {
    setManageStatus(error.message, "error");
  } finally {
    confirmCancelButton.disabled = false;
    confirmCancelButton.textContent = "Cancel Appointment";
  }
});

loadConfig().catch(() => {
  slotHelper.textContent = "Booking server offline.";
  timeSlots.innerHTML = '<p class="slot-empty">The booking system is not running. Start the salon server and refresh.</p>';
});
