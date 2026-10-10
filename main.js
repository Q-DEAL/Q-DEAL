const isFrench = document.documentElement.lang === "fr";
const text = isFrench
  ? { open: "Ouvrir le menu", close: "Fermer le menu", noResult: "Aucun résultat", mailOpened: "Votre messagerie s’ouvre avec le message prêt à être envoyé." }
  : { open: "Open navigation menu", close: "Close navigation menu", noResult: "No results", mailOpened: "Your email app is opening with the message ready to send." };

const normalize = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* Mobile menu */
const menuToggle = document.querySelector(".menu-toggle");
const siteMenu = document.querySelector(".site-menu");
const menuBackdrop = document.querySelector(".menu-backdrop");
const menuClose = document.querySelector(".menu-close");

function setMenuOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? text.close : text.open);
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
siteMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));

const siteSearch = document.querySelector("#site-search");
siteSearch.addEventListener("input", () => {
  const query = normalize(siteSearch.value);
  siteMenu.querySelectorAll(".menu-grid section").forEach((section) => {
    let visibleLinks = 0;
    section.querySelectorAll("a").forEach((link) => {
      const haystack = normalize(`${section.querySelector("h2").textContent} ${link.textContent} ${link.dataset.keywords || ""}`);
      link.hidden = Boolean(query) && !haystack.includes(query);
      if (!link.hidden) visibleLinks += 1;
    });
    section.hidden = visibleLinks === 0;
  });
});

/* Desktop navigation dropdowns */
const navItems = document.querySelectorAll(".nav-item.has-panel");

function closeNavPanels(except) {
  navItems.forEach((item) => {
    if (item === except) return;
    item.classList.remove("is-open");
    item.querySelector(".nav-trigger").setAttribute("aria-expanded", "false");
  });
}

navItems.forEach((item) => {
  const trigger = item.querySelector(".nav-trigger");
  trigger.addEventListener("click", () => {
    const isOpen = item.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", String(isOpen));
    closeNavPanels(item);
  });
  item.addEventListener("focusout", (event) => {
    if (!item.contains(event.relatedTarget)) closeNavPanels();
  });
  item.querySelectorAll(".nav-panel a").forEach((link) => link.addEventListener("click", () => closeNavPanels()));
});

// Best matches first: exact name, exact postcode, then names or postcodes starting with the text.
function rankPlaces(query, places) {
  const q = normalize(query);
  if (!q) return [];
  return places.map((place) => {
    const label = normalize(isFrench ? place.labelFr : place.labelEn);
    let score = 0;
    if (label === q || place.key === q) score = 4;
    else if (place.terms.includes(q)) score = 3;
    else if (label.startsWith(q) || place.terms.some((term) => term.startsWith(q) || (/^\d+$/.test(term) && q.startsWith(term)))) score = 2;
    else if (label.includes(q)) score = 1;
    return { place, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).map((entry) => entry.place);
}
window.QDEAL_SEARCH = { normalize, rankPlaces };

/* Search dialog: a cleaning service (assets/demo/catalog.js) and a place. Opened from the header
   field on every page; leads to the missions page with ?service=…&lieu=… */
const catalog = window.QDEAL_CATALOG || { places: [], groups: [], services: [] };
const dialog = document.querySelector("#search-dialog");
const openers = document.querySelectorAll("[data-open-search]");
const summary = document.querySelector("[data-search-summary]");
const missionsPage = openers[0].dataset.missionsPage;
const serviceQuery = dialog.querySelector("#service-query");
const placeQuery = dialog.querySelector("#service-place");
const list = dialog.querySelector("[data-service-list]");
const crumbRoot = dialog.querySelector("[data-crumb-root]");
const crumbGroup = dialog.querySelector("[data-crumb-group]");
const searchText = isFrench
  ? { noService: "Aucun service ne correspond.", selected: "Service choisi", placeholder: serviceQuery.placeholder }
  : { noService: "No matching service.", selected: "Selected service", placeholder: serviceQuery.placeholder };
const label = (item) => (isFrench ? item.fr : item.en);
const placeLabel = (place) => (isFrench ? place.labelFr : place.labelEn);
const ICONS = {
  menage: '<path d="M14 3l6.5 6.5"/><path d="M11 6l7 7"/><path d="M4 20c.3-4.3 2.3-7 5.5-8.7l3.2 3.2C11 17.7 8.3 19.7 4 20z"/>',
  electromenager: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13.5" r="4.2"/><circle cx="7.8" cy="6.6" r=".9"/><path d="M11 6.6h6"/>',
  textile: '<path d="M5.5 11V8.5A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.5 2.5V11"/><path d="M3 13.5A2 2 0 0 1 5 11.5h0a2 2 0 0 1 2 2V15h10v-1.5a2 2 0 0 1 4 0V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><path d="M6.5 19.5V21M17.5 19.5V21"/>',
  voiture: '<path d="M5 13l1.6-4.6A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.4L19 13"/><rect x="3" y="13" width="18" height="5.5" rx="1.5"/><circle cx="7.5" cy="15.8" r="1"/><circle cx="16.5" cy="15.8" r="1"/><path d="M6 18.5V20M18 18.5V20"/>',
};
const CHEVRON = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg class="check" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let currentGroup = null;
let selectedService = null;

catalog.places.forEach((place) => dialog.querySelector("#search-dialog-places").append(new Option(placeLabel(place))));

// On the missions page the header field shows the current search.
const pageParams = new URLSearchParams(window.location.search);
const paramService = catalog.services.find((service) => service.code === pageParams.get("service"));
const paramPlace = catalog.places.find((place) => place.key === pageParams.get("lieu")) || rankPlaces(pageParams.get("lieu") || "", catalog.places)[0];
if (paramService) {
  selectedService = paramService.code;
  currentGroup = paramService.group;
}
if (paramPlace) placeQuery.value = placeLabel(paramPlace);
updateSummary();

function updateSummary() {
  const service = catalog.services.find((item) => item.code === selectedService);
  const parts = [service && label(service), paramPlace && placeLabel(paramPlace)].filter(Boolean);
  summary.textContent = parts.length ? parts.join(" · ") : searchText.placeholder;
  openers.forEach((opener) => opener.classList.toggle("has-value", parts.length > 0));
}

function row(content, onClick, extra = "") {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `search-dialog-row${extra}`;
  button.innerHTML = content;
  button.addEventListener("click", onClick);
  li.append(button);
  return li;
}

function iconFor(group) {
  return `<span class="search-dialog-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[group.code] || ""}</svg></span>`;
}

function serviceRow(service, withGroup) {
  const group = catalog.groups.find((item) => item.code === service.group);
  const selected = service.code === selectedService;
  const text = `<span>${label(service)}${withGroup && group ? `<small>${label(group)}</small>` : ""}</span>${selected ? CHECK : ""}`;
  return row(text, () => selectService(service.code), selected ? " is-selected" : "");
}

function renderList() {
  const query = normalize(serviceQuery.value);
  const chosen = catalog.services.find((item) => item.code === selectedService);
  const typedIsSelection = chosen && normalize(label(chosen)) === query;
  list.replaceChildren();
  if (query && !typedIsSelection) {
    const matches = catalog.services.filter((service) => {
      const group = catalog.groups.find((item) => item.code === service.group);
      return normalize(`${label(service)} ${group ? label(group) : ""}`).includes(query);
    });
    crumbGroup.hidden = true;
    if (!matches.length) {
      const empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = searchText.noService;
      list.append(empty);
      return;
    }
    list.append(...matches.map((service) => serviceRow(service, true)));
    return;
  }
  if (currentGroup) {
    const group = catalog.groups.find((item) => item.code === currentGroup);
    crumbGroup.textContent = label(group);
    crumbGroup.hidden = false;
    list.append(...catalog.services.filter((service) => service.group === currentGroup).map((service) => serviceRow(service, false)));
    return;
  }
  crumbGroup.hidden = true;
  list.append(...catalog.groups.map((group) => row(`${iconFor(group)}<span>${label(group)}</span>${CHEVRON}`, () => {
    currentGroup = group.code;
    renderList();
    list.querySelector("button")?.focus();
  })));
}

function selectService(code) {
  const service = catalog.services.find((item) => item.code === code);
  selectedService = code;
  currentGroup = service.group;
  serviceQuery.value = label(service);
  renderList();
  placeQuery.focus();
}

function go() {
  const params = new URLSearchParams();
  if (selectedService) params.set("service", selectedService);
  const place = placeQuery.value.trim();
  if (place) params.set("lieu", place);
  if (!selectedService && !place) {
    serviceQuery.focus();
    return;
  }
  window.location.href = `${missionsPage}?${params}`;
}

function openDialog() {
  if (dialog.open) return;
  renderList();
  dialog.showModal();
  serviceQuery.focus();
  serviceQuery.select();
}

openers.forEach((opener) => opener.addEventListener("click", openDialog));
dialog.querySelector(".search-dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
crumbRoot.addEventListener("click", () => { currentGroup = null; serviceQuery.value = ""; renderList(); serviceQuery.focus(); });
serviceQuery.addEventListener("input", () => {
  if (selectedService && normalize(serviceQuery.value) !== normalize(label(catalog.services.find((item) => item.code === selectedService)))) selectedService = null;
  renderList();
});
serviceQuery.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    const first = list.querySelector("button");
    if (first) { event.preventDefault(); first.focus(); }
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const buttons = list.querySelectorAll("button");
    if (selectedService) placeQuery.focus();
    else if (buttons.length === 1) buttons[0].click();
  }
});
list.addEventListener("keydown", (event) => {
  const buttons = [...list.querySelectorAll("button")];
  const index = buttons.indexOf(document.activeElement);
  if (event.key === "ArrowDown" && index < buttons.length - 1) { event.preventDefault(); buttons[index + 1].focus(); }
  if (event.key === "ArrowUp") { event.preventDefault(); (index > 0 ? buttons[index - 1] : serviceQuery).focus(); }
});
placeQuery.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); go(); } });
dialog.querySelector("[data-search-go]").addEventListener("click", go);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".nav-item.has-panel")) closeNavPanels();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (menuToggle.getAttribute("aria-expanded") === "true") setMenuOpen(false);
  closeNavPanels();
});

/* Footer accordions (mobile) */
document.querySelectorAll(".footer-column h2 button").forEach((button) => button.addEventListener("click", () => {
  const column = button.closest(".footer-column");
  const isOpen = column.classList.toggle("is-open");
  button.setAttribute("aria-expanded", String(isOpen));
  button.querySelector("span").textContent = isOpen ? "−" : "+";
}));

/* Contact form: preselects the profile from ?type= and hands the message to the email app.
   The recipient is the mailto: address in the form's action, which also works without this script. */
const contactForm = document.querySelector("[data-contact-form]");
if (contactForm) {
  const requestedType = new URLSearchParams(window.location.search).get("type");
  const typeInput = contactForm.querySelector(`input[name="type"][value="${CSS.escape(requestedType || "")}"]`);
  if (typeInput) typeInput.checked = true;

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const profile = contactForm.querySelector('input[name="type"]:checked').dataset.label;
    const labels = isFrench
      ? { subject: "Demande", profile: "Profil", name: "Nom", email: "E-mail", phone: "Téléphone", city: "Ville", company: "Entreprise" }
      : { subject: "Request", profile: "Profile", name: "Name", email: "Email", phone: "Phone", city: "City", company: "Company" };
    const optional = (key) => (data.get(key).trim() ? `${labels[key]} : ${data.get(key).trim()}` : null);
    const lines = [
      `${labels.profile} : ${profile}`,
      `${labels.name} : ${data.get("name")}`,
      `${labels.email} : ${data.get("email")}`,
      optional("phone"),
      optional("city"),
      optional("company"),
      "",
      data.get("message"),
    ].filter((line) => line !== null);
    const subject = `Q DEAL – ${labels.subject} ${profile.toLowerCase()} – ${data.get("name")}`;
    const recipient = contactForm.getAttribute("action").replace(/^mailto:/, "");
    const mailto = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    contactForm.querySelector(".form-status").textContent = text.mailOpened;
    window.location.href = mailto;
  });
}
