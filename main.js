const menuToggle = document.querySelector(".menu-toggle");
const siteMenu = document.querySelector(".site-menu");
const menuBackdrop = document.querySelector(".menu-backdrop");
const menuClose = document.querySelector(".menu-close");

function setMenuOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  siteMenu.setAttribute("aria-hidden", String(!isOpen));
  siteMenu.inert = !isOpen;
  siteMenu.classList.toggle("is-open", isOpen);
  menuBackdrop.hidden = !isOpen;
  menuBackdrop.classList.toggle("is-visible", isOpen);
  document.body.classList.toggle("menu-open", isOpen);
  if (isOpen) menuClose.focus();
  else menuToggle.focus();
}

menuToggle.addEventListener("click", () => setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true"));
menuClose.addEventListener("click", () => setMenuOpen(false));
menuBackdrop.addEventListener("click", () => setMenuOpen(false));
siteMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  if (link.getAttribute("href").startsWith("#")) setMenuOpen(false);
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") setMenuOpen(false);
});

document.querySelectorAll(".footer-column h2 button").forEach((button) => button.addEventListener("click", () => {
  const column = button.closest(".footer-column");
  const isOpen = column.classList.toggle("is-open");
  button.setAttribute("aria-expanded", String(isOpen));
  button.querySelector("span").textContent = isOpen ? "−" : "+";
}));

const siteSearch = document.querySelector("#site-search");
siteSearch.addEventListener("input", () => {
  const query = siteSearch.value.trim().toLowerCase();
  siteMenu.querySelectorAll(".menu-grid section").forEach((section) => {
    section.hidden = Boolean(query) && !section.textContent.toLowerCase().includes(query);
    section.querySelectorAll("a").forEach((link) => {
      link.hidden = Boolean(query) && !link.textContent.toLowerCase().includes(query);
    });
  });
});
