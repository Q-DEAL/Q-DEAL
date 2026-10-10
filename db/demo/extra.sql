-- Extra fictional missions for the site, loaded after db/fixtures/dev.sql by
-- db/scripts/export-demo.sh only (the tests use the fixtures alone).
-- Addresses never point to a specific home: public places, or a street with a flat number.
INSERT INTO core.missions (business_id, title, description, address_line, postal_code, city, location, starts_at, status)
SELECT business_id, title, description, address_line, postal_code, city,
       ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, now() + starts_in, 'published'
FROM (VALUES
  (1, 'Ménage de printemps d’un T3', 'Ménage en profondeur : cuisine, salle de bain, placards et plinthes.',
      'Rue des Moulins, appartement 1', '67000', 'Strasbourg', 7.7397, 48.5808, interval '1 day'),
  (3, 'Nettoyage de moquette d’un open space', 'Moquette de 120 m² à shampouiner un soir après la fermeture.',
      'Place de Bordeaux, immeuble de bureaux', '67000', 'Strasbourg', 7.7547, 48.5935, interval '5 days'),
  (1, 'Ménage après le départ des voyageurs', 'Ménage d’un T3 et changement du linge.',
      'Rue de Lunéville, appartement 1C', '67100', 'Strasbourg', 7.7530, 48.5680, interval '2 days'),
  (4, 'Lavage et lustrage de véhicules', 'Lavage extérieur et lustrage de quatre véhicules de direction.',
      'Place des Halles, parking', '67000', 'Strasbourg', 7.7425, 48.5862, interval '3 days'),
  (1, 'Nettoyage de canapé et de tapis', 'Canapé trois places et tapis du salon d’un appartement loué.',
      'Rue Sainte-Hélène, appartement 2A', '67000', 'Strasbourg', 7.7465, 48.5790, interval '2 days'),
  (3, 'Nettoyage de vitres d’une agence', 'Vitrine et vitres intérieures d’une agence en rez-de-chaussée.',
      'Place Broglie, rez-de-chaussée', '67000', 'Strasbourg', 7.7495, 48.5855, interval '1 day'),
  (1, 'Nettoyage de four et de frigo avant une location', 'Four, plaques et réfrigérateur d’une cuisine équipée.',
      'Rue du Fossé des Tanneurs, appartement 4', '67000', 'Strasbourg', 7.7435, 48.5820, interval '4 days'),
  (1, 'Nettoyage de matelas d’un studio', 'Deux matelas à nettoyer et désinfecter entre deux locations.',
      'Rue d’Austerlitz, studio 3', '67000', 'Strasbourg', 7.7540, 48.5770, interval '3 days')
) AS v(business_id, title, description, address_line, postal_code, city, lon, lat, starts_in);

INSERT INTO core.mission_skills (mission_id, skill_code)
SELECT m.id, s.code
FROM core.missions m
JOIN (VALUES
  ('Ménage de printemps d’un T3', 'menage_printemps'),
  ('Nettoyage de moquette d’un open space', 'nettoyage_moquette'),
  ('Ménage après le départ des voyageurs', 'menage_location_saisonniere'),
  ('Lavage et lustrage de véhicules', 'lavage_automobile'),
  ('Lavage et lustrage de véhicules', 'lustrage_voiture'),
  ('Nettoyage de canapé et de tapis', 'nettoyage_canape'),
  ('Nettoyage de canapé et de tapis', 'nettoyage_tapis'),
  ('Nettoyage de vitres d’une agence', 'nettoyage_vitres'),
  ('Nettoyage de four et de frigo avant une location', 'nettoyage_four'),
  ('Nettoyage de four et de frigo avant une location', 'nettoyage_frigo'),
  ('Nettoyage de matelas d’un studio', 'nettoyage_matelas')
) AS s(title, code) ON s.title = m.title;
