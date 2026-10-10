/* Student portal: student-*.html — the student's own space (dashboard, finding a prestation,
   applications, planning, administrative file, profile, notifications).

   Where the data comes from. The prestations are read from assets/demo/missions.js, the snapshot
   that db/scripts/export-demo.sh produces by calling the real database functions
   (api.missions_near_provider) on fictional data. missions.html reads the same file. Three rules of
   db/migrations/20261010150200_location_api.sql are replayed here, exactly as the database applies
   them: a prestation is only acceptable when the student has every skill it requires (QD003) and
   when it sits inside their travel radius (QD004), and example prestations can never be accepted.
   Accepting reveals the exact address (api.accept_mission), which the snapshot carries in
   acceptedState.

   What is not in the database yet. The site is static: there is no account, no session, no server.
   Everything the student does — candidatures, profile, dossier, notifications read — is kept in
   this browser under one localStorage key, and each action names the api function that will carry
   it once an API exists. core.providers holds a first name, a last name, a position, a travel
   radius and an active flag: contact details, studies, availability and experience have no column
   yet, candidature review has no status beyond the provider's own accepted/declined, and the
   administrative dossier has no table at all. The pages say so where it matters.

   Administrative documents are never uploaded. GitHub Pages serves a public folder, so the dossier
   keeps the file name the student picked and nothing else — no file content, anywhere. */
(() => {
  const data = window.QDEAL_MISSIONS;
  const page = document.body.dataset.portalPage;
  if (!data || !page) return;

  /* ---------------------------------------------------------------- texts and helpers */
  const locale = "fr-FR";
  const plural = (n, one, many) => (n > 1 ? many : one);
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const oneDecimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const skillLabel = new Map(data.skills.map((skill) => [skill.code, skill.fr]));
  const groupLabel = new Map(data.groups.map((group) => [group.code, group.fr]));
  const SECTORS = {
    btp: "BTP", commerce: "Commerce", conciergerie: "Conciergerie", syndic: "Syndic de copropriété",
    evenementiel: "Événementiel", particulier: "Particulier", entreprise: "Entreprise", automobile: "Automobile",
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text, onClick) => {
    const node = el("button", className, text);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  };
  const link = (className, text, href) => {
    const node = el("a", className, text);
    node.href = href;
    return node;
  };
  const dateFromDays = (days) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date;
  };
  const startsLabel = (days) => {
    const when = days <= 0 ? "Aujourd’hui" : days === 1 ? "Demain" : `Dans ${days} jours`;
    return `${when} · ${dateFormat.format(dateFromDays(days))}`;
  };
  const stamp = (iso) => (iso ? shortDate.format(new Date(iso)) : "");
  const live = document.querySelector("[data-live]");
  const announce = (message) => { if (live) live.textContent = message; };

  /* ---------------------------------------------------------------- the student’s own state */
  /* One key, this browser only. An API would replace reads with the api functions named below. */
  const STORE_KEY = "qdeal.portal.v1";
  const DEFAULT_STATE = {
    studentId: 5,          // the fictional provider of db/fixtures/dev.sql used by this demo session
    placeKey: "strasbourg",
    radiusKm: 10,          // core.providers.travel_radius_km, 1 to 50
    zoneConfirmed: false,
    profile: {},
    skills: null,          // null = the skills the snapshot gives this provider
    responses: {},         // mission id -> { status, at, placeKey, done, doneAt }
    documents: {},         // document code -> { state, fileName, at }
    read: [],              // notification ids already read
  };

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return { ...DEFAULT_STATE, ...stored };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }
  let state = readState();
  let storageWorks = true;
  function save(changes) {
    state = { ...state, ...changes };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      storageWorks = false;  // private window, or storage full: the page still works for this visit
    }
  }

  const studentsById = (() => {
    // The only provider data the api returns: api.mission_applicants (first name, skills, rating).
    const seen = new Map();
    data.business.addresses.forEach((address) => address.candidates.forEach((candidate) => {
      if (!seen.has(candidate.id)) seen.set(candidate.id, candidate);
    }));
    return seen;
  })();
  const students = [...studentsById.values()].sort((a, b) => a.id - b.id);
  const student = studentsById.get(state.studentId) || students[0];
  const mySkills = state.skills || student.skills;
  const place = data.places.find((entry) => entry.key === state.placeKey) || data.places[0];
  const placeLabel = (entry) => entry.labelFr;

  /* ---------------------------------------------------------------- the administrative dossier */
  /* Indicative list: no table, no api function and no validated list of documents exists yet. The
     statuses beyond « manquant » and « prêt à transmettre » can only come from the future back end. */
  const DOCUMENTS = [
    { code: "identite", label: "Pièce d’identité", hint: "Carte d’identité, passeport ou titre de séjour en cours de validité." },
    { code: "statut_etudiant", label: "Justificatif de statut étudiant", hint: "Certificat de scolarité ou carte étudiante de l’année en cours." },
    { code: "siret", label: "Attestation d’inscription URSSAF", hint: "Votre numéro SIRET d’auto-entrepreneur, nécessaire pour facturer vos prestations." },
    { code: "rc_pro", label: "Responsabilité civile professionnelle", hint: "L’attestation de votre assurance, qui couvre les dommages causés pendant une prestation." },
    { code: "rib", label: "Coordonnées bancaires (RIB)", hint: "Pour recevoir le paiement de vos prestations." },
    { code: "autorisation_travail", label: "Autorisation de travail", hint: "Demandée aux étudiants hors Union européenne dont le titre de séjour l’exige.", optional: true },
  ];
  const DOC_STATES = {
    missing: { label: "Manquant", className: "is-missing", note: "Document à fournir." },
    prepared: { label: "Prêt à transmettre", className: "is-sent", note: "Choisi sur votre appareil. La transmission attend l’espace sécurisé de Q DEAL." },
    pending: { label: "En attente de vérification", className: "is-review", note: "Reçu par Q DEAL, en cours de vérification." },
    validated: { label: "Validé", className: "is-accepted", note: "Vérifié et accepté par Q DEAL." },
    rejected: { label: "Refusé", className: "is-refused", note: "Refusé par Q DEAL : le motif est indiqué et le document peut être remplacé." },
  };
  const docState = (code) => DOC_STATES[(state.documents[code] || {}).state] ? state.documents[code].state : "missing";
  const dossier = () => {
    const rows = DOCUMENTS.map((document) => ({ ...document, state: docState(document.code), file: state.documents[document.code] || {} }));
    const required = rows.filter((row) => !row.optional);
    return {
      rows,
      missing: required.filter((row) => row.state === "missing").length,
      done: required.filter((row) => row.state === "validated").length,
      required: required.length,
      rejected: rows.filter((row) => row.state === "rejected"),
      complete: required.every((row) => row.state === "validated"),
    };
  };

  /* ---------------------------------------------------------------- the prestations */
  const AVAILABILITY = [
    { code: "semaine_matin", label: "Semaine · matin" }, { code: "semaine_aprem", label: "Semaine · après-midi" },
    { code: "semaine_soir", label: "Semaine · soirée" }, { code: "samedi", label: "Samedi" },
    { code: "dimanche", label: "Dimanche" }, { code: "vacances", label: "Vacances scolaires" },
  ];
  const responseOf = (id) => state.responses[id];
  const hasApplied = (id) => (responseOf(id) || {}).status === "sent";
  const isQualified = (row) => row.skills.every((code) => mySkills.includes(code));
  const isInRadius = (row) => row.distanceKm <= state.radiusKm;

  // Same shape as api.missions_near_provider: the real prestations of the zone, topped up with
  // examples while the zone is quiet (core.config.examples_target).
  function rowsOf(entry) {
    const byDistance = (a, b) => a.distanceKm - b.distanceKm || a.startsInDays - b.startsInDays;
    const real = entry.missions
      .filter((mission) => (responseOf(mission.id) || {}).status !== "withdrawn")
      .map((mission) => decorate(mission, entry))
      .sort(byDistance);
    const open = real.filter((row) => !row.applied).length;
    const examples = entry.examples
      .map((example) => ({
        ...example, key: `e${example.exampleId}`, id: null, isExample: true, title: example.titleFr,
        applied: false, qualified: isQualified(example), inRadius: isInRadius(example), placeKey: entry.key,
      }))
      .slice(0, Math.max(0, data.config.examplesTarget - open))
      .sort(byDistance);
    return [...real, ...examples];
  }

  function decorate(mission, entry) {
    const response = responseOf(mission.id) || {};
    const applied = response.status === "sent";
    const exact = applied ? entry.acceptedState[mission.id] : null;
    return {
      ...mission, ...(exact || {}), key: `m${mission.id}`, isExample: false,
      applied, response, placeKey: entry.key,
      qualified: isQualified(mission), inRadius: isInRadius(mission),
      done: Boolean(response.done),
    };
  }

  // A prestation the student answered: looked up where they answered it, so the distance and the
  // exact address stay the ones they were shown.
  function appliedRows() {
    return Object.keys(state.responses)
      .map(Number)
      .filter((id) => hasApplied(id))
      .map((id) => {
        const response = state.responses[id];
        const entry = data.places.find((p) => p.key === response.placeKey && p.missions.some((m) => m.id === id))
          || data.places.find((p) => p.missions.some((m) => m.id === id));
        if (!entry) return null;
        return decorate(entry.missions.find((m) => m.id === id), entry);
      })
      .filter(Boolean)
      .sort((a, b) => a.startsInDays - b.startsInDays);
  }

  const phaseOf = (row) => (row.done ? "done" : row.startsInDays <= 0 ? "today" : "next");
  const openForMe = () => rowsOf(place).filter((row) => !row.isExample && !row.applied && row.qualified && row.inRadius);

  /* ---------------------------------------------------------------- candidature statuses */
  /* « Envoyée » and « Retirée » are the two states core.mission_responses stores today
     (accepted / declined). The three others belong to the business-side choice that
     db/README.md still lists as undecided, so nothing here ever sets them. */
  const APPLICATION_STATES = {
    sent: { label: "Envoyée", className: "is-sent", hint: "L’entreprise voit votre candidature et choisit un prestataire." },
    review: { label: "En cours d’examen", className: "is-review", hint: "L’entreprise étudie les candidatures reçues." },
    accepted: { label: "Acceptée", className: "is-accepted", hint: "Vous êtes retenu : la prestation passe dans votre planning." },
    refused: { label: "Refusée", className: "is-refused", hint: "L’entreprise a retenu un autre prestataire." },
    withdrawn: { label: "Retirée", className: "is-missing", hint: "Vous avez retiré votre candidature." },
  };
  const BACKEND_STATES = ["review", "accepted", "refused"];

  function statusBadge(key) {
    const status = APPLICATION_STATES[key] || APPLICATION_STATES.sent;
    return el("span", `sp-status ${status.className}`, status.label);
  }

  /* ---------------------------------------------------------------- profile completion */
  function profileSteps() {
    const profile = state.profile;
    const file = dossier();
    return [
      { label: "Zone et rayon de déplacement confirmés", done: state.zoneConfirmed, href: "student-profile.html" },
      { label: "Au moins une compétence", done: mySkills.length > 0, href: "student-profile.html" },
      { label: "Téléphone", done: Boolean(profile.phone), href: "student-profile.html" },
      { label: "Adresse e-mail", done: Boolean(profile.email), href: "student-profile.html" },
      { label: "Disponibilités", done: Boolean((profile.availability || []).length), href: "student-profile.html" },
      { label: "Dossier administratif complet", done: file.complete, href: "student-documents.html" },
    ];
  }

  /* ---------------------------------------------------------------- notifications */
  /* Every notification is derived: from what the student did, or from the prestations of the
     snapshot. None is invented, and none carries a date that is not known. */
  function notifications() {
    const rows = [];
    const file = dossier();
    appliedRows().forEach((row) => {
      rows.push({
        id: `sent-${row.id}`, kind: "candidature", level: "info", at: row.response.at,
        title: "Candidature envoyée", body: `${row.title} · ${row.business}`, href: "student-applications.html",
      });
      if (!row.done && row.startsInDays <= 1) rows.push({
        id: `soon-${row.id}`, kind: "prestation", level: "alert",
        title: row.startsInDays <= 0 ? "Une prestation commence aujourd’hui" : "Une prestation commence demain",
        body: `${row.title} · ${row.address || `${row.postalCode} ${row.city}`}`, href: "student-schedule.html",
      });
    });
    if (file.missing) rows.push({
      id: `dossier-${file.missing}`, kind: "dossier", level: "alert",
      title: `${file.missing} ${plural(file.missing, "document manquant", "documents manquants")}`,
      body: "Votre dossier doit être complet avant votre première prestation.", href: "student-documents.html",
    });
    file.rejected.forEach((row) => rows.push({
      id: `doc-refuse-${row.code}`, kind: "dossier", level: "alert",
      title: `Document refusé : ${row.label}`, body: row.file.reason || "Un motif est indiqué dans votre dossier.", href: "student-documents.html",
    }));
    if (!state.zoneConfirmed) rows.push({
      id: "zone", kind: "profil", level: "info",
      title: "Confirmez votre zone de déplacement",
      body: "Elle décide des prestations qui vous sont proposées.", href: "student-profile.html",
    });
    openForMe().slice(0, 3).forEach((row) => rows.push({
      id: `match-${row.id}`, kind: "prestation", level: "info",
      title: "Nouvelle prestation pour vos compétences",
      body: `${row.title} · ${row.postalCode} ${row.city} · ≈ ${row.distanceKm} km`,
      href: `student-task.html?prestation=${row.id}&lieu=${row.placeKey}`,
    }));
    const order = { alert: 0, info: 1 };
    return rows
      .map((row) => ({ ...row, read: state.read.includes(row.id) }))
      .sort((a, b) => order[a.level] - order[b.level] || (b.at || "").localeCompare(a.at || ""));
  }
  const unreadCount = () => notifications().filter((row) => !row.read).length;

  /* ---------------------------------------------------------------- the portal shell */
  const NS = "http://www.w3.org/2000/svg";
  const ICONS = {
    grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
    search: ["M10.5 3.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "m15.5 15.5 5 5"],
    send: ["M21 3 10.5 13.5", "M21 3l-6.5 18-4-7.5-7.5-4z"],
    calendar: ["M4 6.5h16v14H4z", "M4 10.5h16", "M8.5 3.5v4", "M15.5 3.5v4"],
    file: ["M6 3.5h7l5 5v12H6z", "M13 3.5v5h5"],
    user: ["M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4.5 20.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"],
    bell: ["M18 16.5V11a6 6 0 0 0-12 0v5.5L4.5 19h15z", "M9.5 19a2.5 2.5 0 0 0 5 0"],
    check: ["m5 12.5 4.5 4.5L19 7"],
    alert: ["M12 3.5 21.5 20H2.5z", "M12 10v4.5", "M12 17.3v.2"],
    pin: ["M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
    clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5V12l3.5 2"],
    building: ["M4.5 20.5v-15h10v15", "M14.5 10.5h5v10", "M7.5 9h4", "M7.5 13h4"],
    back: ["M10 5H5v14h5", "m14 8 4 4-4 4", "M18 12H8"],
  };
  function icon(name) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    (ICONS[name] || []).forEach((d) => {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      svg.append(path);
    });
    return svg;
  }

  const NAV = [
    { key: "dashboard", href: "student-portal.html", label: "Tableau de bord", icon: "grid" },
    { key: "tasks", href: "student-tasks.html", label: "Trouver une prestation", icon: "search", also: ["task"] },
    { key: "applications", href: "student-applications.html", label: "Mes candidatures", icon: "send", count: () => appliedRows().filter((row) => phaseOf(row) !== "done").length },
    { key: "schedule", href: "student-schedule.html", label: "Mes prestations", icon: "calendar", count: () => appliedRows().filter((row) => phaseOf(row) === "next").length },
    { key: "documents", href: "student-documents.html", label: "Suivi administratif", icon: "file", count: () => dossier().missing, alert: true },
    { key: "profile", href: "student-profile.html", label: "Mon profil", icon: "user" },
    { key: "notifications", href: "student-notifications.html", label: "Notifications", icon: "bell", count: () => unreadCount(), alert: true },
  ];

  const sidebar = document.querySelector("[data-portal-nav]");
  const backdrop = document.querySelector("[data-portal-backdrop]");
  const main = document.querySelector(".sp-main");
  let burger = null;

  function setDrawer(open) {
    sidebar.classList.toggle("is-open", open);
    backdrop.hidden = !open;
    document.body.classList.toggle("sp-locked", open);
    if (burger) {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    }
    if (open) sidebar.querySelector("a, button")?.focus();
    else burger?.focus();
  }

  function renderNav() {
    const list = el("ul", "sp-nav");
    NAV.forEach((item) => {
      const row = el("li");
      const current = item.key === page || (item.also || []).includes(page);
      const anchor = link(`sp-nav-link${current ? " is-current" : ""}`, "", item.href);
      if (current) anchor.setAttribute("aria-current", "page");
      anchor.append(icon(item.icon), el("span", "sp-nav-label", item.label));
      const total = item.count ? item.count() : 0;
      if (total) {
        const badge = el("span", `sp-nav-count${item.alert ? " is-alert" : ""}`, String(total));
        badge.setAttribute("aria-label", `${total} à traiter`);
        anchor.append(badge);
      }
      row.append(anchor);
      list.append(row);
    });
    const help = el("div", "sp-nav-foot");
    help.append(
      link("sp-nav-back", "Retour au site Q DEAL", "index.html"),
      link("sp-nav-back", "Contacter Q DEAL", "contact.html?type=worker#contact-form"),
    );
    sidebar.replaceChildren(el("p", "sp-nav-title", "Espace étudiant"), list, help);
  }

  function renderTopbar() {
    const bar = document.querySelector("[data-portal-topbar]");
    burger = button("sp-burger", "", () => setDrawer(!sidebar.classList.contains("is-open")));
    burger.setAttribute("aria-controls", "sp-sidebar");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Ouvrir le menu");
    burger.append(el("span"), el("span"), el("span"));

    const brand = link("sp-brand", "", "student-portal.html");
    const logo = el("img");
    logo.src = "assets/images/qdeal-logo.svg";
    logo.alt = "Q DEAL";
    logo.width = 954;
    logo.height = 323;
    brand.append(logo, el("span", "sp-brand-tag", "Espace étudiant"));

    const session = el("details", "sp-session");
    const head = el("summary");
    head.append(el("span", "loc-avatar sp-avatar", student.firstName.slice(0, 1)), el("span", "sp-session-name", student.firstName));
    const panel = el("div", "sp-session-panel");
    const identity = el("p", "sp-session-identity");
    identity.append(el("b", "", student.firstName), el("span", "", student.rating
      ? `★ ${oneDecimal.format(student.rating)} · ${student.reviewCount} ${plural(student.reviewCount, "avis", "avis")}`
      : "Pas encore d’avis"));
    panel.append(identity);

    const picker = el("div", "field sp-session-field");
    const pickerLabel = el("label", "", "Étudiant de la session de démonstration");
    pickerLabel.htmlFor = "sp-student";
    const select = el("select");
    select.id = "sp-student";
    students.forEach((entry) => {
      const option = new Option(`${entry.firstName} · ${entry.skills.length} ${plural(entry.skills.length, "compétence", "compétences")}`, String(entry.id));
      option.selected = entry.id === student.id;
      select.append(option);
    });
    select.addEventListener("change", () => {
      save({ studentId: Number(select.value), skills: null });
      window.location.reload();
    });
    picker.append(pickerLabel, select, el("small", "", "Chaque étudiant ne voit que ses compétences, sa zone et ses candidatures."));
    panel.append(picker);

    panel.append(button("sp-session-reset", "Réinitialiser cet espace", () => {
      if (!window.confirm("Effacer vos candidatures, votre profil et votre dossier enregistrés dans ce navigateur ?")) return;
      try { localStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ }
      window.location.reload();
    }));
    session.append(head, panel);
    document.addEventListener("click", (event) => { if (!session.contains(event.target)) session.open = false; });

    bar.replaceChildren(burger, brand, el("div", "sp-topbar-spacer"), session);
  }

  function renderNotice() {
    const notice = el("aside", "sp-notice");
    notice.append(icon("alert"));
    const body = el("div");
    body.append(
      el("b", "", "Espace de démonstration"),
      el("p", "", "Les prestations viennent de l’instantané des fonctions de la base, sur des données fictives. Vos candidatures, votre profil et votre dossier sont enregistrés dans ce navigateur : il n’y a pas encore de compte ni de serveur."),
    );
    if (!storageWorks) body.append(el("p", "", "Ce navigateur refuse l’enregistrement local : vos actions seront perdues en quittant la page."));
    notice.append(body);
    main.prepend(notice);
  }

  /* ---------------------------------------------------------------- shared pieces */
  function emptyState(title, body, action) {
    const box = el("div", "sp-empty");
    box.append(el("p", "sp-empty-title", title), el("p", "sp-empty-body", body));
    if (action) box.append(link("button button-dark", action.label, action.href));
    return box;
  }

  function skillList(row) {
    const list = el("ul", "loc-skills");
    row.skills.forEach((code) => {
      const match = mySkills.includes(code);
      const item = el("li", `loc-skill${match ? " is-match" : " sp-skill-missing"}`, skillLabel.get(code) || code);
      item.title = match ? "Vous avez cette compétence" : "Compétence absente de votre profil";
      list.append(item);
    });
    return list;
  }

  // The two refusals api.accept_mission can raise for a student, plus the example rule.
  function blockReason(row) {
    if (row.isExample) return { text: "Prestation d’exemple : elle montre le type de prestation publié dans votre zone et ne peut pas être acceptée." };
    if (!row.qualified) {
      const missing = row.skills.filter((code) => !mySkills.includes(code)).map((code) => skillLabel.get(code) || code);
      return { text: `${plural(missing.length, "Compétence requise manquante", "Compétences requises manquantes")} : ${missing.join(", ")}.`, fix: { label: "Ajouter à mon profil", href: "student-profile.html" } };
    }
    if (!row.inRadius) return { text: `À ≈ ${row.distanceKm} km, au-delà de votre rayon de ${state.radiusKm} km.`, fix: { label: "Élargir ma zone", href: "student-profile.html" } };
    return null;
  }

  function apply(row, onDone) {
    const blocked = blockReason(row);
    if (blocked || row.applied) return;
    const responses = { ...state.responses, [row.id]: { status: "sent", at: new Date().toISOString(), placeKey: row.placeKey } };
    save({ responses });
    announce(`Candidature envoyée pour « ${row.title} ». L’adresse exacte est maintenant affichée.`);
    onDone();
  }

  function withdraw(row, onDone) {
    const responses = { ...state.responses, [row.id]: { ...state.responses[row.id], status: "withdrawn", at: new Date().toISOString() } };
    save({ responses });
    announce(`Candidature retirée pour « ${row.title} ».`);
    onDone();
  }

  function markDone(row, done, onDone) {
    const responses = { ...state.responses, [row.id]: { ...state.responses[row.id], done, doneAt: done ? new Date().toISOString() : null } };
    save({ responses });
    announce(done ? `Prestation « ${row.title} » marquée comme effectuée.` : `Prestation « ${row.title} » remise dans les prestations à venir.`);
    onDone();
  }

  const detailHref = (row) => `student-task.html?prestation=${row.id}&lieu=${row.placeKey}`;

  function placeText(row) {
    if (row.isExample) return "Position approximative, à 1 km près";
    if (row.applied && row.address) return `${row.address}, ${row.postalCode} ${row.city}`;
    return `${row.postalCode} ${row.city} · position à 1 km près`;
  }

  function metaRow(row) {
    const meta = el("ul", "sp-meta");
    const add = (name, text) => {
      if (!text) return;
      const item = el("li");
      item.append(icon(name), el("span", "", text));
      meta.append(item);
    };
    add("building", row.business || SECTORS[row.sector] || "");
    add("clock", startsLabel(row.startsInDays));
    add("pin", row.applied ? `${oneDecimal.format(row.distanceKm)} km de votre zone` : `≈ ${row.distanceKm} km`);
    return meta;
  }

  /* mode: "search" (open prestations), "application" (candidatures), "schedule" (planning) */
  function missionCard(row, mode, refresh) {
    const card = el("li", `sp-card${row.isExample ? " is-example" : ""}${row.applied ? " is-mine" : ""}`);
    const head = el("div", "sp-card-head");
    if (mode === "application") head.append(statusBadge(row.response.status || "sent"));
    else if (mode === "schedule") head.append(el("span", `sp-status ${row.done ? "is-accepted" : phaseOf(row) === "today" ? "is-review" : "is-sent"}`,
      row.done ? "Terminée" : phaseOf(row) === "today" ? "En cours" : "À venir"));
    else head.append(el("span", `sp-status ${row.isExample ? "is-missing" : row.applied ? "is-sent" : "is-open"}`,
      row.isExample ? "Exemple" : row.applied ? "Candidature envoyée" : "Ouverte"));
    if (mode === "application" && row.response.at) head.append(el("span", "sp-card-date", `Envoyée le ${stamp(row.response.at)}`));
    card.append(head);

    const title = row.isExample ? el("p", "sp-card-title", row.title) : link("sp-card-title", row.title, detailHref(row));
    card.append(title, metaRow(row), skillList(row));
    card.append(el("p", "sp-card-place", placeText(row)));

    const blocked = blockReason(row);
    if (mode === "search" && blocked) {
      const note = el("p", "sp-reason");
      note.append(el("span", "", blocked.text));
      if (blocked.fix) note.append(link("sp-link", blocked.fix.label, blocked.fix.href));
      card.append(note);
    }

    const actions = el("div", "sp-card-actions");
    if (mode === "search") {
      if (!row.isExample) actions.append(link("button button-outline", "Voir le détail", detailHref(row)));
      if (!row.isExample && !row.applied && !blocked) actions.append(button("button button-dark", "Postuler", () => apply(row, refresh)));
      if (row.applied) actions.append(link("sp-link", "Suivre ma candidature", "student-applications.html"));
    }
    if (mode === "application") {
      actions.append(link("button button-outline", "Voir le détail", detailHref(row)));
      if (row.response.status === "sent") actions.append(button("sp-link sp-link-danger", "Retirer ma candidature", () => withdraw(row, refresh)));
    }
    if (mode === "schedule") {
      actions.append(link("button button-outline", "Voir le détail", detailHref(row)));
      actions.append(button("button button-dark", row.done ? "Remettre à venir" : "Marquer comme effectuée", () => markDone(row, !row.done, refresh)));
      if (!row.done) actions.append(button("sp-link sp-link-danger", "Me désister", () => withdraw(row, refresh)));
    }
    if (actions.childElementCount) card.append(actions);
    return card;
  }

  function tabs(container, entries, active, onPick) {
    container.replaceChildren(...entries.map((entry) => {
      const node = button(`sp-tab${entry.key === active ? " is-active" : ""}`, entry.label, () => onPick(entry.key));
      node.setAttribute("aria-pressed", String(entry.key === active));
      if (entry.count !== undefined) node.append(el("span", "sp-tab-count", String(entry.count)));
      return node;
    }));
  }

  /* ---------------------------------------------------------------- dashboard */
  function progressBar(done, total) {
    const percent = total ? Math.round((done / total) * 100) : 0;
    const box = el("div", "sp-progress");
    const track = el("div", "sp-progress-track");
    const fill = el("div", "sp-progress-fill");
    fill.style.width = `${percent}%`;
    track.append(fill);
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuenow", String(percent));
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-label", `${percent} % complété`);
    box.append(track, el("p", "sp-progress-value", `${percent} % · ${done} sur ${total}`));
    return box;
  }

  function renderDashboard() {
    const applied = appliedRows();
    const pending = applied.filter((row) => phaseOf(row) !== "done");
    const next = applied.filter((row) => phaseOf(row) === "next");
    const today = applied.filter((row) => phaseOf(row) === "today");
    const done = applied.filter((row) => phaseOf(row) === "done");
    const open = openForMe();
    const file = dossier();
    const steps = profileSteps();
    const refresh = () => renderDashboard();

    document.querySelector("[data-greeting]").textContent = `Bonjour ${student.firstName}`;
    document.querySelector("[data-lede]").textContent = `Votre zone est ${placeLabel(place)}, avec un rayon de ${state.radiusKm} km. ${open.length
      ? `${open.length} ${plural(open.length, "prestation correspond", "prestations correspondent")} à vos compétences en ce moment.`
      : "Aucune prestation ne correspond à vos compétences dans cette zone pour l’instant."}`;

    const statsList = document.querySelector("[data-stats]");
    const stats = [
      { value: pending.length, label: plural(pending.length, "candidature en attente", "candidatures en attente"), href: "student-applications.html" },
      { value: next.length + today.length, label: plural(next.length + today.length, "prestation à venir", "prestations à venir"), href: "student-schedule.html" },
      { value: done.length, label: plural(done.length, "prestation terminée", "prestations terminées"), href: "student-schedule.html" },
      { value: open.length, label: plural(open.length, "prestation ouverte pour vous", "prestations ouvertes pour vous"), href: "student-tasks.html" },
    ];
    statsList.replaceChildren(...stats.map((stat) => {
      const item = el("li", "sp-stat");
      const anchor = link("sp-stat-link", "", stat.href);
      anchor.append(el("b", "", String(stat.value)), el("span", "", stat.label));
      item.append(anchor);
      return item;
    }));

    const alertsBlock = document.querySelector("[data-alerts-block]");
    const alerts = notifications().filter((row) => row.level === "alert").slice(0, 4);
    const missingSteps = steps.filter((step) => !step.done && step.label !== "Dossier administratif complet");
    if (missingSteps.length) alerts.push({
      title: `${missingSteps.length} ${plural(missingSteps.length, "information à compléter", "informations à compléter")} dans votre profil`,
      body: missingSteps.map((step) => step.label).join(", "), href: "student-profile.html",
    });
    alertsBlock.hidden = alerts.length === 0;
    document.querySelector("[data-alerts]").replaceChildren(...alerts.map((row) => {
      const item = el("li", "sp-alert");
      item.append(icon("alert"));
      const body = el("div");
      body.append(el("b", "", row.title), el("p", "", row.body));
      item.append(body, link("sp-link", "Ouvrir", row.href));
      return item;
    }));

    const nextBox = document.querySelector("[data-next]");
    const upcoming = [...today, ...next].slice(0, 3);
    nextBox.replaceChildren(upcoming.length
      ? (() => {
        const list = el("ol", "sp-cards");
        upcoming.forEach((row) => list.append(missionCard(row, "schedule", refresh)));
        return list;
      })()
      : emptyState("Aucune prestation prévue", "Vos prestations apparaîtront ici dès qu’une candidature sera envoyée.", { label: "Trouver une prestation", href: "student-tasks.html" }));

    const progressBox = document.querySelector("[data-progress]");
    const stepList = el("ul", "sp-steps");
    steps.forEach((step) => {
      const item = el("li", `sp-step${step.done ? " is-done" : ""}`);
      item.append(icon(step.done ? "check" : "alert"), el("span", "", step.label));
      if (!step.done) item.append(link("sp-link", "Compléter", step.href));
      stepList.append(item);
    });
    progressBox.replaceChildren(progressBar(steps.filter((step) => step.done).length, steps.length), stepList);

    const dossierBox = document.querySelector("[data-dossier]");
    const summary = el("p", "sp-dossier-summary", file.complete
      ? "Votre dossier est complet."
      : `${file.missing} ${plural(file.missing, "document manquant", "documents manquants")} sur ${file.required} demandés.`);
    dossierBox.replaceChildren(progressBar(file.done, file.required), summary);
    if (file.rejected.length) dossierBox.append(el("p", "sp-reason", `${file.rejected.length} ${plural(file.rejected.length, "document refusé", "documents refusés")} à remplacer.`));

    const notifBox = document.querySelector("[data-notifications]");
    const rows = notifications().slice(0, 3);
    notifBox.replaceChildren(rows.length
      ? (() => {
        const list = el("ol", "sp-notifications is-compact");
        rows.forEach((row) => list.append(notificationRow(row, refresh)));
        return list;
      })()
      : emptyState("Rien de neuf", "Les informations sur vos candidatures, vos prestations et votre dossier arriveront ici."));
    renderNav();
  }

  /* ---------------------------------------------------------------- finding a prestation */
  const RADIUS_CHOICES = [3, 5, 10, 20, 50];

  function renderTasks() {
    const form = document.querySelector("[data-filters]");
    const placeSelect = form.elements.lieu;
    const serviceSelect = form.elements.service;
    const radiusSelect = form.elements.rayon;
    const search = form.elements.q;
    const onlyMine = form.elements.qualified;
    const summary = document.querySelector("[data-summary]");
    const chips = document.querySelector("[data-chips]");
    const list = document.querySelector("[data-list]");
    const params = new URLSearchParams(window.location.search);

    data.places.forEach((entry) => {
      const option = new Option(`${placeLabel(entry)}${entry.missions.length ? "" : " · aucune prestation réelle"}`, entry.key);
      placeSelect.append(option);
    });
    placeSelect.value = place.key;

    serviceSelect.append(new Option("Tous les services", ""));
    data.groups.forEach((group) => {
      const groupNode = el("optgroup");
      groupNode.label = group.fr;
      data.skills.filter((skill) => skill.group === group.code).forEach((skill) => groupNode.append(new Option(skill.fr, skill.code)));
      serviceSelect.append(groupNode);
    });
    const fromUrl = params.get("service");
    serviceSelect.value = data.skills.some((skill) => skill.code === fromUrl) ? fromUrl : "";

    RADIUS_CHOICES.forEach((km) => radiusSelect.append(new Option(`${km} km`, String(km))));
    if (!RADIUS_CHOICES.includes(state.radiusKm)) radiusSelect.append(new Option(`${state.radiusKm} km`, String(state.radiusKm)));
    radiusSelect.value = String(state.radiusKm);
    search.value = params.get("q") || "";
    onlyMine.checked = params.get("competences") === "1";

    const normalize = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

    function render() {
      const query = normalize(search.value);
      const service = serviceSelect.value;
      const rows = rowsOf(place).filter((row) => {
        if (service && !row.skills.includes(service)) return false;
        if (onlyMine.checked && (row.isExample || !row.qualified || !row.inRadius || row.applied)) return false;
        if (!query) return true;
        const haystack = `${row.title} ${row.business || ""} ${SECTORS[row.sector] || ""} ${row.skills.map((code) => skillLabel.get(code)).join(" ")}`;
        return normalize(haystack).includes(query);
      }).filter((row) => row.isExample || row.applied || row.inRadius);

      const real = rows.filter((row) => !row.isExample);
      const examples = rows.length - real.length;
      summary.textContent = !rows.length
        ? "Aucune prestation ne correspond à ces filtres dans cette zone."
        : examples && !real.length
          ? `Pas encore de prestation réelle ici : voici ${examples} ${plural(examples, "exemple", "exemples")} de prestations publiées sur Q DEAL`
          : examples
            ? `${real.length} ${plural(real.length, "prestation", "prestations")} à moins de ${state.radiusKm} km, ${plural(real.length, "complétée", "complétées")} par ${examples} ${plural(examples, "exemple", "exemples")}`
            : `${real.length} ${plural(real.length, "prestation", "prestations")} à moins de ${state.radiusKm} km`;

      chips.replaceChildren();
      const chip = (text, clear) => {
        const item = el("li");
        const node = button("sp-chip", text, () => { clear(); sync(); render(); });
        node.setAttribute("aria-label", `${text} · retirer le filtre`);
        node.append(el("span", "", "×"));
        item.append(node);
        chips.append(item);
      };
      if (service) chip(skillLabel.get(service), () => { serviceSelect.value = ""; });
      if (search.value.trim()) chip(`Mot-clé : ${search.value.trim()}`, () => { search.value = ""; });
      if (onlyMine.checked) chip("Mes compétences seulement", () => { onlyMine.checked = false; });

      list.replaceChildren(...rows.map((row) => missionCard(row, "search", () => { render(); renderNav(); })));
      if (!rows.length) {
        const item = el("li", "sp-empty-item");
        item.append(emptyState("Aucun résultat", "Élargissez votre rayon, changez de zone ou retirez un filtre. Les prestations proposées sont celles publiées autour de vous."));
        list.append(item);
      }
      if (state.radiusKm > 10) list.prepend(el("li", "sp-inline-note", "L’instantané de la base ne contient que les prestations à moins de 10 km du centre de la zone : un rayon plus large n’en ajoute pas."));
    }

    function sync() {
      const next = new URLSearchParams();
      if (serviceSelect.value) next.set("service", serviceSelect.value);
      if (search.value.trim()) next.set("q", search.value.trim());
      if (onlyMine.checked) next.set("competences", "1");
      next.set("lieu", place.key);
      history.replaceState(null, "", `${window.location.pathname}?${next}`);
    }

    placeSelect.addEventListener("change", () => {  // api.set_provider_location, once an API exists
      save({ placeKey: placeSelect.value });
      window.location.search = `?lieu=${placeSelect.value}`;
    });
    radiusSelect.addEventListener("change", () => {
      save({ radiusKm: Number(radiusSelect.value) });
      window.location.reload();
    });
    [serviceSelect, onlyMine].forEach((node) => node.addEventListener("change", () => { sync(); render(); }));
    search.addEventListener("input", () => { sync(); render(); });
    form.addEventListener("submit", (event) => { event.preventDefault(); sync(); render(); });
    form.addEventListener("reset", () => {
      window.setTimeout(() => { serviceSelect.value = ""; search.value = ""; onlyMine.checked = false; sync(); render(); }, 0);
    });
    sync();
    render();
  }

  /* ---------------------------------------------------------------- one prestation */
  function findMission(id, placeKey) {
    const candidates = data.places.filter((entry) => entry.missions.some((mission) => mission.id === id));
    const entry = candidates.find((item) => item.key === placeKey) || candidates[0];
    return entry ? decorate(entry.missions.find((mission) => mission.id === id), entry) : null;
  }

  function detailMap(row) {
    const box = el("div", "sp-map loc-map");
    if (!window.L) return box;
    window.requestAnimationFrame(() => {
      const map = window.L.map(box, { scrollWheelZoom: false });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const css = getComputedStyle(document.documentElement);
      const orange = css.getPropertyValue("--orange").trim();
      const at = [row.lat, row.lon];
      const shape = row.applied
        ? window.L.circleMarker(at, { radius: 9, color: "#fff", weight: 3, fillColor: orange, fillOpacity: 1 })
        : window.L.circle(at, { radius: row.precisionM, color: orange, weight: 1.5, fillColor: orange, fillOpacity: 0.16 });
      shape.addTo(map).bindTooltip(row.applied ? "Adresse exacte" : "Position à 1 km près", { direction: "top" });
      map.setView(at, row.applied ? 15 : 13);
    });
    return box;
  }

  function factList(rows) {
    const list = el("dl", "sp-facts");
    rows.forEach(([name, value]) => {
      if (!value) return;
      list.append(el("dt", "", name), el("dd", "", value));
    });
    return list;
  }

  function renderTask() {
    const host = document.querySelector("[data-task]");
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("prestation"));
    const row = Number.isInteger(id) && id > 0 ? findMission(id, params.get("lieu")) : null;
    const refresh = () => { renderTask(); renderNav(); };

    if (!row) {
      document.querySelector("[data-crumb]").textContent = "Prestation introuvable";
      host.replaceChildren(emptyState(
        "Prestation introuvable",
        "Cette prestation n’existe pas, n’est plus ouverte, ou appartient à une zone que vous ne suivez pas.",
        { label: "Revenir aux prestations", href: "student-tasks.html" },
      ));
      return;
    }

    document.title = `${row.title} | Espace étudiant Q DEAL`;
    document.querySelector("[data-crumb]").textContent = row.title;
    const blocked = blockReason(row);

    const head = el("div", "sp-card-head");
    head.append(
      el("span", `sp-status ${row.applied ? "is-sent" : "is-open"}`, row.applied ? "Candidature envoyée" : "Ouverte"),
      el("span", "sp-card-date", row.applied ? `${oneDecimal.format(row.distanceKm)} km de votre zone` : `≈ ${row.distanceKm} km de votre zone`),
    );

    const body = el("div", "sp-detail-main");
    body.append(head, el("h1", "sp-detail-title", row.title), factList([
      ["Entreprise", row.business],
      ["Secteur", SECTORS[row.sector] || row.sector],
      ["Date", startsLabel(row.startsInDays)],
      [row.applied ? "Adresse" : "Zone", placeText(row)],
      ["Services demandés", row.skills.map((code) => skillLabel.get(code)).join(", ")],
    ]));

    const skillBox = el("div", "sp-detail-skills");
    skillBox.append(el("h2", "", "Compétences requises"), skillList(row));
    body.append(skillBox);

    if (blocked) {
      const note = el("p", "sp-reason");
      note.append(el("span", "", blocked.text));
      if (blocked.fix) note.append(link("sp-link", blocked.fix.label, blocked.fix.href));
      body.append(note);
    }

    const actions = el("div", "sp-card-actions sp-detail-actions");
    if (!row.applied && !blocked) actions.append(button("button button-dark", "Postuler à cette prestation", () => apply(row, refresh)));
    if (row.applied) {
      actions.append(link("button button-outline", "Suivre ma candidature", "student-applications.html"));
      actions.append(button("sp-link sp-link-danger", "Retirer ma candidature", () => withdraw(row, refresh)));
    }
    actions.append(link("sp-link", "Toutes les prestations ouvertes", "student-tasks.html"));
    body.append(actions);

    const missing = el("div", "sp-note");
    missing.append(
      el("b", "", "Informations pas encore communiquées"),
      el("p", "", "La description détaillée, les horaires précis et la rémunération ne sont pas encore transmis par la plateforme : la base de données ne les enregistre pas pour une prestation. Avant de vous déplacer, l’entreprise vous contactera pour les confirmer."),
    );
    body.append(missing);

    const side = el("aside", "sp-detail-side");
    side.append(detailMap(row));
    const privacy = el("div", "sp-note");
    privacy.append(
      el("b", "", row.applied ? "Adresse exacte" : "Position protégée"),
      el("p", "", row.applied
        ? "Votre candidature est envoyée : l’adresse complète vous est communiquée, et la distance est précise à 100 m."
        : "Avant votre candidature, la prestation est placée dans un cercle de 1 km et seule la ville et le code postal sont affichés."),
    );
    const seen = el("div", "sp-note");
    seen.append(el("b", "", "Ce que l’entreprise voit de vous"), el("p", "", `Votre prénom (${student.firstName}), vos compétences, votre note${student.rating ? ` (★ ${oneDecimal.format(student.rating)})` : " (pas encore d’avis)"} et votre distance au kilomètre. Jamais votre adresse.`));
    side.append(privacy, seen);

    const layout = el("div", "sp-detail");
    layout.append(body, side);
    host.replaceChildren(layout);
  }

  /* ---------------------------------------------------------------- candidatures */
  function renderApplications() {
    const tabsBox = document.querySelector("[data-status-tabs]");
    const list = document.querySelector("[data-list]");
    const all = Object.keys(state.responses).map(Number)
      .map((id) => {
        const response = state.responses[id];
        const entry = data.places.find((item) => item.key === response.placeKey && item.missions.some((m) => m.id === id))
          || data.places.find((item) => item.missions.some((m) => m.id === id));
        return entry ? decorate(entry.missions.find((m) => m.id === id), entry) : null;
      })
      .filter((row) => row && row.response.status)
      .sort((a, b) => (b.response.at || "").localeCompare(a.response.at || ""));

    let active = "all";
    const refresh = () => { renderApplications(); renderNav(); };

    function render() {
      const counts = Object.fromEntries(Object.keys(APPLICATION_STATES).map((key) => [key, all.filter((row) => (row.response.status || "sent") === key).length]));
      tabs(tabsBox, [
        { key: "all", label: "Toutes", count: all.length },
        ...Object.entries(APPLICATION_STATES).map(([key, status]) => ({ key, label: status.label, count: counts[key] })),
      ], active, (key) => { active = key; render(); });

      const rows = active === "all" ? all : all.filter((row) => (row.response.status || "sent") === active);
      list.replaceChildren(...rows.map((row) => missionCard(row, "application", refresh)));
      if (!rows.length) {
        const item = el("li", "sp-empty-item");
        item.append(BACKEND_STATES.includes(active)
          ? emptyState(
            `Aucune candidature « ${APPLICATION_STATES[active].label.toLowerCase()} »`,
            "Ce statut est décidé par l’entreprise. L’étape « choisir un prestataire » n’existe pas encore côté Q DEAL : aucune candidature ne peut donc l’atteindre aujourd’hui.",
          )
          : emptyState(
            "Aucune candidature pour l’instant",
            "Postulez à une prestation ouverte : elle apparaîtra ici avec sa date d’envoi.",
            { label: "Trouver une prestation", href: "student-tasks.html" },
          ));
        list.append(item);
      }
    }

    const pipeline = document.querySelector("[data-pipeline]");
    pipeline.replaceChildren(...["sent", "review", "accepted", "refused"].map((key, index) => {
      const status = APPLICATION_STATES[key];
      const item = el("li", `sp-pipeline-step${BACKEND_STATES.includes(key) ? " is-waiting" : ""}`);
      item.append(el("span", "sp-pipeline-index", String(index + 1)));
      const box = el("div");
      box.append(statusBadge(key), el("p", "", status.hint));
      if (BACKEND_STATES.includes(key)) box.append(el("p", "sp-pipeline-note", "Pas encore géré par la plateforme : la base n’enregistre aujourd’hui que l’envoi et le retrait d’une candidature."));
      item.append(box);
      return item;
    }));
    render();
  }

  /* ---------------------------------------------------------------- planning */
  function renderSchedule() {
    const tabsBox = document.querySelector("[data-tabs]");
    const list = document.querySelector("[data-list]");
    let active = "next";
    const refresh = () => { renderSchedule(); renderNav(); };

    function render() {
      const rows = appliedRows();
      const groups = {
        next: rows.filter((row) => phaseOf(row) === "next"),
        today: rows.filter((row) => phaseOf(row) === "today"),
        done: rows.filter((row) => phaseOf(row) === "done"),
      };
      tabs(tabsBox, [
        { key: "next", label: "À venir", count: groups.next.length },
        { key: "today", label: "En cours", count: groups.today.length },
        { key: "done", label: "Terminées", count: groups.done.length },
      ], active, (key) => { active = key; render(); });

      const shown = groups[active];
      list.replaceChildren(...shown.map((row) => missionCard(row, "schedule", refresh)));
      if (!shown.length) {
        const item = el("li", "sp-empty-item");
        const empty = {
          next: ["Aucune prestation à venir", "Postulez à une prestation ouverte pour la voir arriver ici avec son adresse complète."],
          today: ["Aucune prestation aujourd’hui", "Une prestation apparaît ici le jour où elle commence."],
          done: ["Aucune prestation terminée", "Marquez une prestation comme effectuée depuis l’onglet « À venir » : elle sera classée ici."],
        }[active];
        item.append(emptyState(empty[0], empty[1], active === "next" ? { label: "Trouver une prestation", href: "student-tasks.html" } : null));
        list.append(item);
      }
    }
    render();
  }

  /* ---------------------------------------------------------------- administrative file */
  function renderDocuments() {
    const file = dossier();
    const refresh = () => { renderDocuments(); renderNav(); };

    const progressBox = document.querySelector("[data-dossier-progress]");
    const counts = el("ul", "sp-counts");
    [["validated", file.rows.filter((row) => row.state === "validated").length],
     ["prepared", file.rows.filter((row) => row.state === "prepared").length],
     ["missing", file.rows.filter((row) => row.state === "missing").length]].forEach(([key, total]) => {
      const item = el("li");
      item.append(el("span", `sp-status ${DOC_STATES[key].className}`, DOC_STATES[key].label), el("b", "", String(total)));
      counts.append(item);
    });
    progressBox.replaceChildren(progressBar(file.done, file.required), el("p", "sp-dossier-summary", file.complete
      ? "Votre dossier est complet : plus rien à fournir."
      : `${file.missing} ${plural(file.missing, "document reste", "documents restent")} à fournir sur ${file.required} demandés.`), counts);
    const safety = el("div", "sp-note");
    safety.append(
      el("b", "", "Vos documents ne sont pas déposés ici"),
      el("p", "", "Ce site est public : aucun fichier n’y est envoyé ni enregistré. Quand vous choisissez un document, seul son nom est noté dans ce navigateur pour vous aider à suivre votre dossier. La transmission se fera par l’espace sécurisé de Q DEAL, qui reste à mettre en place."),
    );
    progressBox.append(safety);

    const list = document.querySelector("[data-docs]");
    list.replaceChildren(...file.rows.map((row) => {
      const info = DOC_STATES[row.state];
      const item = el("li", `sp-doc${row.state === "missing" ? " is-missing" : ""}`);
      const head = el("div", "sp-doc-head");
      const title = el("div", "sp-doc-title");
      title.append(el("b", "", row.label));
      if (row.optional) title.append(el("span", "sp-tag", "Selon votre situation"));
      head.append(title, el("span", `sp-status ${info.className}`, info.label));
      item.append(head, el("p", "sp-doc-hint", row.hint), el("p", "sp-doc-note", info.note));
      if (row.state === "rejected" && row.file.reason) item.append(el("p", "sp-reason", `Motif : ${row.file.reason}`));
      if (row.file.fileName) item.append(el("p", "sp-doc-file", `Fichier choisi : ${row.file.fileName}${row.file.at ? ` · ${stamp(row.file.at)}` : ""}`));

      const actions = el("div", "sp-card-actions");
      const field = el("label", "button button-outline sp-file");
      field.append(el("span", "", row.file.fileName ? "Remplacer le fichier" : "Choisir le fichier"));
      const input = el("input");
      input.type = "file";
      input.accept = ".pdf,.jpg,.jpeg,.png";
      input.addEventListener("change", () => {
        // Only the file name is kept: the file itself is never read, uploaded or stored.
        const picked = input.files && input.files[0];
        if (!picked) return;
        save({ documents: { ...state.documents, [row.code]: { state: "prepared", fileName: picked.name, at: new Date().toISOString() } } });
        announce(`${row.label} : fichier « ${picked.name} » prêt à être transmis.`);
        refresh();
      });
      field.append(input);
      actions.append(field);
      if (row.file.fileName) actions.append(button("sp-link sp-link-danger", "Retirer", () => {
        const documents = { ...state.documents };
        delete documents[row.code];
        save({ documents });
        announce(`${row.label} : fichier retiré.`);
        refresh();
      }));
      item.append(actions);
      return item;
    }));

    const legend = document.querySelector("[data-doc-legend]");
    legend.replaceChildren(...Object.entries(DOC_STATES).map(([key, status]) => {
      const item = el("li");
      item.append(el("span", `sp-status ${status.className}`, status.label), el("p", "", status.note));
      if (["pending", "validated", "rejected"].includes(key)) item.append(el("p", "sp-pipeline-note", "Décidé par Q DEAL après vérification : ce statut arrivera avec l’espace sécurisé."));
      return item;
    }));
    legend.append(el("li", "sp-inline-note", "Liste indicative : les pièces demandées seront confirmées par Q DEAL. La base de données ne contient pas encore de dossier administratif."));
  }

  /* ---------------------------------------------------------------- profile */
  const LEVELS = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2", "Doctorat", "BTS ou DUT", "Autre"];

  function renderProfile() {
    const form = document.querySelector("[data-profile-form]");
    const status = document.querySelector("[data-profile-status]");

    const textField = (name, label, value, options = {}) => {
      const field = el("div", `field${options.full ? " field-full" : ""}`);
      const id = `sp-${name}`;
      const labelNode = el("label", "", label);
      labelNode.htmlFor = id;
      const input = el(options.multiline ? "textarea" : "input");
      input.id = id;
      input.name = name;
      input.value = value || "";
      if (options.type) input.type = options.type;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.readOnly) { input.readOnly = true; input.classList.add("sp-readonly"); }
      if (options.autocomplete) input.autocomplete = options.autocomplete;
      field.append(labelNode, input);
      if (options.hint) field.append(el("small", "", options.hint));
      return field;
    };

    const selectField = (name, label, value, choices, hint) => {
      const field = el("div", "field");
      const id = `sp-${name}`;
      const labelNode = el("label", "", label);
      labelNode.htmlFor = id;
      const select = el("select");
      select.id = id;
      select.name = name;
      choices.forEach(([optionValue, optionLabel]) => {
        const option = new Option(optionLabel, optionValue);
        option.selected = String(value) === String(optionValue);
        select.append(option);
      });
      field.append(labelNode, select);
      if (hint) field.append(el("small", "", hint));
      return field;
    };

    const note = (title, text) => {
      const box = el("div", "sp-note");
      box.append(el("b", "", title), el("p", "", text));
      return box;
    };

    const profile = state.profile;
    const identity = el("div", "sp-form-grid");
    identity.append(
      textField("firstName", "Prénom", student.firstName, { readOnly: true, hint: "Le seul élément de votre identité visible par les entreprises." }),
      textField("lastName", "Nom", profile.lastName, { autocomplete: "family-name" }),
      textField("school", "Établissement", profile.school, { placeholder: "Université, école, lycée" }),
      selectField("level", "Niveau d’études", profile.level, [["", "Non précisé"], ...LEVELS.map((entry) => [entry, entry])]),
    );
    document.querySelector("[data-identity]").replaceChildren(identity,
      note("Modifiable plus tard", "Votre prénom vient de votre inscription. L’établissement et le niveau d’études n’ont pas encore de place dans la base de données : ils restent dans ce navigateur."));

    const contact = el("div", "sp-form-grid");
    contact.append(
      textField("email", "Adresse e-mail", profile.email, { type: "email", autocomplete: "email" }),
      textField("phone", "Téléphone", profile.phone, { type: "tel", autocomplete: "tel", hint: "Utilisé par l’entreprise le jour de la prestation." }),
    );
    document.querySelector("[data-contact]").replaceChildren(contact,
      note("Pas encore enregistré côté Q DEAL", "La base ne conserve aujourd’hui ni e-mail ni téléphone pour un prestataire. En attendant, passez par le formulaire de contact pour toute mise à jour officielle."));

    const zone = el("div", "sp-form-grid");
    zone.append(
      selectField("placeKey", "Ma zone", state.placeKey, data.places.map((entry) => [entry.key, placeLabel(entry)]), "Les prestations proposées sont celles publiées autour de cette zone."),
      selectField("radiusKm", "Rayon de déplacement", state.radiusKm, RADIUS_CHOICES.map((km) => [String(km), `${km} km`]), "De 1 à 50 km, comme dans la base."),
    );
    const confirm = el("label", "consent");
    const confirmInput = el("input");
    confirmInput.type = "checkbox";
    confirmInput.name = "zoneConfirmed";
    confirmInput.checked = Boolean(state.zoneConfirmed);
    confirm.append(confirmInput, el("span", "", "Je confirme cette zone et ce rayon de déplacement."));
    const availability = el("fieldset", "profile-choice");
    availability.append(el("legend", "", "Mes disponibilités"));
    AVAILABILITY.forEach((slot) => {
      const label = el("label");
      const input = el("input");
      input.type = "checkbox";
      input.name = "availability";
      input.value = slot.code;
      input.checked = (profile.availability || []).includes(slot.code);
      label.append(input, el("span", "", slot.label));
      availability.append(label);
    });
    document.querySelector("[data-zone]").replaceChildren(zone, confirm, availability,
      note("Enregistré côté base", "La zone et le rayon correspondent à api.set_provider_location, déjà présente dans la base. Les disponibilités, elles, n’ont pas encore de table."));

    const skillBox = el("fieldset", "loc-skill-choice sp-skill-choice");
    skillBox.append(el("legend", "", "Les services que je sais réaliser"));
    const groups = el("div", "loc-service-groups");
    data.groups.forEach((group) => {
      const groupNode = el("div", "loc-service-group");
      groupNode.append(el("span", "", group.fr));
      const row = el("div", "sp-skill-row");
      data.skills.filter((skill) => skill.group === group.code).forEach((skill) => {
        const label = el("label");
        const input = el("input");
        input.type = "checkbox";
        input.name = "skills";
        input.value = skill.code;
        input.checked = mySkills.includes(skill.code);
        label.append(input, el("span", "", skill.fr));
        row.append(label);
      });
      groupNode.append(row);
      groups.append(groupNode);
    });
    skillBox.append(groups);
    document.querySelector("[data-skills]").replaceChildren(skillBox,
      note("Vos compétences décident de ce que vous pouvez accepter", "Une prestation n’est acceptable que si vous avez toutes les compétences qu’elle demande. La base garde ces compétences (core.provider_skills), mais aucune fonction ne permet encore de les modifier depuis l’application."));

    const experience = el("div", "sp-form-grid");
    experience.append(textField("experience", "Mon expérience", profile.experience, {
      multiline: true, full: true, placeholder: "Expériences de ménage, de remise en état, de repassage, langues parlées…",
    }));
    const rating = el("p", "sp-rating");
    rating.append(el("b", "", student.rating ? `★ ${oneDecimal.format(student.rating)}` : "Pas encore de note"),
      el("span", "", student.rating ? `${student.reviewCount} ${plural(student.reviewCount, "avis d’entreprise", "avis d’entreprises")}` : "Votre première prestation terminée ouvrira vos avis."));
    document.querySelector("[data-experience]").replaceChildren(experience, rating,
      note("Votre note vient des avis reçus", "Elle est calculée par la base à partir des avis des entreprises (core.reviews) et n’est pas modifiable."));

    if (form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const skills = values.getAll("skills");
      save({
        placeKey: String(values.get("placeKey")),
        radiusKm: Number(values.get("radiusKm")),
        zoneConfirmed: values.get("zoneConfirmed") === "on",
        skills: skills.length ? skills : [],
        profile: {
          ...state.profile,
          lastName: String(values.get("lastName") || "").trim(),
          school: String(values.get("school") || "").trim(),
          level: String(values.get("level") || ""),
          email: String(values.get("email") || "").trim(),
          phone: String(values.get("phone") || "").trim(),
          experience: String(values.get("experience") || "").trim(),
          availability: values.getAll("availability"),
        },
      });
      status.textContent = skills.length
        ? "Modifications enregistrées dans ce navigateur."
        : "Modifications enregistrées. Sans compétence, aucune prestation ne peut être acceptée.";
      announce(status.textContent);
      renderNav();
    });

    form.addEventListener("reset", (event) => {
      event.preventDefault();
      status.textContent = "Modifications annulées.";
      renderProfile();
    });
  }

  /* ---------------------------------------------------------------- notifications */
  const KIND_LABELS = { candidature: "Candidature", prestation: "Prestation", dossier: "Dossier", profil: "Profil" };

  function notificationRow(row, refresh) {
    const item = el("li", `sp-notification${row.read ? " is-read" : ""}${row.level === "alert" ? " is-alert" : ""}`);
    item.append(icon(row.level === "alert" ? "alert" : row.kind === "candidature" ? "send" : row.kind === "prestation" ? "calendar" : row.kind === "dossier" ? "file" : "user"));
    const body = el("div", "sp-notification-body");
    const head = el("p", "sp-notification-head");
    head.append(el("b", "", row.title), el("span", "sp-tag", KIND_LABELS[row.kind] || row.kind));
    if (row.at) head.append(el("span", "sp-card-date", stamp(row.at)));
    body.append(head, el("p", "sp-notification-text", row.body));
    const actions = el("div", "sp-notification-actions");
    actions.append(link("sp-link", "Ouvrir", row.href));
    if (!row.read) actions.append(button("sp-link", "Marquer comme lu", () => {
      save({ read: [...state.read, row.id] });
      refresh();
    }));
    body.append(actions);
    item.append(body);
    return item;
  }

  function renderNotifications() {
    const tabsBox = document.querySelector("[data-tabs]");
    const list = document.querySelector("[data-list]");
    let active = "all";
    const refresh = () => { render(); renderNav(); };

    function render() {
      const rows = notifications();
      const unread = rows.filter((row) => !row.read);
      tabs(tabsBox, [
        { key: "all", label: "Toutes", count: rows.length },
        { key: "unread", label: "Non lues", count: unread.length },
      ], active, (key) => { active = key; render(); });
      if (unread.length) tabsBox.append(button("sp-link sp-tabs-action", "Tout marquer comme lu", () => {
        save({ read: [...new Set([...state.read, ...rows.map((row) => row.id)])] });
        announce("Toutes les notifications sont marquées comme lues.");
        refresh();
      }));

      const shown = active === "unread" ? unread : rows;
      list.replaceChildren(...shown.map((row) => notificationRow(row, refresh)));
      if (!shown.length) {
        const item = el("li", "sp-empty-item");
        item.append(emptyState(
          active === "unread" ? "Tout est lu" : "Aucune notification",
          active === "unread"
            ? "Vous n’avez aucune notification en attente."
            : "Les informations sur vos candidatures, les changements sur vos prestations et les alertes de dossier apparaîtront ici.",
        ));
        list.append(item);
      }
    }
    render();
  }

  /* ---------------------------------------------------------------- start */
  renderTopbar();
  renderNav();
  renderNotice();
  backdrop.addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (sidebar.classList.contains("is-open")) setDrawer(false);
    const session = document.querySelector(".sp-session[open]");
    if (session) { session.open = false; session.querySelector("summary").focus(); }
  });
  sidebar.addEventListener("click", (event) => { if (event.target.closest("a")) setDrawer(false); });

  ({
    dashboard: renderDashboard,
    tasks: renderTasks,
    task: renderTask,
    applications: renderApplications,
    schedule: renderSchedule,
    documents: renderDocuments,
    profile: renderProfile,
    notifications: renderNotifications,
  }[page] || (() => {}))();
})();
