-- migrate:up
-- Q DEAL now does cleaning only. The general skills and example missions of
-- 20261010150300_location_reference_data.sql are replaced by the cleaning catalogue:
-- one top-level category (Ménage), four groups, twenty-four services.

CREATE TABLE core.service_groups (
  code     text PRIMARY KEY CHECK (code ~ '^[a-z][a-z_]{1,39}$'),
  label_fr text NOT NULL CHECK (char_length(label_fr) BETWEEN 1 AND 60),
  label_en text NOT NULL CHECK (char_length(label_en) BETWEEN 1 AND 60),
  ord      smallint NOT NULL UNIQUE
);

ALTER TABLE core.skills
  ADD COLUMN group_code text REFERENCES core.service_groups,
  ADD COLUMN ord smallint;

DELETE FROM core.example_mission_skills;
DELETE FROM core.example_missions;
DELETE FROM core.skills;

-- Clients of a cleaning marketplace.
ALTER TABLE core.businesses DROP CONSTRAINT businesses_sector_check,
  ADD CONSTRAINT businesses_sector_check CHECK (sector IN ('conciergerie', 'syndic', 'entreprise', 'particulier', 'automobile'));
ALTER TABLE core.example_missions DROP CONSTRAINT example_missions_sector_check,
  ADD CONSTRAINT example_missions_sector_check CHECK (sector IN ('conciergerie', 'syndic', 'entreprise', 'particulier', 'automobile'));

INSERT INTO core.service_groups (code, label_fr, label_en, ord) VALUES
  ('menage',         'Ménage',                   'Cleaning',           1),
  ('electromenager', 'Nettoyage électroménager', 'Appliance cleaning', 2),
  ('textile',        'Nettoyage textile',        'Textile cleaning',   3),
  ('voiture',        'Nettoyage voiture',        'Car cleaning',       4);

INSERT INTO core.skills (code, label_fr, label_en, group_code, ord) VALUES
  ('menage_domicile',              'Ménage à domicile',               'Home cleaning',                     'menage', 1),
  ('menage_printemps',             'Ménage de printemps',             'Spring cleaning',                   'menage', 2),
  ('menage_etat_des_lieux',        'Ménage d’état des lieux',         'Move-out cleaning',                 'menage', 3),
  ('menage_location_saisonniere',  'Ménage de location saisonnière',  'Holiday-rental cleaning',           'menage', 4),
  ('menage_apres_evenement',       'Ménage après un événement',       'After-event cleaning',              'menage', 5),
  ('repassage',                    'Repassage',                       'Ironing',                           'menage', 6),
  ('nettoyage_vitres',             'Nettoyage de vitres',             'Window cleaning',                   'menage', 7),
  ('lessivage_mur',                'Lessiver un mur',                 'Wall washing',                      'menage', 8),
  ('aide_rangement',               'Aide au rangement de la maison',  'Home tidying help',                 'menage', 9),
  ('nettoyage_fin_chantier',       'Nettoyage de fin de chantier',    'Post-construction cleaning',        'menage', 10),
  ('nettoyage_logement_insalubre', 'Nettoyage de logement insalubre', 'Deep cleaning of a neglected home', 'menage', 11),
  ('nettoyage_hotte',              'Nettoyage de hotte',              'Cooker hood cleaning',              'electromenager', 1),
  ('nettoyage_frigo',              'Nettoyage de frigo',              'Fridge cleaning',                   'electromenager', 2),
  ('nettoyage_four',               'Nettoyage de four',               'Oven cleaning',                     'electromenager', 3),
  ('nettoyage_congelateur',        'Nettoyage de congélateur',        'Freezer cleaning',                  'electromenager', 4),
  ('nettoyage_canape',             'Nettoyage de canapé',             'Sofa cleaning',                     'textile', 1),
  ('nettoyage_tapis',              'Nettoyage de tapis',              'Rug cleaning',                      'textile', 2),
  ('nettoyage_moquette',           'Nettoyage de moquette',           'Carpet cleaning',                   'textile', 3),
  ('nettoyage_matelas',            'Nettoyage de matelas',            'Mattress cleaning',                 'textile', 4),
  ('nettoyage_rideaux',            'Nettoyage de rideaux',            'Curtain cleaning',                  'textile', 5),
  ('lavage_automobile',            'Lavage automobile',               'Car wash',                          'voiture', 1),
  ('nettoyage_interieur_voiture',  'Nettoyage intérieur de voiture',  'Car interior cleaning',             'voiture', 2),
  ('nettoyage_exterieur_voiture',  'Nettoyage extérieur de voiture',  'Car exterior cleaning',             'voiture', 3),
  ('lustrage_voiture',             'Lustrage de voiture',             'Car polishing',                     'voiture', 4);

ALTER TABLE core.skills ALTER COLUMN group_code SET NOT NULL, ALTER COLUMN ord SET NOT NULL;
ALTER TABLE core.skills ADD CONSTRAINT skills_group_ord_key UNIQUE (group_code, ord);

INSERT INTO core.example_missions (id, title_fr, title_en, sector, starts_in_days) VALUES
  (1, 'Ménage à domicile',                      'Home cleaning',                      'particulier',  2),
  (2, 'Ménage de location saisonnière',         'Holiday-rental cleaning',            'conciergerie', 1),
  (3, 'Nettoyage de fin de chantier',           'Post-construction cleaning',         'entreprise',   4),
  (4, 'Nettoyage de canapé et de tapis',        'Sofa and rug cleaning',              'particulier',  3),
  (5, 'Nettoyage de four et de hotte',          'Oven and cooker hood cleaning',      'particulier',  5),
  (6, 'Lavage et lustrage d’une voiture',       'Car wash and polishing',             'automobile',   2),
  (7, 'Nettoyage de vitres d’un commerce',      'Shop window cleaning',               'entreprise',   3),
  (8, 'Nettoyage de moquette d’un hall',        'Hallway carpet cleaning',            'syndic',       6);

INSERT INTO core.example_mission_skills (example_id, skill_code) VALUES
  (1, 'menage_domicile'),
  (2, 'menage_location_saisonniere'),
  (3, 'nettoyage_fin_chantier'),
  (4, 'nettoyage_canape'), (4, 'nettoyage_tapis'),
  (5, 'nettoyage_four'), (5, 'nettoyage_hotte'),
  (6, 'lavage_automobile'), (6, 'lustrage_voiture'),
  (7, 'nettoyage_vitres'),
  (8, 'nettoyage_moquette');

-- migrate:down
-- Removes the cleaning catalogue; the earlier general reference data is not restored.
DELETE FROM core.example_mission_skills;
DELETE FROM core.example_missions;
DELETE FROM core.skills;
ALTER TABLE core.skills DROP CONSTRAINT skills_group_ord_key, DROP COLUMN group_code, DROP COLUMN ord;
DROP TABLE core.service_groups;
ALTER TABLE core.businesses DROP CONSTRAINT businesses_sector_check,
  ADD CONSTRAINT businesses_sector_check CHECK (sector IN ('btp', 'commerce', 'conciergerie', 'syndic', 'evenementiel'));
ALTER TABLE core.example_missions DROP CONSTRAINT example_missions_sector_check,
  ADD CONSTRAINT example_missions_sector_check CHECK (sector IN ('btp', 'commerce', 'conciergerie', 'syndic', 'evenementiel'));
