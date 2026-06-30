const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const menuToggleLabel = menuToggle?.querySelector(".sr-only");
const navLinks = document.querySelector(".nav-links");
const publicServiceMenu = document.querySelector(".service-menu");
const betaNotice = document.querySelector("#site-beta-notice");
const betaNoticeClose = document.querySelector("#close-beta-notice");
const betaNoticeContinue = document.querySelector("#continue-beta-notice");
const betaNoticeSessionKey = "dior-nails-beta-notice-seen-v1";
const landingGaps = {
  top: 0,
  gallery: 40,
  contact: 0,
};

function escapeMarkup(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function renderPublicServices() {
  if (!publicServiceMenu) return;

  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    const records = (config.serviceRecords || []).filter((service) => service.active !== false);
    if (!response.ok || !records.length) return;

    const categories = [...new Set(records.map((service) => service.category))];
    publicServiceMenu.innerHTML = categories.map((category) => {
      const categoryServices = records.filter((service) => service.category === category);
      const initial = category.trim().charAt(0).toUpperCase() || "S";
      return `
        <article class="service-category ${categoryServices.length > 8 ? "service-category-wide" : ""}">
          <div class="service-category-heading">
            <span aria-hidden="true">${escapeMarkup(initial)}</span>
            <div>
              <p>${escapeMarkup(category)}</p>
              <h3>${escapeMarkup(category.toUpperCase())}</h3>
            </div>
          </div>
          <ul class="price-list ${categoryServices.length > 8 ? "price-list-columns" : ""}">
            ${categoryServices.map((service) => `
              <li>
                <span>${escapeMarkup(service.name)}</span>
                <strong>$${Number(service.price || 0).toFixed(Number(service.price || 0) % 1 ? 2 : 0)}</strong>
              </li>
            `).join("")}
          </ul>
        </article>
      `;
    }).join("");
  } catch {
    // Keep the static menu as a reliable fallback if the booking server is offline.
  }
}

function setMenuOpen(isOpen) {
  menuToggle?.setAttribute("aria-expanded", String(isOpen));
  if (menuToggleLabel) {
    menuToggleLabel.textContent = isOpen ? "Close menu" : "Open menu";
  }
  navLinks?.classList.toggle("is-open", isOpen);
}

function closeBetaNotice() {
  if (!betaNotice) return;
  betaNotice.classList.add("is-hidden");
  try {
    sessionStorage.setItem(betaNoticeSessionKey, "true");
  } catch {
    // The notice can still be dismissed when browser storage is unavailable.
  }
}

function openBetaNotice() {
  if (!betaNotice) return;
  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem(betaNoticeSessionKey) === "true";
  } catch {
    alreadySeen = false;
  }
  if (alreadySeen) return;
  betaNotice.classList.remove("is-hidden");
  betaNoticeContinue?.focus();
}

function scrollToSection(id, behavior = "smooth") {
  const target = id ? document.getElementById(id) : null;

  if (!target) {
    return false;
  }

  const headerHeight = header?.getBoundingClientRect().height ?? 0;
  const landingGap = landingGaps[id] ?? 0;
  const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - landingGap;

  window.scrollTo({ top, behavior });
  return true;
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href")?.slice(1);

    if (!scrollToSection(id)) {
      return;
    }

    event.preventDefault();
    setMenuOpen(false);
    history.pushState(null, "", `#${id}`);
  });
});

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  setMenuOpen(!isOpen);
});

document.addEventListener("click", (event) => {
  if (!header?.contains(event.target)) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenuOpen(false);
    closeBetaNotice();
  }
});

betaNoticeClose?.addEventListener("click", closeBetaNotice);
betaNoticeContinue?.addEventListener("click", closeBetaNotice);
betaNotice?.addEventListener("click", (event) => {
  if (event.target === betaNotice) {
    closeBetaNotice();
  }
});

window.addEventListener("resize", () => {
  if (window.matchMedia("(min-width: 1051px)").matches) {
    setMenuOpen(false);
  }
});

window.addEventListener("load", () => {
  renderPublicServices();
  openBetaNotice();
  const id = window.location.hash.slice(1);

  if (id) {
    requestAnimationFrame(() => scrollToSection(id, "auto"));
  }
});
