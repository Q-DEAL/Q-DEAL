// Fictional data for the two portals' demo, written by hand. It completes assets/demo/prestations.js
// (generated from the database, do not edit that one) with what the database has no column for yet:
// the providers' public profile and history, the businesses' profile, the details of each mission
// and a few conversations to start from. Ids and business names are those of the snapshot.
//
// Each block has the shape the future api will return, so this file can be swapped for real calls
// without touching the screens:
//   providers[id]    → profile + history aggregated from scoring events (missions completed per sector,
//                      on time, late, no-show, ratings, active weeks). Refusals are never recorded.
//   businesses[name] → profile seen by providers (rating given by providers, missions completed).
//   missions[id]     → kind (recurrente | ponctuelle), frequency, duration, 2–3 keywords.
//   providers[id].verified → the documents Q DEAL has checked (codes of portal.js DOCUMENTS): SIRET,
//                      RC Pro and URSSAF vigilance certificate, the minimum syndics ask for.
// Everything here is fictional: no person, company or address is real.
window.QDEAL_MARKETPLACE = {
  providers: {
    1: {
      lastInitial: "M", kind: "novice", placeKey: "strasbourg-krutenau", radiusKm: 6, mobility: "mobile", since: "2025-09-15",
      summary: "Étudiante en L3, ménage soigné et rapide. Entretien de halls et de cages d’escalier, sortie des poubelles, vitres des parties communes.",
      history: { sectors: { syndic: 24, conciergerie: 11, particulier: 6 }, ratingAvg: 4.8, ratingCount: 23, onTime: 39, late: 2, noShow: 0, activeWeeks: 30 },
      verified: ["siret", "rc_pro", "vigilance"],
    },
    2: {
      lastInitial: "B", kind: "artisan", placeKey: "strasbourg-neudorf", radiusKm: 25, mobility: "mobile", since: "2025-06-02",
      summary: "Entreprise de nettoyage (SIRET, RC Pro). Fins de chantier, remise en état de logements dégradés, moquettes de halls d’immeuble.",
      history: { sectors: { syndic: 31, entreprise: 14, conciergerie: 3 }, ratingAvg: 4.7, ratingCount: 36, onTime: 45, late: 3, noShow: 0, activeWeeks: 41 },
      verified: ["siret", "rc_pro", "vigilance"],
    },
    3: {
      lastInitial: "K", kind: "novice", placeKey: "strasbourg-robertsau", radiusKm: 8, mobility: "mobile", since: "2026-01-12",
      summary: "Disponible le week-end. Ménage après événement, canapés et tapis : je viens avec mon matériel d’injection-extraction.",
      history: { sectors: { particulier: 9, conciergerie: 7, entreprise: 2 }, ratingAvg: 4.3, ratingCount: 12, onTime: 16, late: 2, noShow: 1, activeWeeks: 14 },
      verified: ["siret", "rc_pro"],
    },
    4: {
      lastInitial: "R", kind: "artisan", placeKey: "schiltigheim", radiusKm: 30, mobility: "mobile", since: "2025-04-20",
      summary: "Préparateur automobile à mon compte. Intérieur, extérieur, lustrage : flottes d’entreprise et véhicules de location sur site.",
      history: { sectors: { automobile: 52, entreprise: 9 }, ratingAvg: 4.9, ratingCount: 41, onTime: 60, late: 1, noShow: 0, activeWeeks: 48 },
      verified: ["siret", "rc_pro", "vigilance"],
    },
    5: {
      lastInitial: "D", kind: "novice", placeKey: "strasbourg", radiusKm: 10, mobility: "mobile", since: "2025-11-03",
      summary: "Étudiante en master. Entretien des parties communes et sortie des poubelles, en soirée ou tôt le matin. Ponctuelle, je préviens toujours en cas d’imprévu.",
      history: { sectors: { syndic: 14, conciergerie: 8, particulier: 5 }, ratingAvg: 4.6, ratingCount: 17, onTime: 26, late: 1, noShow: 0, activeWeeks: 22 },
      verified: ["siret", "rc_pro", "vigilance"],
    },
    6: {
      lastInitial: "L", kind: "novice", placeKey: "strasbourg-cronenbourg", radiusKm: 10, mobility: "mobile", since: "2026-03-09",
      summary: "Locaux poubelles, lavage et désinfection des bacs, fins de chantier. Je viens avec mon nettoyeur haute pression.",
      history: { sectors: { syndic: 6, entreprise: 3 }, ratingAvg: 4.5, ratingCount: 6, onTime: 8, late: 1, noShow: 0, activeWeeks: 9 },
      verified: ["siret", "rc_pro", "vigilance"],
    },
    7: {
      lastInitial: "F", kind: "novice", placeKey: "illkirch", radiusKm: 5, mobility: "sedentaire", since: "2026-02-16",
      summary: "Textile avant tout : rideaux, matelas, moquettes. Ménage de printemps complet sur une journée.",
      history: { sectors: { particulier: 8, syndic: 4 }, ratingAvg: 4.4, ratingCount: 9, onTime: 11, late: 1, noShow: 0, activeWeeks: 11 },
      verified: ["siret", "rc_pro", "vigilance"],
    },
    8: {
      lastInitial: "G", kind: "novice", placeKey: "strasbourg-neudorf", radiusKm: 12, mobility: "mobile", since: "2026-08-24",
      summary: "Nouveau sur Q DEAL. Permis B, à l’aise sur les fins de chantier et le nettoyage intérieur de véhicules.",
      history: { sectors: { automobile: 2, entreprise: 1 }, ratingAvg: 5, ratingCount: 2, onTime: 3, late: 0, noShow: 0, activeWeeks: 3 },
      verified: ["siret"],
    },
    9: {
      lastInitial: "A", kind: "novice", placeKey: "strasbourg-krutenau", radiusKm: 3, mobility: "sedentaire", since: "2026-05-04",
      summary: "Rangement, repassage et ménage à domicile. Je reste dans le centre et à la Krutenau.",
      history: { sectors: { particulier: 7, conciergerie: 5 }, ratingAvg: 4.2, ratingCount: 8, onTime: 10, late: 2, noShow: 0, activeWeeks: 10 },
      verified: ["siret", "rc_pro", "vigilance"],
    },
  },

  businesses: {
    "Rhin Habitat Syndic": {
      placeKey: "strasbourg-neudorf", since: "2025-05-12", rating: 4.6, ratingCount: 38, missionsDone: 126,
      about: "Syndic de copropriété, 42 immeubles gérés à Strasbourg et Schiltigheim.",
    },
    "Copropriété Les Platanes": {
      placeKey: "strasbourg-krutenau", since: "2026-09-14", rating: 4.8, ratingCount: 5, missionsDone: 9,
      about: "Copropriété de 6 logements gérée par son conseil syndical (syndic bénévole), à la Krutenau.",
    },
    "Conciergerie Kléber": {
      placeKey: "strasbourg", since: "2025-07-01", rating: 4.4, ratingCount: 51, missionsDone: 214,
      about: "Conciergerie de locations saisonnières au centre-ville, 35 appartements.",
    },
    "Bureaux des Halles": {
      placeKey: "strasbourg", since: "2026-01-20", rating: 4.1, ratingCount: 7, missionsDone: 18,
      about: "Centre d’affaires, 2 000 m² de bureaux partagés.",
    },
    "Lavage Auto Strasbourg": {
      placeKey: "strasbourg-cronenbourg", since: "2025-10-06", rating: 4.7, ratingCount: 22, missionsDone: 73,
      about: "Station de lavage et préparation de véhicules de location.",
    },
  },

  missions: {
    1: { kind: "recurrente", frequency: "Chaque vendredi", durationH: 2.5, keywords: ["Linge", "Check-in", "T2 meublé"] },
    2: { kind: "ponctuelle", durationH: 2, keywords: ["Draps", "Housses", "Repassage"] },
    3: { kind: "ponctuelle", durationH: 5, keywords: ["Parties communes", "Poussière", "4 étages"] },
    5: { kind: "recurrente", frequency: "Chaque lundi", durationH: 4, keywords: ["Flotte", "Aspiration", "Sièges"] },
    7: { kind: "recurrente", frequency: "Chaque mardi matin", durationH: 2, keywords: ["Hall et escaliers", "Ascenseur", "Boîtes aux lettres"] },
    8: { kind: "recurrente", frequency: "Lundi et jeudi soir", durationH: 0.5, keywords: ["Badge fourni", "Sortie le soir", "Rentrée le matin"] },
    9: { kind: "ponctuelle", durationH: 6, keywords: ["Remplacement", "4 passages", "18 logements"] },
    10: { kind: "recurrente", frequency: "Chaque semaine", durationH: 2, keywords: ["6 logements", "Escaliers en moquette", "Local poubelles"] },
    11: { kind: "recurrente", frequency: "Chaque mardi soir", durationH: 0.75, keywords: ["2 immeubles", "Collecte du mercredi", "Badge fourni"] },
    12: { kind: "ponctuelle", durationH: 1.5, keywords: ["8 bacs", "Désinfection", "Point d’eau sur place"] },
    13: { kind: "ponctuelle", durationH: 3, keywords: ["Moquette", "4 étages", "En journée"] },
    14: { kind: "ponctuelle", durationH: 1, keywords: ["Hall", "Porte vitrée", "Rez-de-chaussée"] },
    15: { kind: "ponctuelle", durationH: 3.5, keywords: ["Open space", "Moquette", "120 m²"] },
    16: { kind: "ponctuelle", durationH: 1.5, keywords: ["Vitrine", "Agence", "Rez-de-chaussée"] },
  },

  // Conversations already under way when the demo starts (dates are counted back from today).
  conversations: [
    {
      business: "Rhin Habitat Syndic", providerId: 1, missionId: 7,
      messages: [
        { from: "business", kind: "text", daysAgo: 3, text: "Bonjour Léa, nous cherchons une titulaire pour l’entretien des parties communes de la résidence Les Quais, chaque mardi matin. Seriez-vous intéressée ?" },
        { from: "provider", kind: "text", daysAgo: 2, text: "Bonjour, oui avec plaisir ! Le mardi matin me convient. Combien de temps faut-il compter ?" },
        { from: "business", kind: "text", daysAgo: 2, text: "Environ 2 heures : hall, escaliers, ascenseur et boîtes aux lettres. Je vous fais une proposition." },
      ],
    },
    {
      business: "Rhin Habitat Syndic", providerId: 6, missionId: 12,
      messages: [
        { from: "business", kind: "text", daysAgo: 2, text: "Bonjour Yanis, nous avons huit bacs et le local poubelles à désinfecter à la résidence B. Vous avez le matériel ?" },
        { from: "provider", kind: "text", daysAgo: 1, text: "Bonjour, oui : je viens avec mon nettoyeur haute pression et un désinfectant. Je peux passer jeudi matin." },
        { from: "provider", kind: "price", daysAgo: 1, amount: 40, missionId: 12, subject: "Lavage et désinfection des bacs à ordures", estimate: { low: 30, high: 40 }, text: "Prix pour les huit bacs et le sol du local, produits compris." },
      ],
    },
    {
      business: "Copropriété Les Platanes", providerId: 5, missionId: 8,
      messages: [
        { from: "business", kind: "text", daysAgo: 1, text: "Bonjour Camille, pour la sortie des poubelles le lundi et le jeudi soir : le badge d’accès est à récupérer chez le président du conseil syndical, au 1er étage. Cela vous convient ?" },
      ],
    },
  ],
};
