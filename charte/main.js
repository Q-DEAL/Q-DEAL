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

/* Header search: missions around a place first (assets/demo/places.js), then the site's pages and
   sections; any other text searches the missions by keyword. */
const searchForm = document.querySelector("[data-site-search]");
const searchInput = searchForm.querySelector("input");
const searchResults = searchForm.querySelector(".search-results");
const missionsPage = searchForm.getAttribute("action");
const searchText = isFrench
  ? { near: (place) => `Missions près de ${place}`, count: (n) => `${n} ${n > 1 ? "missions" : "mission"}`, examples: "Exemples de missions", keyword: (q) => `Missions « ${q} »`, keywordHint: "Rechercher dans les missions" }
  : { near: (place) => `Tasks near ${place}`, count: (n) => `${n} ${n > 1 ? "tasks" : "task"}`, examples: "Example tasks", keyword: (q) => `“${q}” tasks`, keywordHint: "Search the tasks" };

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

function placeEntries(query) {
  return rankPlaces(query, window.QDEAL_PLACES || []).slice(0, 4).map((place) => ({
    href: `${missionsPage}?lieu=${encodeURIComponent(place.key)}`,
    label: searchText.near(isFrench ? place.labelFr : place.labelEn),
    group: place.missionCount ? searchText.count(place.missionCount) : searchText.examples,
  }));
}

function keywordEntry(query) {
  return { href: `${missionsPage}?q=${encodeURIComponent(query.trim())}`, label: searchText.keyword(query.trim()), group: searchText.keywordHint };
}

const searchIndex = [];
siteMenu.querySelectorAll(".menu-grid section").forEach((section) => {
  section.querySelectorAll("a").forEach((link) => {
    if (searchIndex.some((entry) => entry.href === link.getAttribute("href"))) return;
    const group = section.querySelector("h2").textContent;
    searchIndex.push({
      href: link.getAttribute("href"),
      label: link.textContent,
      group,
      haystack: normalize(`${link.textContent} ${group} ${link.dataset.keywords || ""}`),
    });
  });
});

function findMatches(query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const places = placeEntries(query);
  const pages = searchIndex.filter((entry) => words.every((word) => entry.haystack.includes(word)));
  const keyword = !places.length && normalize(query).length >= 3 ? [keywordEntry(query)] : [];
  return [...places, ...pages, ...keyword].slice(0, 6);
}

function renderResults() {
  const query = searchInput.value;
  if (!query.trim()) {
    searchResults.hidden = true;
    searchResults.replaceChildren();
    return;
  }
  const matches = findMatches(query);
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = text.noResult;
    searchResults.replaceChildren(empty);
  } else {
    searchResults.replaceChildren(...matches.map((entry) => {
      const link = document.createElement("a");
      link.href = entry.href;
      const label = document.createElement("span");
      label.textContent = entry.label;
      const group = document.createElement("small");
      group.textContent = entry.group;
      link.append(label, group);
      link.addEventListener("click", () => { searchResults.hidden = true; });
      return link;
    }));
  }
  searchResults.hidden = false;
}

searchInput.addEventListener("input", renderResults);
searchInput.addEventListener("focus", renderResults);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    const first = searchResults.querySelector("a");
    if (first) { event.preventDefault(); first.focus(); }
  }
});
searchResults.addEventListener("keydown", (event) => {
  const links = [...searchResults.querySelectorAll("a")];
  const index = links.indexOf(document.activeElement);
  if (event.key === "ArrowDown" && index < links.length - 1) { event.preventDefault(); links[index + 1].focus(); }
  if (event.key === "ArrowUp") { event.preventDefault(); (index > 0 ? links[index - 1] : searchInput).focus(); }
});
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const [first] = findMatches(searchInput.value);
  if (first) {
    searchResults.hidden = true;
    window.location.href = first.href;
  } else {
    renderResults();
  }
});
searchForm.addEventListener("focusout", (event) => {
  if (!searchForm.contains(event.relatedTarget)) searchResults.hidden = true;
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".nav-item.has-panel")) closeNavPanels();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (menuToggle.getAttribute("aria-expanded") === "true") setMenuOpen(false);
  closeNavPanels();
  searchResults.hidden = true;
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
