/* Shared building blocks of the two portals: the provider space (student-*.html, portal.js) and the
   business space (company-*.html, company.js). No data and no rule lives here, only the pieces both
   sides draw with: DOM helpers, icons, star ratings, tabs, progress bars, the dialog, the conversation
   thread and the portal shell (top bar, side menu, mobile drawer).

   Loaded before market.js and the page script; everything is exposed on window.QD. */
(() => {
  const locale = "fr-FR";
  const plural = (n, one, many) => (n > 1 ? many : one);
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const dayMonthFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
  const dayMonth = { format: (date) => dayMonthFormat.format(date).replace(/^1 /, "1er ") };
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const oneDecimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const euros = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const stamp = (iso) => (iso ? shortDate.format(new Date(iso)) : "");

  /* ---------------------------------------------------------------- DOM helpers */
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

  const live = () => document.querySelector("[data-live]");
  const announce = (message) => { const node = live(); if (node) node.textContent = message; };

  /* ---------------------------------------------------------------- icons */
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
    heart: ["M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"],
    chat: ["M4.5 5.5h15v10h-9l-4.5 4v-4h-1.5z", "M8.5 10.5h7"],
    euro: ["M17.5 6.5a6.5 6.5 0 1 0 0 11", "M5 10.5h8", "M5 13.5h8"],
    spark: ["M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z", "M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"],
    route: ["M6 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M18 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M8 17.5h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"],
    chart: ["M4.5 20.5h15", "M7 16.5v-5", "M12 16.5v-9", "M17 16.5v-3"],
    list: ["M9 6.5h11", "M9 12h11", "M9 17.5h11", "M4.5 6.5h.5", "M4.5 12h.5", "M4.5 17.5h.5"],
  };
  function icon(name) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("qd-icon");
    (ICONS[name] || []).forEach((d) => {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      svg.append(path);
    });
    return svg;
  }

  /* ---------------------------------------------------------------- small components */
  // Five stars filled to the rating, then « 4,8 · 23 notations ». No rating: « Pas encore de note ».
  function stars(rating, count, countWord = ["notation", "notations"]) {
    const box = el("span", "qd-stars");
    if (!rating || !count) {
      box.classList.add("is-empty");
      box.append(el("span", "qd-stars-text", "Pas encore de note"));
      return box;
    }
    const row = el("span", "qd-stars-row");
    row.style.setProperty("--fill", `${Math.max(0, Math.min(5, rating)) * 20}%`);
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", `Note ${oneDecimal.format(rating)} sur 5`);
    row.textContent = "★★★★★";
    box.append(row, el("b", "", oneDecimal.format(rating)), el("span", "qd-stars-text", `· ${count} ${plural(count, ...countWord)}`));
    return box;
  }

  const chip = (text, className = "") => el("li", `qd-chip${className ? ` ${className}` : ""}`, text);
  const chips = (texts, className) => {
    const list = el("ul", "qd-chips");
    texts.forEach((text) => list.append(chip(text, className)));
    return list;
  };

  function emptyState(title, body, action) {
    const box = el("div", "sp-empty");
    box.append(el("p", "sp-empty-title", title), el("p", "sp-empty-body", body));
    if (action) box.append(link("button button-dark", action.label, action.href));
    return box;
  }

  function note(title, text) {
    const box = el("div", "sp-note");
    box.append(el("b", "", title), el("p", "", text));
    return box;
  }

  function tabs(container, entries, active, onPick) {
    container.replaceChildren(...entries.map((entry) => {
      const node = button(`sp-tab${entry.key === active ? " is-active" : ""}`, entry.label, () => onPick(entry.key));
      node.setAttribute("aria-pressed", String(entry.key === active));
      if (entry.count !== undefined) node.append(el("span", "sp-tab-count", String(entry.count)));
      return node;
    }));
  }

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

  /* A labelled form field. kind: "input" (default), "textarea" or "select" (options: [[value, label]]). */
  function field({ name, label, kind = "input", type, value, options, hint, required, min, step, placeholder, full }) {
    const box = el("div", `field${full ? " field-full" : ""}`);
    const id = `qd-${name}-${Math.random().toString(36).slice(2, 7)}`;
    const labelNode = el("label", "", label);
    labelNode.htmlFor = id;
    const input = el(kind === "select" ? "select" : kind === "textarea" ? "textarea" : "input");
    input.id = id;
    input.name = name;
    if (kind === "select") (options || []).forEach(([optionValue, optionLabel]) => {
      const option = new Option(optionLabel, optionValue);
      option.selected = String(value) === String(optionValue);
      input.append(option);
    });
    else {
      if (type) input.type = type;
      if (value !== undefined && value !== null) input.value = value;
      if (placeholder) input.placeholder = placeholder;
      if (min !== undefined) input.min = String(min);
      if (step !== undefined) input.step = String(step);
    }
    if (required) input.required = true;
    box.append(labelNode, input);
    if (hint) box.append(el("small", "", hint));
    return box;
  }

  /* ---------------------------------------------------------------- dialog */
  /* A modal on the native <dialog>: focus trap, Escape and the backdrop come with it.
     content: nodes; onSubmit(formData) returns false to keep the dialog open. */
  function dialog({ title, lede, content = [], submitLabel, onSubmit, wide }) {
    const box = el("dialog", `qd-dialog${wide ? " is-wide" : ""}`);
    const form = el("form", "qd-dialog-form");
    form.method = "dialog";
    form.noValidate = false;
    const head = el("div", "qd-dialog-head");
    const heading = el("h2", "", title);
    heading.id = `qd-dialog-${Math.random().toString(36).slice(2, 7)}`;
    box.setAttribute("aria-labelledby", heading.id);
    head.append(heading, button("qd-dialog-close", "×", () => box.close()));
    head.lastChild.setAttribute("aria-label", "Fermer");
    const body = el("div", "qd-dialog-body");
    if (lede) body.append(el("p", "qd-dialog-lede", lede));
    body.append(...content);
    form.append(head, body);
    if (submitLabel) {
      const foot = el("div", "qd-dialog-foot");
      const cancel = button("button button-outline", "Annuler", () => box.close());
      const submit = el("button", "button button-dark", submitLabel);
      submit.type = "submit";
      foot.append(cancel, submit);
      form.append(foot);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        if (onSubmit && onSubmit(new FormData(form)) === false) return;
        box.close();
      });
    }
    box.append(form);
    box.addEventListener("close", () => box.remove());
    box.addEventListener("click", (event) => { if (event.target === box) box.close(); });
    document.body.append(box);
    box.showModal();
    return box;
  }

  /* ---------------------------------------------------------------- conversation thread */
  /* One conversation between a business and a provider, seen from `me` ("business" | "provider").
     Messages: { from, kind: "text" | "mission" | "price", text, at, mission?, amount?, estimate? }. */
  function messageNode(message, me, names) {
    const mine = message.from === me;
    const item = el("li", `qd-msg${mine ? " is-mine" : ""}${message.kind !== "text" ? ` is-${message.kind}` : ""}`);
    const who = el("p", "qd-msg-who", `${mine ? "Vous" : names[message.from]} · ${stamp(message.at)} ${time.format(new Date(message.at))}`);
    item.append(who);
    if (message.kind === "mission") {
      const card = el("div", "qd-msg-card");
      card.append(el("span", "qd-msg-tag", "Proposition de mission"), el("b", "", message.mission.title));
      const facts = el("ul", "qd-msg-facts");
      [message.mission.kindLabel, message.mission.when, message.mission.place,
        message.amount ? `Prix proposé : ${euros.format(message.amount)}` : "Prix à convenir ensemble"]
        .filter(Boolean).forEach((text) => facts.append(el("li", "", text)));
      card.append(facts);
      item.append(card);
    }
    if (message.kind === "price") {
      const card = el("div", "qd-msg-card");
      card.append(el("span", "qd-msg-tag", "Proposition de prix"), el("b", "qd-msg-amount", euros.format(message.amount)));
      if (message.subject) card.append(el("p", "qd-msg-sub", message.subject));
      if (message.estimate) card.append(el("p", "qd-msg-sub", `Estimation IA affichée : ${euros.format(message.estimate.low)} – ${euros.format(message.estimate.high)} (indicative)`));
      item.append(card);
    }
    if (message.text) item.append(el("p", "qd-msg-text", message.text));
    return item;
  }

  function thread({ conversation, me, names, onSend, placeholder }) {
    const box = el("div", "qd-thread");
    const list = el("ol", "qd-msgs");
    list.setAttribute("aria-live", "polite");
    const draw = () => {
      list.replaceChildren(...conversation.messages.map((message) => messageNode(message, me, names)));
      if (!conversation.messages.length) list.append(el("li", "qd-msgs-empty", "Aucun message pour l’instant. Présentez-vous en quelques mots."));
      requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    };
    const form = el("form", "qd-composer");
    const label = el("label", "visually-hidden", "Votre message");
    const input = el("textarea");
    input.rows = 2;
    input.required = true;
    input.placeholder = placeholder || "Écrire un message…";
    label.htmlFor = input.id = `qd-msg-${Math.random().toString(36).slice(2, 7)}`;
    const send = el("button", "button button-dark", "Envoyer");
    send.type = "submit";
    form.append(label, input, send);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      onSend(text);
      input.value = "";
      draw();
      input.focus();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
    });
    box.append(list, form);
    draw();
    box.redraw = draw;
    return box;
  }

  /* Messages page of either portal: the list of conversations, and the open one beside it (below it
     on a phone). rows: [{ id, title, subtitle, unread, last }]; open(id) returns the thread node. */
  function inbox(container, { rows, currentId, hrefOf, open, emptyTitle, emptyBody, emptyAction }) {
    if (!rows.length) {
      container.replaceChildren(emptyState(emptyTitle, emptyBody, emptyAction));
      return;
    }
    const current = rows.find((row) => row.id === currentId) || null;
    const layout = el("div", `qd-inbox${current ? " has-open" : ""}`);
    const list = el("ul", "qd-inbox-list");
    rows.forEach((row) => {
      const item = el("li");
      const anchor = link(`qd-inbox-row${row.id === currentId ? " is-current" : ""}`, "", hrefOf(row));
      if (row.id === currentId) anchor.setAttribute("aria-current", "true");
      const head = el("span", "qd-inbox-head");
      head.append(el("b", "", row.title));
      if (row.unread) head.append(el("span", "sp-nav-count is-alert", String(row.unread)));
      anchor.append(head, el("span", "qd-inbox-sub", row.subtitle));
      if (row.last) anchor.append(el("span", "qd-inbox-last", row.last));
      item.append(anchor);
      list.append(item);
    });
    const pane = el("section", "qd-inbox-pane");
    if (current) {
      const head = el("div", "qd-inbox-pane-head");
      head.append(link("sp-link qd-inbox-back", "← Toutes les conversations", hrefOf({ id: "" })), el("h2", "", current.title), el("p", "", current.subtitle));
      pane.append(head, open(current.id));
    } else pane.append(el("p", "qd-inbox-pick", "Choisissez une conversation."));
    layout.append(list, pane);
    container.replaceChildren(layout);
  }

  /* Bar chart of one series (e.g. turnover per quarter): bars anchored to the baseline, value on
     hover and focus, and the same values in a table next to it (the chart is never the only way to
     read them). bars: [{ label, value, hint, current }]. */
  function barChart({ bars, format, caption }) {
    const figure = el("figure", "qd-bars");
    const max = Math.max(...bars.map((bar) => bar.value), 1);
    const plot = el("div", "qd-bars-plot");
    const tip = el("div", "qd-bars-tip");
    tip.hidden = true;
    bars.forEach((bar) => {
      const column = el("div", `qd-bars-col${bar.current ? " is-current" : ""}`);
      const track = el("div", "qd-bars-track");
      const fill = el("div", "qd-bars-fill");
      fill.style.height = `${bar.value ? Math.max(2, (bar.value / max) * 100) : 0}%`;
      track.append(fill);
      track.tabIndex = 0;
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", `${bar.label} : ${format(bar.value)}${bar.hint ? `, ${bar.hint}` : ""}`);
      const show = () => {
        tip.replaceChildren(el("b", "", format(bar.value)), el("span", "", `${bar.label}${bar.hint ? ` · ${bar.hint}` : ""}`));
        tip.hidden = false;
        tip.style.left = `${column.offsetLeft + column.offsetWidth / 2}px`;
      };
      const hide = () => { tip.hidden = true; };
      track.addEventListener("mouseenter", show);
      track.addEventListener("focus", show);
      track.addEventListener("mouseleave", hide);
      track.addEventListener("blur", hide);
      column.append(track, el("span", "qd-bars-label", bar.label));
      plot.append(column);
    });
    plot.append(tip);
    figure.append(plot);
    if (caption) figure.append(el("figcaption", "", caption));
    return figure;
  }

  /* ---------------------------------------------------------------- portal shell */
  /* Top bar, side menu and mobile drawer of a portal page.
     options: { page, nav: [{ key, href, label, icon, also?, count?, alert? }], title, home, tag,
                session: node for the right of the top bar, foot: [[label, href]] } */
  function shell(options) {
    const sidebar = document.querySelector("[data-portal-nav]");
    const backdrop = document.querySelector("[data-portal-backdrop]");
    const bar = document.querySelector("[data-portal-topbar]");
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
      options.nav.forEach((item) => {
        const row = el("li");
        const current = item.key === options.page || (item.also || []).includes(options.page);
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
      help.append(...(options.foot || []).map(([label, href]) => link("sp-nav-back", label, href)));
      sidebar.replaceChildren(el("p", "sp-nav-title", options.title), list, help);
    }

    burger = button("sp-burger", "", () => setDrawer(!sidebar.classList.contains("is-open")));
    burger.setAttribute("aria-controls", "sp-sidebar");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Ouvrir le menu");
    burger.append(el("span"), el("span"), el("span"));
    const brand = link("sp-brand", "", options.home);
    const logo = el("img");
    logo.src = "assets/images/qdeal-logo.svg";
    logo.alt = "Q DEAL";
    logo.width = 954;
    logo.height = 323;
    brand.append(logo, el("span", "sp-brand-tag", options.tag || options.title));
    bar.replaceChildren(burger, brand, el("div", "sp-topbar-spacer"), ...(options.session ? [options.session] : []));

    backdrop.addEventListener("click", () => setDrawer(false));
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (sidebar.classList.contains("is-open")) setDrawer(false);
      const session = document.querySelector(".sp-session[open]");
      if (session) { session.open = false; session.querySelector("summary").focus(); }
    });
    sidebar.addEventListener("click", (event) => { if (event.target.closest("a")) setDrawer(false); });
    renderNav();
    return { renderNav, setDrawer };
  }

  // The « who is using this demo » menu at the right of the top bar.
  function sessionMenu({ initial, name, identity, content = [] }) {
    const session = el("details", "sp-session");
    const head = el("summary");
    head.append(el("span", "loc-avatar sp-avatar", initial), el("span", "sp-session-name", name));
    const panel = el("div", "sp-session-panel");
    panel.append(identity, ...content);
    session.append(head, panel);
    document.addEventListener("click", (event) => { if (!session.contains(event.target)) session.open = false; });
    return session;
  }

  function notice(title, paragraphs) {
    const box = el("aside", "sp-notice");
    box.append(icon("alert"));
    const body = el("div");
    body.append(el("b", "", title), ...paragraphs.filter(Boolean).map((text) => el("p", "", text)));
    box.append(body);
    document.querySelector(".sp-main").prepend(box);
    return box;
  }

  window.QD = {
    locale, plural, dateFormat, dayMonth, shortDate, oneDecimal, euros, stamp,
    el, button, link, icon, announce, stars, chip, chips, emptyState, note, tabs, progressBar, field,
    dialog, thread, inbox, barChart, shell, sessionMenu, notice,
  };
})();
