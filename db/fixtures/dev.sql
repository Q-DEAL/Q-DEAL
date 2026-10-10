-- Development and test fixtures: fictional people and addresses around Strasbourg.
-- Never load this file in production (db/scripts/dev-setup.sh refuses non-local databases).
DO $$ BEGIN PERFORM setseed(0.42); END $$;  -- reproducible blurred points

INSERT INTO core.businesses (name, sector) VALUES
  ('Conciergerie Kléber',   'conciergerie'),  -- 1
  ('Rhin Construction',     'btp'),           -- 2
  ('Marché des Halles',     'commerce'),      -- 3
  ('Strasbourg Événements', 'evenementiel');  -- 4

INSERT INTO core.providers (first_name, last_name, location, travel_radius_km, is_active)
SELECT first_name, last_name, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, radius, active
FROM (VALUES
  ('Léa',     'Martin',   7.7600, 48.5790,  8, true),   -- 1  Krutenau
  ('Samir',   'Haddad',   7.7570, 48.5650, 10, true),   -- 2  Neudorf
  ('Inès',    'Dupont',   7.7820, 48.6000,  6, true),   -- 3  Robertsau
  ('Hugo',    'Weber',    7.7230, 48.5960, 12, true),   -- 4  Cronenbourg
  ('Camille', 'Roth',     7.7690, 48.5830,  5, true),   -- 5  Esplanade
  ('Yanis',   'Benali',   7.7150, 48.5590, 15, true),   -- 6  Montagne Verte
  ('Chloé',   'Muller',   7.7980, 48.5550, 10, true),   -- 7  Neuhof
  ('Lucas',   'Schmitt',  7.6920, 48.5890, 20, true),   -- 8  Eckbolsheim
  ('Nora',    'Keller',   7.7450, 48.5800,  4, true),   -- 9  Centre
  ('Théo',    'Fischer',  7.7900, 48.8150, 15, true),   -- 10 Haguenau, ~27 km
  ('Sarah',   'Klein',    7.3585, 48.0794, 30, true),   -- 11 Colmar, ~64 km
  ('Maxime',  'Bauer',    7.7550, 48.5760, 10, false)   -- 12 Centre, inactive
) AS v(first_name, last_name, lon, lat, radius, active);

INSERT INTO core.provider_skills (provider_id, skill_code) VALUES
  (1, 'remise_cles'), (1, 'accueil'), (1, 'menage'),
  (2, 'manutention'), (2, 'rangement_chantier'),
  (3, 'accueil'), (3, 'montage_evenement'), (3, 'menage'), (3, 'remise_cles'),
  (4, 'manutention'), (4, 'mise_en_rayon'),
  (5, 'remise_cles'), (5, 'accueil'),
  (6, 'manutention'), (6, 'rangement_chantier'), (6, 'montage_evenement'),
  (7, 'menage'), (7, 'mise_en_rayon'),
  (8, 'manutention'), (8, 'montage_evenement'),
  (9, 'remise_cles'), (9, 'accueil'), (9, 'menage'),
  (10, 'remise_cles'), (10, 'accueil'),
  (11, 'manutention'),
  (12, 'remise_cles'), (12, 'accueil');

INSERT INTO core.missions (business_id, title, description, address_line, postal_code, city, location, starts_at, status)
SELECT business_id, title, description, address_line, postal_code, city,
       ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, now() + starts_in, status
FROM (VALUES
  (1, 'Check-in et remise des clés', 'Accueillir deux voyageurs et leur remettre les clés d’un appartement.',
      '14 rue des Bouchers, 3e étage', '67000', 'Strasbourg', 7.7562, 48.5793, interval '2 days', 'published'),        -- 1
  (1, 'Ménage entre deux locations', 'Ménage complet d’un T2 avant l’arrivée des prochains voyageurs.',
      '8 quai des Pêcheurs', '67000', 'Strasbourg', 7.7598, 48.5812, interval '3 days', 'published'),                 -- 2
  (2, 'Rangement de matériel sur chantier', 'Trier et ranger l’outillage dans le conteneur de chantier.',
      'Rue du Port du Rhin, chantier B', '67100', 'Strasbourg', 7.7905, 48.5703, interval '1 day', 'published'),      -- 3
  (3, 'Mise en rayon avant ouverture', 'Réassort des rayons frais entre 6 h et 8 h.',
      'Place des Halles', '67000', 'Strasbourg', 7.7420, 48.5860, interval '4 days', 'draft'),                        -- 4
  (4, 'Montage d’un salon professionnel', 'Montage de stands et manutention du mobilier.',
      'Parc des expositions, avenue Herrenschmidt', '67000', 'Strasbourg', 7.7680, 48.5950, interval '6 days', 'published'), -- 5
  (1, 'Accueil de voyageurs (terminée)', 'Mission passée, utilisée pour les avis.',
      '3 rue de la Douane', '67000', 'Strasbourg', 7.7480, 48.5810, interval '-10 days', 'closed')                   -- 6
) AS v(business_id, title, description, address_line, postal_code, city, lon, lat, starts_in, status);

INSERT INTO core.mission_skills (mission_id, skill_code) VALUES
  (1, 'remise_cles'), (1, 'accueil'),
  (2, 'menage'),
  (3, 'rangement_chantier'), (3, 'manutention'),
  (4, 'mise_en_rayon'),
  (5, 'montage_evenement'), (5, 'manutention'),
  (6, 'accueil');

INSERT INTO core.mission_responses (mission_id, provider_id, status) VALUES
  (1, 1, 'accepted'),   -- Léa sees the exact address of mission 1
  (1, 3, 'accepted'),
  (5, 2, 'declined'),
  (6, 1, 'accepted'), (6, 3, 'accepted'), (6, 5, 'accepted');

INSERT INTO core.reviews (mission_id, provider_id, rating) VALUES
  (6, 1, 5), (6, 3, 4), (6, 5, 5);
