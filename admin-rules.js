/* Administrative follow-up of a micro-entrepreneur provider: the reference rules (rates, ceilings,
   deadlines), the quarters, the deadlines with their checklist and short explanations, and the
   contribution regime. Exposed on window.QDA; drawn by portal.js on student-admin.html.

   Every amount, rate and date below is a reference to check against the official sources before
   production (they change by decree, often once a year): RULES.checkedOn says when they were last
   read, RULES.sources where. Nothing here is a tax or legal advice: the pages say so.

   Platform withholding (« précompte »). From 1 January 2027 platforms are to withhold and pay the
   social contributions of the micro-entrepreneurs they work with, on the turnover made through them.
   The code is ready for it: regimeOn(date) says who pays the contributions on Q DEAL turnover for a
   given quarter ("self" today, "platform" once RULES.withholding.enabled is switched on), and
   declaration() splits a quarter between what Q DEAL withheld and what the provider still declares.
   Plugging the real withholding in means filling `withheld` from the payment records instead of the
   rate below, and turning the flag on — the screens already read both cases. */
(() => {
  const RULES = {
    checkedOn: "2026-10-11",
    toVerify: true,
    sources: [
      ["URSSAF · auto-entrepreneur", "https://www.autoentrepreneur.urssaf.fr"],
      ["Service-public.fr · micro-entrepreneur", "https://entreprendre.service-public.fr/vosdroits/F23961"],
      ["impots.gouv.fr · espace professionnel", "https://www.impots.gouv.fr/professionnel"],
    ],
    periodicity: "quarterly",           // chosen when registering; monthly is also possible
    // Cleaning services: commercial or craft service provision (BIC).
    contributionRate: 0.212,
    contributionLabel: "prestations de services commerciales ou artisanales (BIC)",
    flatTaxRate: 0.017,                 // optional « versement libératoire » of income tax, paid with the contributions
    revenueCeiling: 83600,              // micro-entreprise ceiling for services, per calendar year
    vatThreshold: 37500,                // VAT exemption (« franchise en base ») for services
    withholding: { startsOn: "2027-01-01", enabled: false },
  };

  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAY = 86400000;
  const atNoon = (date) => { const copy = new Date(date); copy.setHours(12, 0, 0, 0); return copy; };
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const daysBetween = (from, to) => Math.round((atNoon(to) - atNoon(from)) / DAY);

  /* ---------------------------------------------------------------- quarters */
  const quarterOf = (date) => ({ year: date.getFullYear(), q: Math.floor(date.getMonth() / 3) + 1 });
  const quarterKey = ({ year, q }) => `${year}-T${q}`;
  const quarterLabel = ({ year, q }) => `T${q} ${year}`;
  const quarterMonths = ({ q }) => `${MONTHS[(q - 1) * 3]} – ${MONTHS[(q - 1) * 3 + 2]}`;
  const quarterStart = ({ year, q }) => new Date(year, (q - 1) * 3, 1, 12);
  const shiftQuarter = ({ year, q }, by) => {
    const index = year * 4 + (q - 1) + by;
    return { year: Math.floor(index / 4), q: (index % 4) + 1 };
  };
  // Quarterly declaration and payment: end of the month that follows the quarter.
  // A deadline on a weekend or a public holiday moves to the next working day (not computed here).
  const declarationDue = ({ year, q }) => (q === 4 ? new Date(year + 1, 0, 31, 12) : new Date(year, q * 3 + 1, 0, 12));

  // Turnover per quarter of a year, from dated lines ({ date: "YYYY-MM-DD", amount }).
  function revenueByQuarter(lines, year) {
    const totals = [1, 2, 3, 4].map((q) => ({ year, q, key: quarterKey({ year, q }), amount: 0, count: 0 }));
    lines.forEach((line) => {
      const date = new Date(`${line.date}T12:00:00`);
      if (date.getFullYear() !== year) return;
      const row = totals[Math.floor(date.getMonth() / 3)];
      row.amount += line.amount;
      row.count += 1;
    });
    return totals;
  }

  /* ---------------------------------------------------------------- contribution regime */
  const regimeOn = (date) => (RULES.withholding.enabled && iso(date) >= RULES.withholding.startsOn ? "platform" : "self");

  // What the provider declares for a quarter: Q DEAL turnover + turnover made elsewhere.
  function declaration(quarter, qdealAmount, otherAmount = 0) {
    const regime = regimeOn(quarterStart(quarter));
    const withheld = regime === "platform" ? Math.round(qdealAmount * RULES.contributionRate) : 0;
    const toDeclare = regime === "platform" ? otherAmount : qdealAmount + otherAmount;
    return {
      regime, qdealAmount, otherAmount, toDeclare, withheld,
      contributionsEstimate: Math.round(toDeclare * RULES.contributionRate),
    };
  }

  /* ---------------------------------------------------------------- deadlines and checklist */
  /* Each deadline: { id, kind, title, due, approx?, quarter?, explain, actions: [{ id, label }], href }.
     actions are the checklist; their done / to-do state is kept by the portal. */
  function deadlines(today, { since }) {
    const start = since ? new Date(`${since}T12:00:00`) : null;
    const rows = [];
    const current = quarterOf(today);
    for (let by = -3; by <= 1; by += 1) {
      const quarter = shiftQuarter(current, by);
      const due = declarationDue(quarter);
      const end = new Date(quarter.year, quarter.q * 3, 0, 12);
      if (start && end < start) continue;           // before the activity started
      if (by === 1 && daysBetween(today, due) > 120) continue;
      const key = quarterKey(quarter);
      rows.push({
        id: `urssaf-${key}`, kind: "urssaf", quarter,
        title: `Déclarer et payer le CA du ${quarterLabel(quarter)}`,
        subtitle: `Chiffre d’affaires de ${quarterMonths(quarter)} ${quarter.year}`,
        due,
        explain: "Déclarez votre chiffre d’affaires du trimestre sur le site de l’URSSAF, même s’il est à zéro : sans déclaration, une pénalité forfaitaire s’applique. Les cotisations sont calculées sur ce montant et payées au même moment.",
        actions: [
          { id: `${key}-check`, label: "Vérifier le CA du trimestre calculé ici" },
          { id: `${key}-declare`, label: "Déclarer le CA sur autoentrepreneur.urssaf.fr" },
          { id: `${key}-pay`, label: "Payer les cotisations (prélèvement ou paiement en ligne)" },
        ],
        href: "https://www.autoentrepreneur.urssaf.fr",
      });
    }

    const cfeYear = today > new Date(today.getFullYear(), 11, 15, 12) ? today.getFullYear() + 1 : today.getFullYear();
    const exempt = start && start.getFullYear() === cfeYear;
    rows.push({
      id: `cfe-${cfeYear}`, kind: "cfe", title: `Cotisation foncière des entreprises ${cfeYear}`,
      subtitle: exempt ? "Exonérée l’année de création : rien à payer cette année" : "Avis disponible en novembre dans votre espace professionnel",
      due: new Date(cfeYear, 11, 15, 12),
      explain: "La CFE est un impôt local dû par toutes les entreprises, même sans local. L’année de création en est exonérée, puis la base est réduite de moitié la deuxième année. L’avis n’est pas envoyé par courrier : il est dans votre espace professionnel sur impots.gouv.fr.",
      actions: exempt
        ? [{ id: `cfe-${cfeYear}-space`, label: "Créer mon espace professionnel sur impots.gouv.fr" }]
        : [{ id: `cfe-${cfeYear}-space`, label: "Consulter mon avis de CFE en ligne" }, { id: `cfe-${cfeYear}-pay`, label: "Payer la CFE avant le 15 décembre" }],
      href: "https://www.impots.gouv.fr/professionnel",
    });

    const taxYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
    rows.push({
      id: `ir-${taxYear}`, kind: "impot", title: `Déclarer vos revenus ${taxYear}`, approx: true,
      subtitle: `Au printemps ${taxYear + 1}, date limite selon votre département`,
      due: new Date(taxYear + 1, 4, 31, 12),
      explain: "Votre chiffre d’affaires de l’année se reporte sur la déclaration de revenus, case « micro-entrepreneur » (formulaire 2042-C-PRO). Les impôts appliquent un abattement forfaitaire pour frais. Si vous avez choisi le versement libératoire, l’impôt est déjà payé avec vos cotisations : le CA se déclare quand même.",
      actions: [
        { id: `ir-${taxYear}-total`, label: `Relever mon CA total ${taxYear}` },
        { id: `ir-${taxYear}-declare`, label: "Reporter le CA sur la déclaration 2042-C-PRO" },
      ],
      href: "https://www.impots.gouv.fr",
    });

    if (iso(today) < RULES.withholding.startsOn) rows.push({
      id: "precompte-2027", kind: "info", title: "Cotisations prélevées par Q DEAL",
      subtitle: "Changement prévu au 1er janvier 2027",
      due: new Date(`${RULES.withholding.startsOn}T12:00:00`),
      explain: "Les plateformes devront prélever elles-mêmes les cotisations sociales sur le chiffre d’affaires réalisé chez elles et les reverser à l’URSSAF. Votre CA réalisé sur Q DEAL sera alors déjà « cotisé » : vous ne déclarerez plus que le CA fait ailleurs. Ce suivi s’adaptera tout seul.",
      actions: [],
      href: "https://www.autoentrepreneur.urssaf.fr",
    });

    return rows
      .map((row) => ({ ...row, daysLeft: daysBetween(today, row.due) }))
      .sort((a, b) => a.due - b.due);
  }

  // When the portal raises a reminder: 30, 15, 7 and 1 day before, and once it is late.
  function reminderStage(daysLeft) {
    if (daysLeft < 0) return { level: "alert", label: "En retard" };
    if (daysLeft <= 1) return { level: "alert", label: daysLeft === 0 ? "Aujourd’hui" : "Demain" };
    if (daysLeft <= 7) return { level: "alert", label: `J-${daysLeft}` };
    if (daysLeft <= 15) return { level: "info", label: `J-${daysLeft}` };
    if (daysLeft <= 30) return { level: "info", label: `J-${daysLeft}` };
    return null;
  }

  window.QDA = {
    RULES, MONTHS, iso, daysBetween,
    quarterOf, quarterKey, quarterLabel, quarterMonths, shiftQuarter, declarationDue,
    revenueByQuarter, regimeOn, declaration, deadlines, reminderStage,
  };
})();
