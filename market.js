/* The marketplace rules both portals share: the internal score, the two recommendation feeds, the
   price estimate, favourites and conversations. Exposed on window.QDM.

   Data: assets/demo/prestations.js (snapshot of the database functions) and assets/demo/marketplace.js
   (hand-written profiles, history and mission details). Favourites and conversations are kept in this
   browser under one localStorage key that both portals read, so a message sent from the business
   space shows up in the provider space of the same browser — the demo of what the api will carry.

   The score never looks at refusals. A provider is free to decline any mission or not to answer: no
   scoring event exists for that, and no ratio has declines in its denominator. The score only
   rewards what was done (missions completed, on time, ratings, regular activity); the one thing that
   lowers it is a mission accepted and then not shown up to (no-show), a commitment broken. */
(() => {
  const snapshot = window.QDEAL_MISSIONS;
  const market = window.QDEAL_MARKETPLACE;
  if (!snapshot || !market) return;

  const SECTORS = {
    syndic: "Syndic de copropriété", conciergerie: "Conciergerie", entreprise: "Entreprise",
    particulier: "Particulier", automobile: "Automobile", btp: "BTP", commerce: "Commerce", evenementiel: "Événementiel",
  };
  const SECTOR_PLURAL = {
    syndic: "syndics", conciergerie: "conciergeries", entreprise: "entreprises", particulier: "particuliers",
    automobile: "pros de l’automobile", btp: "entreprises du BTP", commerce: "commerces", evenementiel: "événements",
  };
  const KINDS = { novice: "Novice", artisan: "Artisan" };
  const MISSION_KINDS = { recurrente: "Récurrente", ponctuelle: "Ponctuelle" };
  const MOBILITY = { mobile: "Prêt à se déplacer", sedentaire: "Ne se déplace pas" };

  const skillLabel = new Map(snapshot.skills.map((skill) => [skill.code, skill.fr]));
  const skillGroup = new Map(snapshot.skills.map((skill) => [skill.code, skill.group]));
  const placeByKey = (key) => snapshot.places.find((place) => place.key === key) || snapshot.places[0];
  const sum = (values) => values.reduce((total, value) => total + value, 0);

  // Great-circle distance between two place centroids, in km, rounded to 0.5 km: the provider's
  // home is never used, only the district they declared (core.providers.location stays private).
  function distanceKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 2) / 2;
  }

  /* ---------------------------------------------------------------- internal score */
  /* 0–100, never shown as a number to anyone: businesses only see the order of the feed, providers
     see what raises it. Every term is smoothed so that a newcomer starts in the middle, not at 0. */
  const SCORE_WEIGHTS = { reliability: 0.3, punctuality: 0.2, rating: 0.25, regularity: 0.15, experience: 0.1 };
  function internalScore(history) {
    const completed = sum(Object.values(history.sectors || {}));
    const terms = {
      reliability: (completed + 2) / (completed + history.noShow + 2),         // only no-shows lower it
      punctuality: (history.onTime + 2) / (history.onTime + history.late + 2.5),
      rating: ((history.ratingAvg * history.ratingCount + 4 * 3) / (history.ratingCount + 3) - 1) / 4,
      regularity: Math.min(history.activeWeeks / 26, 1),                         // active weeks over 6 months
      experience: Math.min(Math.log1p(completed) / Math.log1p(40), 1),
    };
    return Math.round(100 * sum(Object.entries(SCORE_WEIGHTS).map(([key, weight]) => weight * terms[key])));
  }

  /* ---------------------------------------------------------------- providers */
  const snapshotProviders = (() => {
    const seen = new Map();
    snapshot.business.addresses.forEach((address) => address.candidates.forEach((candidate) => {
      if (!seen.has(candidate.id)) seen.set(candidate.id, candidate);
    }));
    return seen;
  })();

  function provider(id) {
    const base = snapshotProviders.get(id);
    const profile = market.providers[id];
    if (!base || !profile) return null;
    const history = profile.history;
    const completed = sum(Object.values(history.sectors));
    const topSectors = Object.entries(history.sectors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sector, count]) => ({ sector, label: SECTORS[sector] || sector, count }));
    return {
      id, firstName: base.firstName, displayName: `${base.firstName} ${profile.lastInitial}.`,
      skills: base.skills, kind: profile.kind, kindLabel: KINDS[profile.kind], summary: profile.summary,
      place: placeByKey(profile.placeKey), radiusKm: profile.radiusKm,
      mobility: profile.mobility, mobilityLabel: MOBILITY[profile.mobility], since: profile.since,
      rating: history.ratingAvg, ratingCount: history.ratingCount, completed, topSectors, history,
      score: internalScore(history),
    };
  }
  const providers = () => [...snapshotProviders.keys()].sort((a, b) => a - b).map(provider).filter(Boolean);

  function business(name) {
    const profile = market.businesses[name];
    if (!profile) return null;
    const sector = (snapshot.places.flatMap((place) => place.missions).find((mission) => mission.business === name) || {}).sector;
    return { name, sector, sectorLabel: SECTORS[sector] || "", place: placeByKey(profile.placeKey), ...profile };
  }
  const businesses = () => Object.keys(market.businesses).map(business);

  /* ---------------------------------------------------------------- price estimate */
  /* Stand-in for the pricing model: same inputs (services, duration, kind) and the same output (a
     range, never a firm price). The real model will replace the body of this function only. */
  const HOURLY = { menage: 18, electromenager: 20, textile: 22, voiture: 20 };
  const HOURLY_SKILL = { nettoyage_fin_chantier: 24, nettoyage_logement_insalubre: 28, lustrage_voiture: 24, nettoyage_moquette: 23 };
  const round5 = (value) => Math.max(5, Math.round(value / 5) * 5);
  function estimatePrice({ skills = [], durationH = 2, kind = "ponctuelle" }) {
    const rate = Math.max(...skills.map((code) => HOURLY_SKILL[code] || HOURLY[skillGroup.get(code)] || 18), 18);
    const central = rate * durationH;
    return {
      low: round5(central * 0.9), high: round5(central * 1.12), mid: round5(central),
      unit: kind === "recurrente" ? "par passage" : "la mission", basis: `${String(durationH).replace(".", ",")} h estimées`,
    };
  }
  const missionInfo = (id) => {
    const info = market.missions[id] || { kind: "ponctuelle", durationH: 2, keywords: [] };
    return { ...info, kindLabel: MISSION_KINDS[info.kind] };
  };

  /* ---------------------------------------------------------------- business side: recommended providers */
  /* Ranking = 50 % internal score + 30 % proximity to the site + 20 % experience in the business's
     sector. Filters (service, kind, mobility) are hard: they only remove rows. */
  function recommendProviders({ businessName, siteKey, skill, kind, mobility }) {
    const owner = business(businessName);
    const site = placeByKey(siteKey || owner.place.key);
    return providers()
      .filter((row) => (!skill || row.skills.includes(skill)) && (!kind || row.kind === kind) && (!mobility || row.mobility === mobility))
      .map((row) => {
        const distance = distanceKm(row.place, site);
        const reachable = distance <= row.radiusKm;
        const proximity = Math.max(0, 1 - distance / 15) * (reachable ? 1 : 0.3);
        const inSector = row.history.sectors[owner.sector] || 0;
        const sectorFit = 0.6 * Math.min(inSector / 10, 1) + 0.4 * (row.completed ? inSector / row.completed : 0);
        const match = 0.5 * (row.score / 100) + 0.3 * proximity + 0.2 * sectorFit;
        const reasons = [];
        if (inSector) reasons.push(`${inSector} missions pour des ${SECTOR_PLURAL[owner.sector] || "clients"}`);
        reasons.push(!reachable ? `hors de sa zone de ${row.radiusKm} km` : distance < 1 ? "dans le quartier de votre site" : `à ≈ ${String(distance).replace(".", ",")} km de votre site`);
        if (row.score >= 80) reasons.push("très régulier sur la durée");
        if (row.completed < 5) reasons.push("nouveau sur Q DEAL");
        return { ...row, distanceKm: distance, reachable, match, reasons };
      })
      .sort((a, b) => Number(b.reachable) - Number(a.reachable) || b.match - a.match);
  }

  /* ---------------------------------------------------------------- provider side: recommended missions */
  /* rows: the provider's real open missions (portal.js rowsOf), already marked qualified / inRadius.
     Missions they can accept come first, then by fit: skills, distance, the business's rating. */
  function recommendMissions(rows, radiusKm) {
    return rows
      .map((row) => {
        const info = missionInfo(row.id);
        const owner = business(row.business);
        const fit = (row.qualified ? 0.45 : 0) + (row.inRadius ? 0.25 : 0)
          + 0.15 * Math.max(0, 1 - row.distanceKm / Math.max(radiusKm, 1))
          + 0.15 * (owner ? Math.max(0, (owner.rating - 3) / 2) : 0);
        return { ...row, info, owner, estimate: estimatePrice({ skills: row.skills, durationH: info.durationH, kind: info.kind }), fit };
      })
      .sort((a, b) => Number(b.qualified && b.inRadius) - Number(a.qualified && a.inRadius) || b.fit - a.fit);
  }

  /* ---------------------------------------------------------------- favourites and conversations */
  const STORE_KEY = "qdeal.market.v1";
  const DAY = 86400000;
  function seed() {
    const now = Date.now();
    return {
      favorites: { "Rhin Habitat Syndic": [2] },
      conversations: market.conversations.map((conversation, index) => ({
        id: `c${index + 1}`, business: conversation.business, providerId: conversation.providerId, missionId: conversation.missionId,
        read: { business: null, provider: null },
        messages: conversation.messages.map((message, rank) => ({
          from: message.from, kind: message.kind, text: message.text,
          at: new Date(now - message.daysAgo * DAY - (conversation.messages.length - rank) * 3600000).toISOString(),
        })),
      })),
    };
  }
  let store = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (stored && stored.conversations) return stored;
    } catch { /* unreadable: start again */ }
    return seed();
  })();
  let storageWorks = true;
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { storageWorks = false; }
  }
  function reset() {
    try { localStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ }
    store = seed();
  }

  const favoritesOf = (businessName) => store.favorites[businessName] || [];
  const isFavorite = (businessName, providerId) => favoritesOf(businessName).includes(providerId);
  function toggleFavorite(businessName, providerId) {
    const list = favoritesOf(businessName);
    store.favorites[businessName] = list.includes(providerId) ? list.filter((id) => id !== providerId) : [...list, providerId];
    persist();
    return store.favorites[businessName].includes(providerId);
  }

  const conversations = ({ businessName, providerId } = {}) => store.conversations
    .filter((row) => (!businessName || row.business === businessName) && (!providerId || row.providerId === providerId))
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  const lastAt = (row) => (row.messages[row.messages.length - 1] || {}).at || "";
  const conversation = (id) => store.conversations.find((row) => row.id === id) || null;

  // One conversation per business and provider: the mission it started from is only a context.
  function openConversation(businessName, providerId, missionId = null) {
    let row = store.conversations.find((entry) => entry.business === businessName && entry.providerId === providerId);
    if (!row) {
      row = { id: `c${Date.now().toString(36)}`, business: businessName, providerId, missionId, read: { business: null, provider: null }, messages: [] };
      store.conversations.push(row);
      persist();
    }
    return row;
  }
  function send(id, message) {
    const row = conversation(id);
    row.messages.push({ ...message, at: new Date().toISOString() });
    row.read[message.from] = new Date().toISOString();
    persist();
    return row;
  }
  function markRead(id, side) {
    const row = conversation(id);
    if (!row) return;
    row.read[side] = new Date().toISOString();
    persist();
  }
  const unread = (row, side) => row.messages.filter((message) => message.from !== side && (!row.read[side] || message.at > row.read[side])).length;

  // The price agreed for a mission: the last price proposal sent about it, by either side.
  function agreedPrice(providerId, missionId) {
    const offers = store.conversations
      .filter((row) => row.providerId === providerId)
      .flatMap((row) => row.messages)
      .filter((message) => message.kind === "price" && message.missionId === missionId);
    return offers.length ? offers[offers.length - 1].amount : null;
  }

  /* ---------------------------------------------------------------- revenue */
  /* The missions a provider completed on Q DEAL before this demo, expanded from their history counts
     with a fixed seed: same dates and amounts at every visit. Amounts are what the business paid. */
  const TYPICAL = { syndic: 48, conciergerie: 42, particulier: 55, entreprise: 70, automobile: 65 };
  function pastRevenue(providerId) {
    const profile = market.providers[providerId];
    if (!profile) return [];
    let seedValue = providerId * 7919;
    const random = () => { seedValue = (seedValue * 16807) % 2147483647; return seedValue / 2147483647; };
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    const start = Math.max(new Date(`${profile.since}T12:00:00`).getTime(), end.getTime() - 365 * DAY);
    const span = end.getTime() - DAY - start;
    return Object.entries(profile.history.sectors).flatMap(([sector, count]) => Array.from({ length: count }, () => ({
      date: new Date(start + random() * span).toISOString().slice(0, 10),
      amount: round5((TYPICAL[sector] || 50) * (0.8 + random() * 0.45)),
      sector, source: "qdeal",
    }))).sort((a, b) => a.date.localeCompare(b.date));
  }

  window.QDM = {
    SECTORS, KINDS, MISSION_KINDS, MOBILITY, SCORE_WEIGHTS, skillLabel, placeByKey, distanceKm,
    internalScore, provider, providers, business, businesses, missionInfo, estimatePrice,
    recommendProviders, recommendMissions,
    favoritesOf, isFavorite, toggleFavorite,
    conversations, conversation, openConversation, send, markRead, unread, agreedPrice,
    pastRevenue, reset, storageWorks: () => storageWorks,
  };
})();
