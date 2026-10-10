-- Extra fictional missions for the public demo, loaded after db/fixtures/dev.sql by
-- db/scripts/export-demo.sh only (the tests use the fixtures alone).
-- Addresses never point to a specific home: public places, or a street with a flat number.
INSERT INTO core.missions (business_id, title, description, address_line, postal_code, city, location, starts_at, status)
SELECT business_id, title, description, address_line, postal_code, city,
       ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, now() + starts_in, 'published'
FROM (VALUES
  (1, 'Remise des clés d’un studio en Petite France', 'Accueillir un voyageur en fin de journée et lui présenter le studio.',
      'Rue des Moulins, studio 1', '67000', 'Strasbourg', 7.7397, 48.5808, interval '1 day'),
  (4, 'Accueil des participants d’un congrès', 'Orienter les participants et remettre les badges à l’entrée.',
      'Palais de la Musique et des Congrès, place de Bordeaux', '67000', 'Strasbourg', 7.7547, 48.5935, interval '5 days'),
  (1, 'Ménage après le départ des voyageurs', 'Ménage d’un T3 et changement du linge.',
      'Rue de Lunéville, appartement 1C', '67100', 'Strasbourg', 7.7530, 48.5680, interval '2 days'),
  (3, 'Réception d’une livraison', 'Décharger et ranger une livraison de produits secs.',
      'Place des Halles, quai de livraison', '67000', 'Strasbourg', 7.7425, 48.5862, interval '3 days')
) AS v(business_id, title, description, address_line, postal_code, city, lon, lat, starts_in);

INSERT INTO core.mission_skills (mission_id, skill_code)
SELECT m.id, s.code
FROM core.missions m
JOIN (VALUES
  ('Remise des clés d’un studio en Petite France', 'remise_cles'),
  ('Accueil des participants d’un congrès', 'accueil'),
  ('Ménage après le départ des voyageurs', 'menage'),
  ('Réception d’une livraison', 'manutention')
) AS s(title, code) ON s.title = m.title;
