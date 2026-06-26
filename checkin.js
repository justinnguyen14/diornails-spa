const phoneForm = document.querySelector("#checkin-phone-form");
const profileForm = document.querySelector("#checkin-profile-form");
const birthdayForm = document.querySelector("#checkin-birthday-form");
const resultPanel = document.querySelector("#checkin-result");
const statusLine = document.querySelector("#checkin-status");
const startOverButton = document.querySelector("#checkin-start-over");
const skipBirthdayButton = document.querySelector("#checkin-skip-birthday");
const phoneInput = phoneForm?.querySelector("input[name='phone']");
const dialPad = document.querySelector(".phone-dial-pad");

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function displayPhone(value) {
  const digits = phoneDigits(value);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function escapeMarkup(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayTime(value) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function birthdayFromFields(form, { required = false } = {}) {
  const month = form.querySelector("[data-birthday-month]")?.value || "";
  const day = form.querySelector("[data-birthday-day]")?.value || "";
  const year = form.querySelector("[data-birthday-year]")?.value || "";
  const hasAnyValue = Boolean(month || day || year);

  if (!hasAnyValue && !required) return { value: "", valid: true };
  if (!month || !day || !year) {
    return { value: "", valid: false, message: required ? "Please add your birthday or choose skip for now." : "Enter a complete birthday or leave it blank." };
  }

  const numericDay = Number(day);
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const currentYear = new Date().getFullYear();
  const date = new Date(numericYear, numericMonth - 1, numericDay);
  const valid = Number.isInteger(numericDay)
    && Number.isInteger(numericYear)
    && numericYear >= 1900
    && numericYear <= currentYear
    && date.getFullYear() === numericYear
    && date.getMonth() === numericMonth - 1
    && date.getDate() === numericDay;

  if (!valid) {
    return { value: "", valid: false, message: "Please enter a real birthday with month, day, and 4 digit year." };
  }

  return {
    value: `${numericYear}-${String(numericMonth).padStart(2, "0")}-${String(numericDay).padStart(2, "0")}`,
    valid: true
  };
}

function syncBirthdayField(form, options = {}) {
  const birthdayInput = form.querySelector("input[name='birthday']");
  if (!birthdayInput) return true;
  const birthday = birthdayFromFields(form, options);
  if (!birthday.valid) {
    birthdayInput.value = "";
    setStatus(birthday.message, "error");
    return false;
  }
  birthdayInput.value = birthday.value;
  return true;
}

function setStatus(message = "", type = "") {
  statusLine.textContent = message;
  statusLine.dataset.type = type;
}

function setLoading(form, isLoading, label) {
  const button = form.querySelector("button[type='submit']");
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Checking..." : label;
}

function setPhoneDigits(digits) {
  if (!phoneInput) return;
  const normalized = phoneDigits(digits);
  phoneInput.dataset.digits = normalized;
  phoneInput.value = displayPhone(normalized);
}

function currentPhoneDigits() {
  return phoneDigits(phoneInput?.dataset.digits || phoneInput?.value || "");
}

function renderAppointments(appointments = []) {
  if (!appointments.length) {
    return '<p class="checkin-muted">No appointment was found for today. Walk-ins are still checked in and earn one visit point.</p>';
  }

  return `
    <div class="checkin-appointments">
      <strong>Today&apos;s appointment</strong>
      ${appointments.map((appointment) => `
        <article>
          <span>${escapeMarkup(displayTime(appointment.time))}</span>
          <p>${escapeMarkup(appointment.service)} with ${escapeMarkup(appointment.staffName)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function showResult(data) {
  const customer = data.customer || {};
  const welcome = data.alreadyCheckedIn
    ? `You&apos;re already checked in today, ${escapeMarkup(customer.firstName || "friend")}.`
    : data.message || `Welcome back, ${escapeMarkup(customer.firstName || "friend")}!`;

  window.scrollTo({ top: 0, left: 0 });
  document.body.classList.add("is-checkin-complete");
  phoneForm.classList.add("is-hidden");
  profileForm.classList.add("is-hidden");
  birthdayForm.classList.add("is-hidden");
  resultPanel.classList.remove("is-hidden");
  resultPanel.innerHTML = `
    <div class="checkin-success-mark" aria-hidden="true">OK</div>
    <h2>${welcome}</h2>
    <p>${data.alreadyCheckedIn ? "One visit point is allowed per day." : "Your check-in has been saved."}</p>
    <div class="checkin-points">
      <span>Total visit points</span>
      <strong>${Number(data.points || customer.checkInCount || 0)}</strong>
    </div>
    ${renderAppointments(data.appointments)}
    <p class="checkin-reset-hint">Tap anywhere to check in the next customer.</p>
  `;
}

function showProfile(data) {
  document.body.classList.remove("is-checkin-complete");
  resultPanel.classList.add("is-hidden");
  birthdayForm.classList.add("is-hidden");
  profileForm.classList.remove("is-hidden");
  profileForm.elements.phone.value = phoneDigits(data.phone);
  setStatus(data.message || "Create your profile to finish checking in.");
  profileForm.querySelector("input[name='firstName']")?.focus();
}

function showBirthdayPrompt(data) {
  document.body.classList.remove("is-checkin-complete");
  phoneForm.classList.add("is-hidden");
  profileForm.classList.add("is-hidden");
  resultPanel.classList.add("is-hidden");
  birthdayForm.classList.remove("is-hidden");
  birthdayForm.elements.customerId.value = data.customer?.id || "";
  birthdayForm.elements.phone.value = phoneDigits(data.phone || data.customer?.phone);
  setStatus(data.message || "Add your birthday to receive birthday-week gifts and discounts.");
  birthdayForm.querySelector("[data-birthday-month]")?.focus();
}

function resetCheckin() {
  document.body.classList.remove("is-checkin-complete");
  phoneForm.reset();
  setPhoneDigits("");
  phoneForm.classList.remove("is-hidden");
  profileForm.reset();
  profileForm.classList.add("is-hidden");
  birthdayForm.reset();
  birthdayForm.classList.add("is-hidden");
  resultPanel.classList.add("is-hidden");
  resultPanel.innerHTML = "";
  setStatus("");
}

dialPad?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.dialAction;
  const number = button.dataset.dialNumber;
  let digits = currentPhoneDigits();

  if (number && digits.length < 10) {
    digits += number;
  } else if (action === "backspace") {
    digits = digits.slice(0, -1);
  } else if (action === "clear") {
    digits = "";
  }

  setPhoneDigits(digits);
  setStatus("");
});

phoneForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  const phone = currentPhoneDigits();

  if (phone.length !== 10) {
    setStatus("Please enter a full 10 digit phone number.", "error");
    return;
  }

  setLoading(phoneForm, true, "Check In");
  try {
    const response = await fetch("/api/checkins/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to check in.");

    if (data.needsBirthday) {
      showBirthdayPrompt(data);
    } else if (data.needsProfile) {
      showProfile(data);
    } else {
      showResult(data);
    }
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setLoading(phoneForm, false, "Check In");
  }
});

async function submitBirthday({ skipBirthday = false } = {}) {
  setStatus("");
  if (!skipBirthday && !syncBirthdayField(birthdayForm, { required: true })) {
    return;
  }
  const data = Object.fromEntries(new FormData(birthdayForm).entries());
  data.skipBirthday = skipBirthday;

  if (!skipBirthday && !data.birthday) {
    setStatus("Please add your birthday or choose skip for now.", "error");
    return;
  }

  const button = skipBirthday ? skipBirthdayButton : birthdayForm.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = skipBirthday ? "Checking In..." : "Saving...";

  try {
    const response = await fetch("/api/checkins/birthday", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to finish check-in.");
    showResult(result);
    setStatus("");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = skipBirthday ? "Skip For Now" : "Save Birthday & Check In";
  }
}

birthdayForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitBirthday();
});

skipBirthdayButton?.addEventListener("click", async () => {
  await submitBirthday({ skipBirthday: true });
});

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  if (!syncBirthdayField(profileForm)) {
    return;
  }
  const data = Object.fromEntries(new FormData(profileForm).entries());
  data.phone = phoneDigits(data.phone);
  data.profileConsent = Boolean(data.profileConsent);
  data.smsConsent = Boolean(data.smsConsent);

  if (!data.firstName || !data.lastName || data.phone.length !== 10) {
    setStatus("First name, last name, and a full 10 digit phone number are required.", "error");
    return;
  }

  if (!data.profileConsent) {
    setStatus("Please agree to save your customer profile before checking in.", "error");
    return;
  }

  setLoading(profileForm, true, "Create Profile & Check In");
  try {
    const response = await fetch("/api/checkins/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to save profile.");
    showResult(result);
    setStatus("");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setLoading(profileForm, false, "Create Profile & Check In");
  }
});

startOverButton?.addEventListener("click", resetCheckin);

document.addEventListener("click", () => {
  if (!document.body.classList.contains("is-checkin-complete")) return;
  resetCheckin();
});
