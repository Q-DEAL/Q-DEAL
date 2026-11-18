-- migrate:up
-- Syndics de copropriété come first at launch (Strasbourg): the services they buy most often get
-- their own group, shown before the others, with example missions to match. Their content follows
-- the field interviews of November 2026 (weekly common-area cleaning, bins, bin room).

INSERT INTO core.service_groups (code, label_fr, label_en, ord) VALUES
  ('copropriete', 'Copropriété', 'Residential buildings', 0);

INSERT INTO core.skills (code, label_fr, label_en, group_code, ord) VALUES
  ('entretien_parties_communes', 'Entretien des parties communes',        'Common-area cleaning',         'copropriete', 1),
  ('sortie_poubelles',           'Sortie et rentrée des poubelles',       'Putting bins out and back in', 'copropriete', 2),
  ('lavage_bacs',                'Lavage des bacs et du local poubelles', 'Bin and bin-room washing',     'copropriete', 3);

INSERT INTO core.example_missions (id, title_fr, title_en, sector, starts_in_days) VALUES
  (9,  'Entretien des parties communes d’un immeuble', 'Common-area cleaning of a building', 'syndic', 2),
  (10, 'Sortie et rentrée des poubelles',              'Putting the bins out and back in',   'syndic', 1),
  (11, 'Lavage des bacs à ordures',                    'Washing the wheelie bins',           'syndic', 4);

INSERT INTO core.example_mission_skills (example_id, skill_code) VALUES
  (9,  'entretien_parties_communes'),
  (10, 'sortie_poubelles'),
  (11, 'lavage_bacs');

-- migrate:down
DELETE FROM core.example_mission_skills WHERE example_id BETWEEN 9 AND 11;
DELETE FROM core.example_missions WHERE id BETWEEN 9 AND 11;
DELETE FROM core.skills WHERE group_code = 'copropriete';
DELETE FROM core.service_groups WHERE code = 'copropriete';
