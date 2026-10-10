-- Development and test fixtures: fictional people and addresses around Strasbourg.
-- Never load this file in production (db/scripts/dev-setup.sh refuses non-local databases).
DO $$ BEGIN PERFORM setseed(0.42); END $$;  -- reproducible blurred points

INSERT INTO core.businesses (name, sector) VALUES
  ('Conciergerie Kléber',     'conciergerie'),  -- 1
  ('Rhin Habitat Syndic',     'syndic'),        -- 2
  ('Bureaux des Halles',      'entreprise'),    -- 3
  ('Lavage Auto Strasbourg',  'automobile');    -- 4

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
  (1, 'menage_domicile'), (1, 'menage_location_saisonniere'), (1, 'repassage'), (1, 'nettoyage_vitres'),
  (2, 'nettoyage_fin_chantier'), (2, 'lessivage_mur'), (2, 'nettoyage_logement_insalubre'), (2, 'nettoyage_moquette'),
  (3, 'menage_domicile'), (3, 'menage_location_saisonniere'), (3, 'menage_apres_evenement'), (3, 'nettoyage_canape'), (3, 'nettoyage_tapis'),
  (4, 'lavage_automobile'), (4, 'nettoyage_interieur_voiture'), (4, 'nettoyage_exterieur_voiture'), (4, 'lustrage_voiture'),
  (5, 'menage_domicile'), (5, 'menage_location_saisonniere'), (5, 'nettoyage_four'), (5, 'nettoyage_frigo'),
  (6, 'nettoyage_fin_chantier'), (6, 'lessivage_mur'), (6, 'nettoyage_hotte'), (6, 'nettoyage_four'),
  (7, 'nettoyage_canape'), (7, 'nettoyage_matelas'), (7, 'nettoyage_rideaux'), (7, 'nettoyage_moquette'), (7, 'menage_printemps'),
  (8, 'lavage_automobile'), (8, 'nettoyage_interieur_voiture'), (8, 'nettoyage_fin_chantier'),
  (9, 'menage_domicile'), (9, 'menage_location_saisonniere'), (9, 'repassage'), (9, 'aide_rangement'),
  (10, 'menage_domicile'), (10, 'menage_location_saisonniere'),
  (11, 'nettoyage_fin_chantier'),
  (12, 'menage_domicile'), (12, 'menage_location_saisonniere');

INSERT INTO core.missions (business_id, title, description, address_line, postal_code, city, location, starts_at, status)
SELECT business_id, title, description, address_line, postal_code, city,
       ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, now() + starts_in, status
FROM (VALUES
  (1, 'Ménage de location saisonnière avant arrivée', 'Ménage complet d’un T2 et changement du linge avant l’arrivée des voyageurs.',
      'Rue des Bouchers, appartement 3B', '67000', 'Strasbourg', 7.7562, 48.5793, interval '2 days', 'published'),        -- 1
  (1, 'Repassage entre deux locations', 'Repassage du linge de lit et des serviettes d’un studio.',
      'Quai des Pêcheurs, studio 2', '67000', 'Strasbourg', 7.7598, 48.5812, interval '3 days', 'published'),             -- 2
  (2, 'Nettoyage de fin de chantier des parties communes', 'Hall et cage d’escalier après des travaux de peinture.',
      'Rue du Port du Rhin, résidence B', '67100', 'Strasbourg', 7.7905, 48.5703, interval '1 day', 'published'),         -- 3
  (3, 'Nettoyage de vitres des bureaux', 'Vitres intérieures et extérieures d’un plateau de bureaux au 2e étage.',
      'Place des Halles', '67000', 'Strasbourg', 7.7420, 48.5860, interval '4 days', 'draft'),                            -- 4
  (4, 'Nettoyage intérieur de véhicules de location', 'Aspirateur, surfaces et vitres de six véhicules.',
      'Avenue Herrenschmidt, parking', '67000', 'Strasbourg', 7.7680, 48.5950, interval '6 days', 'published'),           -- 5
  (1, 'Ménage de location saisonnière (terminée)', 'Mission passée, utilisée pour les avis.',
      'Rue de la Douane, studio 4', '67000', 'Strasbourg', 7.7480, 48.5810, interval '-10 days', 'closed')               -- 6
) AS v(business_id, title, description, address_line, postal_code, city, lon, lat, starts_in, status);

INSERT INTO core.mission_skills (mission_id, skill_code) VALUES
  (1, 'menage_location_saisonniere'),
  (2, 'repassage'),
  (3, 'nettoyage_fin_chantier'),
  (4, 'nettoyage_vitres'),
  (5, 'nettoyage_interieur_voiture'),
  (6, 'menage_location_saisonniere');

INSERT INTO core.mission_responses (mission_id, provider_id, status) VALUES
  (1, 1, 'accepted'),   -- Léa sees the exact address of mission 1
  (1, 3, 'accepted'),
  (5, 2, 'declined'),
  (6, 1, 'accepted'), (6, 3, 'accepted'), (6, 5, 'accepted');

INSERT INTO core.reviews (mission_id, provider_id, rating) VALUES
  (6, 1, 5), (6, 3, 4), (6, 5, 5);
