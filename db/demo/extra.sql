-- Extra fictional data for the site, loaded after db/fixtures/dev.sql by
-- db/scripts/export-demo.sh only (the tests use the fixtures alone).
-- Syndics de copropriété come first: most missions are the ones they buy (common areas, bins, bin
-- room), modelled on the field interviews of November 2026. Names and addresses are fictional.
-- Addresses never point to a specific home: public places, or a street with a building name.

INSERT INTO core.businesses (name, sector) VALUES
  ('Copropriété Les Platanes', 'syndic');   -- 5: a small building run by its own council

-- Demo providers who also do building work, so the syndic missions reach them.
INSERT INTO core.provider_skills (provider_id, skill_code) VALUES
  (1, 'entretien_parties_communes'), (1, 'sortie_poubelles'),
  (2, 'entretien_parties_communes'), (2, 'lavage_bacs'),
  (5, 'entretien_parties_communes'), (5, 'sortie_poubelles'),
  (6, 'lavage_bacs'), (6, 'sortie_poubelles'),
  (7, 'entretien_parties_communes'),
  (9, 'sortie_poubelles');

INSERT INTO core.missions (business_id, title, description, address_line, postal_code, city, location, starts_at, status)
SELECT business_id, title, description, address_line, postal_code, city,
       ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, now() + starts_in, 'published'
FROM (VALUES
  (2, 'Entretien hebdomadaire des parties communes', 'Hall, escaliers et paliers, cabine d’ascenseur, boîtes aux lettres et vitre de la porte d’entrée. Un passage par semaine, le mardi matin.',
      'Rue de Zurich, résidence Les Quais, bâtiment A', '67000', 'Strasbourg', 7.7560, 48.5800, interval '2 days'),
  (5, 'Sortie et rentrée des poubelles', 'Sortie des bacs le lundi et le jeudi soir, rentrée le lendemain matin. Badge d’accès remis par le conseil syndical.',
      'Rue de l’Académie, résidence Les Platanes', '67000', 'Strasbourg', 7.7640, 48.5795, interval '1 day'),
  (2, 'Remplacement de l’agent d’entretien pendant deux semaines', 'Notre prestataire habituel est absent : deux passages par semaine dans un immeuble de 18 logements, hall et cage d’escalier.',
      'Rue du Jeu-des-Enfants, résidence Le Broglie', '67000', 'Strasbourg', 7.7470, 48.5845, interval '1 day'),
  (5, 'Entretien des parties communes d’une petite copropriété', 'Immeuble de 6 logements sur 2 paliers : hall, escaliers en moquette, main courante et local poubelles. Un passage par semaine.',
      'Rue de l’Académie, résidence Les Platanes', '67000', 'Strasbourg', 7.7643, 48.5798, interval '3 days'),
  (2, 'Sortie et rentrée des poubelles de deux immeubles', 'Collecte le mercredi : sortie des bacs le mardi soir, rentrée le mercredi matin. Deux immeubles voisins.',
      'Rue de Lunéville, résidences Les Tilleuls', '67100', 'Strasbourg', 7.7530, 48.5680, interval '2 days'),
  (2, 'Lavage et désinfection des bacs à ordures', 'Huit bacs et le sol du local poubelles à laver et désinfecter. Point d’eau sur place.',
      'Rue du Port du Rhin, résidence B', '67100', 'Strasbourg', 7.7895, 48.5708, interval '4 days'),
  (2, 'Shampouinage de la moquette d’une cage d’escalier', 'Moquette des escaliers et paliers sur 4 étages, à shampouiner en journée.',
      'Avenue de la Forêt-Noire, résidence Les Vosges', '67000', 'Strasbourg', 7.7700, 48.5770, interval '6 days'),
  (2, 'Nettoyage des vitres du hall', 'Porte d’entrée vitrée et deux baies du hall, côté intérieur et côté rue, au rez-de-chaussée.',
      'Rue de Zurich, résidence Les Quais, bâtiment A', '67000', 'Strasbourg', 7.7562, 48.5802, interval '3 days'),
  (3, 'Nettoyage de moquette d’un open space', 'Moquette de 120 m² à shampouiner un soir après la fermeture.',
      'Place de Bordeaux, immeuble de bureaux', '67000', 'Strasbourg', 7.7547, 48.5935, interval '5 days'),
  (3, 'Nettoyage de vitres d’une agence', 'Vitrine et vitres intérieures d’une agence en rez-de-chaussée.',
      'Place Broglie, rez-de-chaussée', '67000', 'Strasbourg', 7.7495, 48.5855, interval '1 day')
) AS v(business_id, title, description, address_line, postal_code, city, lon, lat, starts_in);

INSERT INTO core.mission_skills (mission_id, skill_code)
SELECT m.id, s.code
FROM core.missions m
JOIN (VALUES
  ('Entretien hebdomadaire des parties communes', 'entretien_parties_communes'),
  ('Sortie et rentrée des poubelles', 'sortie_poubelles'),
  ('Remplacement de l’agent d’entretien pendant deux semaines', 'entretien_parties_communes'),
  ('Entretien des parties communes d’une petite copropriété', 'entretien_parties_communes'),
  ('Sortie et rentrée des poubelles de deux immeubles', 'sortie_poubelles'),
  ('Lavage et désinfection des bacs à ordures', 'lavage_bacs'),
  ('Shampouinage de la moquette d’une cage d’escalier', 'nettoyage_moquette'),
  ('Nettoyage des vitres du hall', 'nettoyage_vitres'),
  ('Nettoyage de moquette d’un open space', 'nettoyage_moquette'),
  ('Nettoyage de vitres d’une agence', 'nettoyage_vitres')
) AS s(title, code) ON s.title = m.title;
