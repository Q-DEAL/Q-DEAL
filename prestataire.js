/* Devenir prestataire (devenir-prestataire.html): the sign-up form of a provider.
   Services and places come from assets/demo/prestations.js (the snapshot of the database).
   There is no account yet: the form is kept in this browser under one localStorage key
   (qdeal.prestataire.v1) until Supabase Auth and the profiles table exist. The future api
   calls are named where the data will go: api.set_provider_location (point + radius),
   provider_skills (services), and an availability table still to be designed. */
(() => {
  const root = document.querySelector("[data-provider-signup]");
  const data = window.QDEAL_MISSIONS;
  if (!root || !data || !window.QDEAL_SEARCH || !window.L) return;
  const { rankPlaces } = window.QDEAL_SEARCH;

  const STORE_KEY = "qdeal.prestataire.v1";
  const DAYS = [
    { key: "lun", label: "Lun", short: "L", name: "Lundi" },
    { key: "mar", label: "Mar", short: "M", name: "Mardi" },
    { key: "mer", label: "Mer", short: "M", name: "Mercredi" },
    { key: "jeu", label: "Jeu", short: "J", name: "Jeudi" },
    { key: "ven", label: "Ven", short: "V", name: "Vendredi" },
    { key: "sam", label: "Sam", short: "S", name: "Samedi", weekend: true },
    { key: "dim", label: "Dim", short: "D", name: "Dimanche", weekend: true },
  ];
  const SLOTS = [
    { key: "matin", label: "Matin", hours: "8 h – 12 h", duration: 4 },
    { key: "midi", label: "Midi", hours: "12 h – 14 h", duration: 2 },
    { key: "apres-midi", label: "Après-midi", hours: "14 h – 18 h", duration: 4 },
    { key: "soir", label: "Soir", hours: "18 h – 21 h", duration: 3 },
  ];
  const PRESETS = {
    "soirs-weekends": (day, slot) => slot.key === "soir" || day.weekend,
    journees: (day, slot) => !day.weekend && slot.key !== "soir",
    tout: () => true,
    rien: () => false,
  };

  const form = root.querySelector("[data-provider-form]");
  const live = root.querySelector("[data-live]");
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const placeLabel = (place) => place.labelFr;
  const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

  /* Saved state ----------------------------------------------------------------- */
  let state = { services: [], week: [], periods: [] };
  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch { /* nothing stored */ }
  const persist = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  };

  /* Services: the catalogue, by group --------------------------------------------- */
  const servicesBox = root.querySelector("[data-services]");
  data.groups.forEach((group) => {
    const block = el("div", "dp-service-group");
    block.append(el("span", "", group.fr));
    const chips = el("div", "dp-chips");
    data.skills.filter((skill) => skill.group === group.code).forEach((skill) => {
      const chip = el("label", "dp-chip");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "services";
      input.value = skill.code;
      input.checked = state.services.includes(skill.code);
      chip.append(input, skill.fr);
      chips.append(chip);
    });
    block.append(chips);
    servicesBox.append(block);
  });

  /* Zone: a place of the demo and a radius, on a map ------------------------------ */
  const addressInput = form.elements.adresse;
  const radiusInput = form.elements.rayon;
  const radiusLabel = root.querySelector("[data-radius-label]");
  const placeHint = root.querySelector("[data-place-hint]");
  const zoneCount = root.querySelector("[data-zone-count]");
  const datalist = root.querySelector("#dp-lieux");
  data.places.forEach((place) => datalist.append(new Option(placeLabel(place))));

  const map = L.map(root.querySelector("[data-zone-map]"), { scrollWheelZoom: false, zoomControl: false });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const home = L.circleMarker([48.5835, 7.7459], { radius: 7, color: "#fff", weight: 3, fillColor: "#101014", fillOpacity: 1 }).addTo(map);
  const zone = L.circle([48.5835, 7.7459], { radius: 10000, color: "#f15a3b", weight: 2, dashArray: "6 6", fillColor: "#f15a3b", fillOpacity: 0.14, interactive: false }).addTo(map);
  let place = data.places.find((p) => p.key === state.placeKey) || null;

  function drawZone() {
    const radiusKm = Number(radiusInput.value);
    radiusLabel.textContent = `${radiusKm} km`;
    if (!place) {
      zoneCount.textContent = "";
      map.setView([48.5835, 7.7459], 11);
      return;
    }
    const center = [place.lat, place.lon];
    home.setLatLng(center);
    zone.setLatLng(center).setRadius(radiusKm * 1000);
    map.fitBounds(zone.getBounds(), { padding: [16, 16] });
    // Open requests of the demo whose blurred position lies inside the zone.
    const open = place.missions.filter((m) => m.distanceKm <= radiusKm).length;
    zoneCount.textContent = open ? `${open} ${open > 1 ? "demandes ouvertes" : "demande ouverte"} dans cette zone` : "Pas encore de demande dans cette zone";
  }

  function pickPlace(query) {
    const found = rankPlaces(query || "", data.places)[0] || null;
    place = found;
    state.placeKey = found ? found.key : null;
    placeHint.textContent = found
      ? `Point de départ : ${placeLabel(found)}. Votre adresse exacte ne sera demandée qu’à l’ouverture des comptes.`
      : query ? "Lieu inconnu pour l’instant : Q DEAL couvre Strasbourg et ses environs." : "Un quartier ou un code postal suffit. Strasbourg et ses environs pour l’instant.";
    addressInput.classList.toggle("is-invalid", Boolean(query) && !found);
    drawZone();
  }

  if (place) addressInput.value = placeLabel(place);
  if (state.rayon) radiusInput.value = state.rayon;
  addressInput.addEventListener("change", () => { pickPlace(addressInput.value.trim()); update(); });
  radiusInput.addEventListener("input", () => { state.rayon = Number(radiusInput.value); drawZone(); update(); });

  /* Week: slots × days ----------------------------------------------------------- */
  const week = root.querySelector("[data-week]");
  const weekSummary = root.querySelector("[data-week-summary]");
  const cells = new Map();
  const narrow = window.matchMedia("(max-width: 560px)");
  week.append(el("div"));
  DAYS.forEach((day) => {
    const head = el("div", `dp-week-day${day.weekend ? " is-weekend" : ""}`, narrow.matches ? day.short : day.label);
    head.setAttribute("aria-label", day.name);
    week.append(head);
  });
  SLOTS.forEach((slot) => {
    const label = el("div", "dp-week-slot", slot.label);
    label.append(el("span", "", slot.hours));
    week.append(label);
    DAYS.forEach((day) => {
      const key = `${day.key}-${slot.key}`;
      const cell = el("label", "dp-cell");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "creneaux";
      input.value = key;
      input.checked = state.week.includes(key);
      input.setAttribute("aria-label", `${day.name} ${slot.label.toLowerCase()}, ${slot.hours}`);
      cell.append(input);
      week.append(cell);
      cells.set(key, { input, day, slot });
    });
  });
  week.addEventListener("change", () => { readWeek(); update(); });
  root.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
    const rule = PRESETS[button.dataset.preset];
    cells.forEach(({ input, day, slot }) => { input.checked = rule(day, slot); });
    readWeek();
    update();
    live.textContent = weekSummary.textContent;
  }));

  function readWeek() {
    state.week = [...cells.entries()].filter(([, { input }]) => input.checked).map(([key]) => key);
    const hours = state.week.reduce((sum, key) => sum + cells.get(key).slot.duration, 0);
    weekSummary.textContent = state.week.length
      ? `${state.week.length} ${state.week.length > 1 ? "créneaux cochés" : "créneau coché"} · environ ${hours} h par semaine`
      : "Aucun créneau coché : vous ne recevrez pas de demande.";
  }

  /* Unavailable periods ------------------------------------------------------------ */
  const periodsList = root.querySelector("[data-periods]");
  const periodForm = root.querySelector("[data-period-form]");
  const periodOpen = root.querySelector("[data-period-open]");
  const fromInput = root.querySelector("#dp-du");
  const toInput = root.querySelector("#dp-au");
  const reasonInput = root.querySelector("#dp-motif");

  function renderPeriods() {
    periodsList.replaceChildren(...state.periods.map((period, index) => {
      const item = el("li");
      const from = dateFormat.format(new Date(period.from));
      const to = dateFormat.format(new Date(period.to));
      item.append(el("span", "", `Du ${from} au ${to}${period.reason ? ` · ${period.reason}` : ""}`));
      const remove = el("button", "", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Retirer cette période");
      remove.addEventListener("click", () => { state.periods.splice(index, 1); renderPeriods(); update(); });
      item.append(remove);
      return item;
    }));
  }
  periodOpen.addEventListener("click", () => {
    periodForm.hidden = !periodForm.hidden;
    if (!periodForm.hidden) fromInput.focus();
  });
  root.querySelector("[data-period-save]").addEventListener("click", () => {
    if (!fromInput.value || !toInput.value || toInput.value < fromInput.value) {
      live.textContent = "Indiquez une date de début et une date de fin, dans l’ordre.";
      (fromInput.value ? toInput : fromInput).focus();
      return;
    }
    state.periods.push({ from: fromInput.value, to: toInput.value, reason: reasonInput.value.trim() });
    state.periods.sort((a, b) => a.from.localeCompare(b.from));
    fromInput.value = toInput.value = reasonInput.value = "";
    periodForm.hidden = true;
    renderPeriods();
    update();
    periodOpen.focus();
  });

  /* Progress, preview and saving --------------------------------------------------- */
  const steps = {
    vous: () => Boolean(form.elements.prenom.value.trim() && form.elements.nom.value.trim() && form.elements.email.validity.valid && form.elements.email.value && /^\d{14}$/.test(form.elements.siret.value.replace(/\s/g, ""))),
    services: () => state.services.length > 0,
    zone: () => Boolean(place),
    dispos: () => state.week.length > 0,
  };
  const order = ["vous", "services", "zone", "dispos"];
  const progressBar = root.querySelector("[data-progress-bar]");
  const progressText = root.querySelector("[data-progress-text]");
  const previewName = root.querySelector("[data-preview-name]");
  const previewAvatar = root.querySelector("[data-preview-avatar]");
  const previewServices = root.querySelector("[data-preview-services]");
  const skillLabel = new Map(data.skills.map((skill) => [skill.code, skill.fr]));

  function update() {
    state.services = [...form.querySelectorAll('input[name="services"]:checked')].map((input) => input.value);
    const done = order.map((key) => steps[key]());
    const current = done.indexOf(false);
    order.forEach((key, index) => {
      const link = root.querySelector(`[data-step="${key}"]`);
      const status = root.querySelector(`[data-status="${key}"]`);
      const card = root.querySelector(`#dp-${key}`);
      link.classList.toggle("is-done", done[index]);
      link.classList.toggle("is-current", index === current);
      card.classList.toggle("is-current", index === current);
      status.className = `dp-status${done[index] ? " is-done" : index === current ? " is-current" : ""}`;
      status.textContent = done[index] ? "Complété" : index === current ? "En cours" : "À faire";
    });
    const count = done.filter(Boolean).length;
    progressBar.style.width = `${(count / order.length) * 100}%`;
    progressText.textContent = count === order.length ? "Profil complet : enregistrez pour voir les demandes." : `Étape ${current + 1} sur 4`;
    const firstName = form.elements.prenom.value.trim();
    previewName.textContent = firstName || "Votre prénom";
    previewAvatar.textContent = firstName ? firstName[0].toUpperCase() : "?";
    const names = state.services.map((code) => skillLabel.get(code));
    previewServices.textContent = names.length ? (names.length > 4 ? `${names.slice(0, 4).join(" · ")} et ${names.length - 4} autres` : names.join(" · ")) : "Vos services";
    persist();
  }

  ["prenom", "nom", "email", "tel", "siret"].forEach((name) => {
    if (state[name]) form.elements[name].value = state[name];
    form.elements[name].addEventListener("input", () => { state[name] = form.elements[name].value; update(); });
  });
  form.elements.etudiant.checked = state.etudiant !== false;
  form.elements.etudiant.addEventListener("change", () => { state.etudiant = form.elements.etudiant.checked; persist(); });
  if (state.transport) form.querySelectorAll('input[name="transport"]').forEach((input) => { input.checked = input.value === state.transport; });
  form.querySelectorAll('input[name="transport"]').forEach((input) => input.addEventListener("change", () => { state.transport = input.value; persist(); }));
  if (state.preavis) form.elements.preavis.value = state.preavis;
  form.elements.preavis.addEventListener("change", () => { state.preavis = form.elements.preavis.value; persist(); });
  form.elements.urgent.checked = state.urgent !== false;
  form.elements.urgent.addEventListener("change", () => { state.urgent = form.elements.urgent.checked; persist(); });
  form.elements.pause.checked = Boolean(state.pause);
  form.elements.pause.addEventListener("change", () => { state.pause = form.elements.pause.checked; persist(); });
  servicesBox.addEventListener("change", update);

  const saved = root.querySelector("[data-saved]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const missing = order.find((key) => !steps[key]());
    if (missing) {
      const card = root.querySelector(`#dp-${missing}`);
      card.scrollIntoView({ block: "start", behavior: "smooth" });
      const field = card.querySelector("input:not([type=checkbox]):not([type=radio]):not([type=range]), input[type=checkbox]");
      if (field) field.focus({ preventScroll: true });
      live.textContent = `Il manque l’étape « ${root.querySelector(`[data-step="${missing}"]`).textContent.trim()} ».`;
      return;
    }
    state.savedAt = new Date().toISOString();
    persist();
    saved.hidden = false;
    saved.replaceChildren("Profil enregistré sur cet appareil. ");
    const link = el("a", "", "Voir les demandes près de chez vous");
    link.href = `prestations.html?lieu=${encodeURIComponent(place.key)}`;
    saved.append(link);
    live.textContent = saved.textContent;
  });

  pickPlace(addressInput.value.trim());
  readWeek();
  renderPeriods();
  update();
})();
