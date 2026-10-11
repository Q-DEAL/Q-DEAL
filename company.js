/* Business portal (« Espace entreprise »): company-*.html — the syndic's or the business's space.
   Recommended providers (company-portal.html), favourites (company-favorites.html) and conversations
   with providers, where a mission can be proposed (company-messages.html).

   The ranking, the favourites and the conversations come from market.js; the components from ui.js.
   The internal score orders the feed and is never displayed. The demo runs on fictional providers
   (assets/demo/marketplace.js) and says so: in production this feed lists real, registered providers
   only — never a made-up profile (see db/README.md, « Côté entreprise »). */
(() => {
  const { QD, QDM } = window;
  const data = window.QDEAL_MISSIONS;
  const page = document.body.dataset.companyPage;
  if (!data || !QDM || !page) return;
  const { plural, euros, stamp, el, button, link, icon, announce, emptyState } = QD;

  /* ---------------------------------------------------------------- the business of this session */
  const STORE_KEY = "qdeal.company.v1";
  const DEFAULT_STATE = { businessName: "Rhin Habitat Syndic", siteKey: null, filters: {} };
  let state = (() => {
    try { return { ...DEFAULT_STATE, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; } catch { return { ...DEFAULT_STATE }; }
  })();
  let storageWorks = true;
  function save(changes) {
    state = { ...state, ...changes };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { storageWorks = false; }
  }
  const owner = QDM.business(state.businessName) || QDM.businesses()[0];
  const site = QDM.placeByKey(state.siteKey || owner.place.key);
  const unreadMessages = () => QDM.conversations({ businessName: owner.name }).reduce((total, row) => total + QDM.unread(row, "business"), 0);

  /* ---------------------------------------------------------------- shell */
  const NAV = [
    { key: "providers", href: "company-portal.html", label: "Profils recommandés", icon: "search" },
    { key: "favorites", href: "company-favorites.html", label: "Mes favoris", icon: "heart", count: () => QDM.favoritesOf(owner.name).length },
    { key: "messages", href: "company-messages.html", label: "Messages", icon: "chat", count: unreadMessages, alert: true },
  ];

  function sessionPanel() {
    const identity = el("p", "sp-session-identity");
    identity.append(el("b", "", owner.name), el("span", "", owner.sectorLabel));
    const pickerField = el("div", "field sp-session-field");
    const label = el("label", "", "Entreprise de la session de démonstration");
    label.htmlFor = "cp-business";
    const select = el("select");
    select.id = "cp-business";
    QDM.businesses().forEach((entry) => {
      const option = new Option(`${entry.name} · ${entry.sectorLabel}`, entry.name);
      option.selected = entry.name === owner.name;
      select.append(option);
    });
    select.addEventListener("change", () => { save({ businessName: select.value, siteKey: null }); window.location.reload(); });
    pickerField.append(label, select, el("small", "", "Chaque entreprise a ses favoris et ses conversations."));
    const reset = button("sp-session-reset", "Réinitialiser cet espace", () => {
      if (!window.confirm("Effacer les favoris et les messages enregistrés dans ce navigateur ?")) return;
      try { localStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ }
      QDM.reset();
      window.location.reload();
    });
    return QD.sessionMenu({ initial: owner.name.slice(0, 1), name: owner.name, identity, content: [pickerField, reset] });
  }

  const portal = QD.shell({
    page, nav: NAV, title: "Espace entreprise", home: "company-portal.html", session: sessionPanel(),
    foot: [["Publier une prestation", "post-task.html"], ["Retour au site Q DEAL", "index.html"], ["Contacter Q DEAL", "contact.html?type=business#contact-form"]],
  });
  QD.notice("Espace de démonstration", [
    "Les prestataires, leurs notes et leurs historiques sont fictifs. En service, ce fil ne montre que des prestataires réellement inscrits. Favoris et messages sont enregistrés dans ce navigateur : il n’y a pas encore de compte ni de serveur.",
    !storageWorks || !QDM.storageWorks() ? "Ce navigateur refuse l’enregistrement local : vos actions seront perdues en quittant la page." : "",
  ]);

  /* ---------------------------------------------------------------- proposing a mission */
  function missionDialog(provider, onSent) {
    const services = provider.skills.map((code) => [code, QDM.skillLabel.get(code) || code]);
    const estimateLine = el("p", "qd-estimate-inline");
    const fields = [
      QD.field({ name: "title", label: "Intitulé de la mission", required: true, placeholder: "Entretien des parties communes, 12 rue…", full: true }),
      QD.field({ name: "skill", label: "Service", kind: "select", options: services }),
      QD.field({ name: "kind", label: "Type", kind: "select", value: "ponctuelle", options: [["ponctuelle", "Ponctuelle"], ["recurrente", "Récurrente (titulaire)"]] }),
      QD.field({ name: "frequency", label: "Fréquence (si récurrente)", placeholder: "Chaque mardi matin" }),
      QD.field({ name: "date", label: "Première intervention", type: "date", required: true }),
      QD.field({ name: "duration", label: "Durée estimée (heures)", type: "number", min: 0.5, step: 0.5, value: 2, required: true }),
      QD.field({ name: "amount", label: "Votre prix (facultatif)", type: "number", min: 5, step: 1, hint: "Laissez vide pour en convenir ensemble." }),
      QD.field({ name: "text", label: "Message", kind: "textarea", placeholder: "Accès, consignes, matériel sur place…", full: true }),
    ];
    const grid = el("div", "sp-form-grid");
    grid.append(...fields);
    const update = () => {
      const form = grid.closest("form");
      if (!form) return;
      const values = new FormData(form);
      const estimate = QDM.estimatePrice({ skills: [values.get("skill")], durationH: Number(values.get("duration")) || 2, kind: values.get("kind") });
      estimateLine.replaceChildren(icon("spark"), el("b", "", "Estimation IA "),
        el("span", "", `${euros.format(estimate.low)} – ${euros.format(estimate.high)} ${estimate.unit} · indicative, le prix se fixe avec le prestataire`));
    };
    QD.dialog({
      title: `Proposer une mission à ${provider.displayName}`, wide: true,
      lede: `${provider.kindLabel} · ${provider.place.labelFr}. ${provider.displayName} reste libre d’accepter ou non, sans conséquence pour son profil.`,
      content: [grid, estimateLine], submitLabel: "Envoyer la proposition",
      onSubmit: (values) => {
        const conversation = QDM.openConversation(owner.name, provider.id);
        const kind = values.get("kind");
        const date = values.get("date") ? QD.dateFormat.format(new Date(`${values.get("date")}T12:00:00`)) : "";
        QDM.send(conversation.id, {
          from: "business", kind: "mission", text: String(values.get("text") || "").trim(),
          amount: Number(values.get("amount")) || null,
          mission: {
            title: String(values.get("title")).trim(),
            kindLabel: kind === "recurrente" ? `Récurrente${values.get("frequency") ? ` · ${values.get("frequency")}` : ""} · titulaire` : "Ponctuelle",
            when: `À partir du ${date} · ${String(values.get("duration")).replace(".", ",")} h`,
            place: site.labelFr, skill: values.get("skill"),
          },
        });
        announce(`Proposition envoyée à ${provider.displayName}.`);
        if (onSent) onSent(conversation);
      },
    });
    grid.addEventListener("input", update);
    grid.addEventListener("change", update);
    update();
  }

  function exchangeDialog(provider, refresh) {
    const conversation = QDM.openConversation(owner.name, provider.id);
    QDM.markRead(conversation.id, "business");
    const view = QD.thread({
      conversation, me: "business", names: { business: owner.name, provider: provider.firstName },
      placeholder: `Bonjour ${provider.firstName}, …`,
      onSend: (text) => { QDM.send(conversation.id, { from: "business", kind: "text", text }); portal.renderNav(); },
    });
    const box = QD.dialog({
      title: `Échanger avec ${provider.displayName}`, wide: true,
      lede: "Posez vos questions, puis proposez une mission : ponctuelle, ou récurrente avec un titulaire.",
      content: [view, (() => {
        const actions = el("div", "sp-card-actions");
        actions.append(button("button button-dark", "Proposer une mission", () => {
          box.close();
          missionDialog(provider, () => { exchangeDialog(provider, refresh); });
        }), link("sp-link", "Ouvrir dans mes messages", `company-messages.html?c=${conversation.id}`));
        return actions;
      })()],
    });
    box.addEventListener("close", () => { if (refresh) refresh(); portal.renderNav(); });
  }

  /* ---------------------------------------------------------------- provider card */
  function likeButton(provider, onChange) {
    const liked = QDM.isFavorite(owner.name, provider.id);
    const node = button(`qd-like${liked ? " is-liked" : ""}`, "", () => {
      const now = QDM.toggleFavorite(owner.name, provider.id);
      announce(now ? `${provider.displayName} ajouté à vos favoris.` : `${provider.displayName} retiré de vos favoris.`);
      onChange();
    });
    node.append(icon("heart"), el("span", "qd-like-text", liked ? "Favori" : "Liker"));
    node.setAttribute("aria-pressed", String(liked));
    node.setAttribute("aria-label", liked ? `Retirer ${provider.displayName} de mes favoris` : `Ajouter ${provider.displayName} à mes favoris`);
    return node;
  }

  function providerCard(provider, refresh) {
    const card = el("li", "sp-card qd-provider");
    const head = el("div", "qd-provider-head");
    const avatar = el("span", "loc-avatar qd-provider-avatar", provider.firstName.slice(0, 1));
    const who = el("div", "qd-provider-who");
    who.append(el("h3", "qd-provider-name", provider.displayName), QD.stars(provider.rating, provider.ratingCount));
    head.append(avatar, who, likeButton(provider, refresh));
    card.append(head);

    const badges = el("ul", "qd-badges");
    badges.append(el("li", `qd-badge is-${provider.kind}`, provider.kindLabel),
      el("li", `qd-badge ${provider.mobility === "mobile" ? "is-mobile" : "is-static"}`, provider.mobilityLabel),
      el("li", "qd-badge", `${provider.completed} ${plural(provider.completed, "mission", "missions")}`));
    card.append(badges);

    const sectors = el("div", "qd-provider-sectors");
    sectors.append(el("p", "qd-label", "Secteurs les plus pratiqués"),
      QD.chips(provider.topSectors.map((row) => `${row.label} · ${row.count}`)));
    card.append(sectors, el("p", "qd-provider-summary", provider.summary));

    const place = el("p", "qd-offer-place");
    place.append(icon("pin"), el("span", "", `${provider.place.labelFr} · rayon ${provider.radiusKm} km${provider.distanceKm === undefined ? "" : provider.distanceKm < 1 ? " · dans le quartier de votre site" : ` · à ≈ ${String(provider.distanceKm).replace(".", ",")} km de votre site`}`));
    card.append(place);
    if (provider.reasons) card.append(el("p", "qd-why-line", `Pourquoi ce profil : ${provider.reasons.join(" · ")}`));

    const actions = el("div", "sp-card-actions");
    actions.append(button("button button-dark", "Échanger", () => exchangeDialog(provider, refresh)));
    const existing = QDM.conversations({ businessName: owner.name, providerId: provider.id })[0];
    if (existing && existing.messages.length) actions.append(link("sp-link", "Conversation en cours", `company-messages.html?c=${existing.id}`));
    card.append(actions);
    return card;
  }

  /* ---------------------------------------------------------------- recommended providers */
  function renderProviders() {
    const form = document.querySelector("[data-filters]");
    const list = document.querySelector("[data-list]");
    const summary = document.querySelector("[data-summary]");
    const filters = state.filters || {};

    const fill = (name, choices, value) => {
      const select = form.elements[name];
      select.replaceChildren(...choices.map(([optionValue, optionLabel]) => {
        const option = new Option(optionLabel, optionValue);
        option.selected = String(value || "") === String(optionValue);
        return option;
      }));
    };
    fill("site", data.places.map((entry) => [entry.key, entry.labelFr]), site.key);
    fill("skill", [["", "Tous les services"], ...data.groups.flatMap((group) => data.skills
      .filter((skill) => skill.group === group.code).map((skill) => [skill.code, `${group.fr} · ${skill.fr}`]))], filters.skill);
    fill("kind", [["", "Novices et artisans"], ["novice", "Novices"], ["artisan", "Artisans"]], filters.kind);
    fill("mobility", [["", "Tous"], ["mobile", "Prêt à se déplacer"], ["sedentaire", "Ne se déplace pas"]], filters.mobility);

    function draw() {
      const values = new FormData(form);
      const chosen = { skill: values.get("skill"), kind: values.get("kind"), mobility: values.get("mobility") };
      const siteKey = String(values.get("site"));
      save({ filters: chosen, siteKey });
      const rows = QDM.recommendProviders({ businessName: owner.name, siteKey, ...chosen });
      const place = QDM.placeByKey(siteKey);
      summary.textContent = `${rows.length} ${plural(rows.length, "profil recommandé", "profils recommandés")} pour un site à ${place.labelFr}`;
      list.replaceChildren(...rows.map((row) => providerCard(row, draw)));
      if (!rows.length) {
        const item = el("li", "sp-empty-item");
        item.append(emptyState("Aucun profil pour ces critères", "Retirez un filtre, ou publiez votre besoin : il sera proposé aux prestataires dès leur inscription.", { label: "Publier une prestation", href: "post-task.html" }));
        list.append(item);
      }
      portal.renderNav();
    }
    if (!form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("change", draw);
      form.addEventListener("submit", (event) => event.preventDefault());
      form.addEventListener("reset", (event) => {
        event.preventDefault();
        save({ filters: {}, siteKey: owner.place.key });
        renderProviders();
      });
    }
    draw();
  }

  /* ---------------------------------------------------------------- favourites */
  function renderFavorites() {
    const list = document.querySelector("[data-list]");
    const ids = QDM.favoritesOf(owner.name);
    const rows = QDM.recommendProviders({ businessName: owner.name, siteKey: site.key }).filter((row) => ids.includes(row.id));
    list.replaceChildren(...rows.map((row) => providerCard(row, renderFavorites)));
    if (!rows.length) {
      const item = el("li", "sp-empty-item");
      item.append(emptyState("Pas encore de favori", "Likez un prestataire avec ♥ pour le retrouver ici et lui proposer vos prochaines missions.", { label: "Voir les profils recommandés", href: "company-portal.html" }));
      list.append(item);
    }
    portal.renderNav();
  }

  /* ---------------------------------------------------------------- messages */
  function renderMessages() {
    const currentId = new URLSearchParams(window.location.search).get("c");
    const rows = QDM.conversations({ businessName: owner.name }).map((row) => {
      const provider = QDM.provider(row.providerId);
      const last = row.messages[row.messages.length - 1];
      return {
        id: row.id, title: provider ? provider.displayName : "Prestataire", unread: QDM.unread(row, "business"),
        subtitle: provider ? `${provider.kindLabel} · ${provider.place.labelFr}` : "",
        last: last ? `${last.from === "business" ? "Vous : " : ""}${last.text || (last.kind === "price" ? `Proposition de ${euros.format(last.amount)}` : "Proposition de mission")} · ${stamp(last.at)}` : "",
      };
    }).filter((row) => row.last || row.id === currentId);
    QD.inbox(document.querySelector("[data-inbox]"), {
      rows, currentId,
      hrefOf: (row) => `company-messages.html${row.id ? `?c=${row.id}` : ""}`,
      emptyTitle: "Aucune conversation",
      emptyBody: "Cliquez sur « Échanger » depuis un profil pour démarrer une conversation et proposer une mission.",
      emptyAction: { label: "Voir les profils recommandés", href: "company-portal.html" },
      open: (id) => {
        const conversation = QDM.conversation(id);
        const provider = QDM.provider(conversation.providerId);
        QDM.markRead(id, "business");
        portal.renderNav();
        const box = el("div", "qd-inbox-thread");
        const actions = el("div", "sp-card-actions");
        actions.append(button("button button-outline", "Proposer une mission", () => missionDialog(provider, () => window.location.reload())));
        box.append(actions, QD.thread({
          conversation, me: "business", names: { business: owner.name, provider: provider.firstName },
          onSend: (text) => QDM.send(id, { from: "business", kind: "text", text }),
        }));
        return box;
      },
    });
  }

  ({ providers: renderProviders, favorites: renderFavorites, messages: renderMessages }[page] || (() => {}))();
})();
