const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const menuToggleLabel = menuToggle?.querySelector(".sr-only");
const navLinks = document.querySelector(".nav-links");
const landingGaps = {
  top: 0,
  gallery: 40,
  contact: 0,
};

function setMenuOpen(isOpen) {
  menuToggle?.setAttribute("aria-expanded", String(isOpen));
  if (menuToggleLabel) {
    menuToggleLabel.textContent = isOpen ? "Close menu" : "Open menu";
  }
  navLinks?.classList.toggle("is-open", isOpen);
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
  }
});

window.addEventListener("resize", () => {
  if (window.matchMedia("(min-width: 1051px)").matches) {
    setMenuOpen(false);
  }
});

window.addEventListener("load", () => {
  const id = window.location.hash.slice(1);

  if (id) {
    requestAnimationFrame(() => scrollToSection(id, "auto"));
  }
});
