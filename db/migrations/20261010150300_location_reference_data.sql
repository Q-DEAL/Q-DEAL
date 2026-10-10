-- migrate:up
-- Location feature: reference data needed in every environment, production included.
-- No people and no addresses here: development fixtures live in db/fixtures/.

INSERT INTO core.config DEFAULT VALUES;

INSERT INTO core.skills (code, label_fr, label_en) VALUES
  ('remise_cles',        'Remise des clés',       'Key handover'),
  ('accueil',            'Accueil',               'Guest welcome'),
  ('menage',             'Ménage',                'Cleaning'),
  ('manutention',        'Manutention',           'Handling'),
  ('rangement_chantier', 'Rangement de chantier', 'Site tidying'),
  ('mise_en_rayon',      'Mise en rayon',         'Shelf stocking'),
  ('montage_evenement',  'Montage d’événement',   'Event setup');

INSERT INTO core.example_missions (id, title_fr, title_en, sector, starts_in_days) VALUES
  (1, 'Remise des clés à des voyageurs',         'Key handover to guests',              'conciergerie', 2),
  (2, 'Ménage entre deux locations',             'Turnover cleaning between stays',     'conciergerie', 3),
  (3, 'Rangement d’outillage sur chantier',      'Tool tidying on a building site',     'btp',          1),
  (4, 'Mise en rayon avant ouverture',           'Shelf stocking before opening',       'commerce',     4),
  (5, 'Réception et déballage d’une livraison',  'Receiving and unpacking a delivery',  'commerce',     3),
  (6, 'Montage de stands pour un salon',         'Stand setup for a trade show',        'evenementiel', 6),
  (7, 'Accueil des invités d’un séminaire',      'Welcoming seminar guests',            'evenementiel', 5),
  (8, 'Entretien du local poubelles',            'Bin store cleaning',                  'syndic',       2);

INSERT INTO core.example_mission_skills (example_id, skill_code) VALUES
  (1, 'remise_cles'), (1, 'accueil'),
  (2, 'menage'),
  (3, 'rangement_chantier'), (3, 'manutention'),
  (4, 'mise_en_rayon'),
  (5, 'manutention'),
  (6, 'montage_evenement'), (6, 'manutention'),
  (7, 'accueil'),
  (8, 'menage');

-- migrate:down
DELETE FROM core.example_mission_skills WHERE example_id BETWEEN 1 AND 8;
DELETE FROM core.example_missions WHERE id BETWEEN 1 AND 8;
DELETE FROM core.skills WHERE code IN ('remise_cles', 'accueil', 'menage', 'manutention', 'rangement_chantier', 'mise_en_rayon', 'montage_evenement');
DELETE FROM core.config;
