-- Location feature: checks of the privacy and example-mission rules on db/fixtures/dev.sql.
-- Run by db/scripts/test.sh on a throwaway database; also wrapped in a rolled-back transaction.
\set ON_ERROR_STOP on
\set QUIET on
BEGIN;

-- Fails unless p_sql raises the SQLSTATE p_code.
CREATE FUNCTION pg_temp.expect_error(p_sql text, p_code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE % from: %', p_code, p_sql;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> p_code THEN
    RAISE;
  END IF;
END
$$;

DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad FROM core.missions
  WHERE ST_Distance(location, approx_location) > core.blur_radius_m() + 1
     OR ST_Equals(location::geometry, approx_location::geometry);
  ASSERT bad = 0, format('%s missions have a blurred point outside 1 km or equal to the exact point', bad);
  RAISE NOTICE 'ok  1. Position floutée : à moins de 1 km de l’adresse, jamais identique';
END
$$;

DO $$
DECLARE before geography; after geography;
BEGIN
  SELECT approx_location INTO before FROM core.missions WHERE id = 2;
  UPDATE core.missions SET title = title || ' (modifiée)' WHERE id = 2;
  SELECT approx_location INTO after FROM core.missions WHERE id = 2;
  ASSERT ST_Equals(before::geometry, after::geometry), 'blurred point re-drawn on a title edit';
  UPDATE core.missions SET location = ST_SetSRID(ST_MakePoint(7.7610, 48.5820), 4326)::geography WHERE id = 2;
  SELECT approx_location INTO after FROM core.missions WHERE id = 2;
  ASSERT NOT ST_Equals(before::geometry, after::geometry), 'blurred point kept after the mission moved';
  RAISE NOTICE 'ok  2. Le flou est tiré une seule fois (pas de moyenne possible), retiré si l’adresse change';
END
$$;

SET ROLE qdeal_app;

DO $$
BEGIN
  PERFORM pg_temp.expect_error('SELECT 1 FROM core.missions', '42501');
  PERFORM pg_temp.expect_error('SELECT 1 FROM core.providers', '42501');
  PERFORM pg_temp.expect_error('UPDATE core.config SET examples_enabled = false', '42501');
  RAISE NOTICE 'ok  3. Le rôle applicatif ne lit ni ne modifie les tables : il passe par l’api';
END
$$;

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM api.missions_near_provider(5) WHERE mission_id = 1;  -- Camille has not answered
  ASSERT FOUND, 'mission 1 should be listed for Camille';
  ASSERT NOT r.is_example AND NOT r.accepted AND r.address_line IS NULL AND r.precision_m = 1000, 'address leaked before acceptance';
  ASSERT r.distance_km = round(r.distance_km) AND r.distance_km >= 1, 'distance not rounded to the kilometre';
  ASSERT r.postal_code = '67000' AND r.city = 'Strasbourg', 'postal code and city should be shown';
  RAISE NOTICE 'ok  4. Avant acceptation : position à 1 km près, distance au km, code postal et ville seulement';
END
$$;

DO $$
DECLARE a record; r record;
BEGIN
  SELECT * INTO a FROM api.accept_mission(5, 1);
  ASSERT a.address_line = 'Rue des Bouchers, appartement 3B', 'accept_mission did not return the address';
  SELECT * INTO r FROM api.missions_near_provider(5) WHERE mission_id = 1;
  ASSERT r.accepted AND r.precision_m = 0 AND r.address_line = a.address_line AND r.lon = a.lon AND r.lat = a.lat,
         'exact location missing after acceptance';
  RAISE NOTICE 'ok  5. Après acceptation : adresse exacte et point exact sur la carte';
END
$$;

DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(2) WHERE mission_id = 5), 'declined mission still listed';
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(4) WHERE mission_id = 4), 'a draft mission is visible';
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(1) WHERE mission_id = 6), 'a closed mission is listed';
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(12)), 'an inactive provider sees missions';
  PERFORM pg_temp.expect_error('SELECT * FROM api.accept_mission(2, 1)', 'QD003');   -- Samir cannot hand over keys
  PERFORM pg_temp.expect_error('SELECT * FROM api.accept_mission(10, 1)', 'QD004');  -- Théo lives 27 km away
  PERFORM pg_temp.expect_error('SELECT * FROM api.accept_mission(4, 4)', 'QD002');   -- draft
  PERFORM pg_temp.expect_error('SELECT * FROM api.accept_mission(12, 1)', 'QD001');  -- inactive
  RAISE NOTICE 'ok  6. Refusées, brouillons, terminées et inactifs exclus ; acceptation impossible hors règles';
END
$$;

DO $$
DECLARE n integer; r record; first_two boolean[];
BEGIN
  SELECT count(*) INTO n FROM api.missions_near_provider(11);  -- Sarah, Colmar: nothing real around her
  ASSERT n = 3, format('Sarah should see 3 examples, got %s rows', n);
  FOR r IN SELECT * FROM api.missions_near_provider(11) LOOP
    ASSERT r.is_example AND r.mission_id IS NULL AND r.example_id IS NOT NULL, 'example rows must be flagged and have no mission id';
    ASSERT r.address_line IS NULL AND r.postal_code IS NULL AND r.city IS NULL AND r.business_name IS NULL, 'an example carries an address or a business';
    ASSERT r.precision_m = 1000 AND r.distance_km BETWEEN 1 AND 30 AND r.distance_km = round(r.distance_km), 'example placement out of range';
  END LOOP;
  SELECT array_agg(qualified ORDER BY distance_km) INTO first_two FROM api.missions_near_provider(10);  -- Théo: keys + welcome
  ASSERT (SELECT count(*) FROM unnest(first_two) q WHERE q) >= 2, 'examples matching the provider''s skills should come first';
  ASSERT (SELECT array_agg(lon || ',' || lat ORDER BY example_id) FROM api.missions_near_provider(11))
       = (SELECT array_agg(lon || ',' || lat ORDER BY example_id) FROM api.missions_near_provider(11)), 'examples move between two reads';
  RAISE NOTICE 'ok  7. Zone sans mission : 3 exemples signalés, sans adresse, stables sur la carte, adaptés au profil';
END
$$;

DO $$
DECLARE real_open integer; examples integer;
BEGIN
  SELECT count(*) FILTER (WHERE NOT is_example AND NOT accepted), count(*) FILTER (WHERE is_example)
  INTO real_open, examples FROM api.missions_near_provider(5);
  ASSERT real_open >= 3 AND examples = 0, format('Camille has %s real missions and %s examples', real_open, examples);
  RAISE NOTICE 'ok  8. Zone active : uniquement des missions réelles';
END
$$;

RESET ROLE;
UPDATE core.config SET examples_target = 5;
SET ROLE qdeal_app;

DO $$
DECLARE before integer; after integer; new_id bigint;
BEGIN
  SELECT count(*) INTO before FROM api.missions_near_provider(5) WHERE is_example;
  new_id := api.create_mission(1, 'Remise des clés', '2 rue de l’Université', '67000', 'Strasbourg',
                               7.7700, 48.5840, now() + interval '2 days', ARRAY['remise_cles']);
  PERFORM api.publish_mission(1, new_id);
  SELECT count(*) INTO after FROM api.missions_near_provider(5) WHERE is_example;
  ASSERT after = before - 1, format('a new real mission should replace one example (%s → %s)', before, after);
  RAISE NOTICE 'ok  9. Transition : chaque mission réelle publiée remplace un exemple, sans autre changement';
END
$$;

RESET ROLE;
UPDATE core.config SET examples_enabled = false;
SET ROLE qdeal_app;

DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(11)), 'examples still shown once disabled';
  RAISE NOTICE 'ok 10. Exemples désactivables d’un réglage, sans déploiement';
END
$$;

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM api.qualified_providers(1, 1);
  ASSERT r.qualified_count = 4 AND r.display_min = 3, format('mission 1: expected 4 qualified providers, got %s', r.qualified_count);
  SELECT * INTO r FROM api.qualified_providers(3, 4);  -- 2 real providers stock shelves nearby
  ASSERT r.qualified_count IS NULL AND r.display_min = 3, 'below the threshold the exact count must not be returned';
  SELECT * INTO r FROM api.publish_mission(3, 4);
  ASSERT r.qualified_count IS NULL, 'publish_mission should return the same figure';
  ASSERT EXISTS (SELECT 1 FROM api.missions_near_provider(4) WHERE mission_id = 4), 'published mission not visible to Hugo';
  RAISE NOTICE 'ok 11. Compteur entreprise : prestataires réels uniquement, « moins de 3 » sous le seuil';
END
$$;

DO $$
BEGIN
  PERFORM pg_temp.expect_error('SELECT * FROM api.qualified_providers(2, 1)', 'QD002');
  PERFORM pg_temp.expect_error('SELECT * FROM api.mission_applicants(2, 1)', 'QD002');
  PERFORM pg_temp.expect_error('SELECT * FROM api.qualified_providers(9999, 9999)', 'QD002');
  PERFORM pg_temp.expect_error('SELECT * FROM api.qualified_providers(1, 1, 0)', 'QD005');
  PERFORM pg_temp.expect_error('SELECT * FROM api.missions_near_provider(1, NULL, ''fr'', 0)', 'QD005');
  ASSERT (SELECT count(*) FROM api.missions_near_provider(5, NULL, 'fr', 2)) = 2, 'p_limit not applied';
  PERFORM pg_temp.expect_error($q$SELECT api.create_mission(1, 'Test', 'x', '67000', 'Strasbourg', 7.75, 48.58, now() - interval '1 day', ARRAY['menage'])$q$, 'QD005');
  PERFORM pg_temp.expect_error($q$SELECT api.create_mission(1, 'Test', 'x', '67000', 'Strasbourg', 7.75, 48.58, now() + interval '1 day', ARRAY['inconnue'])$q$, 'QD005');
  PERFORM pg_temp.expect_error($q$SELECT api.create_mission(1, 'Test', 'x', '67000', 'Strasbourg', 7.75, 95, now() + interval '1 day', ARRAY['menage'])$q$, 'QD005');
  PERFORM pg_temp.expect_error($q$SELECT api.create_mission(77, 'Test', 'x', '67000', 'Strasbourg', 7.75, 48.58, now() + interval '1 day', ARRAY['menage'])$q$, 'QD006');
  RAISE NOTICE 'ok 12. Une entreprise ne voit que ses missions ; saisies invalides refusées avec un code clair';
END
$$;

DO $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT * FROM api.mission_applicants(1, 1) LOOP
    n := n + 1;
    ASSERT r.distance_km = round(r.distance_km) AND r.distance_km >= 1, 'applicant distance not rounded';
    ASSERT NOT (to_jsonb(r) ?| array['last_name', 'location', 'lon', 'lat']), 'applicant row exposes more than allowed';
  END LOOP;
  ASSERT n = 3, format('expected 3 applicants (Léa, Inès, Camille), got %s', n);
  SELECT * INTO r FROM api.mission_applicants(1, 1) WHERE first_name = 'Léa';
  ASSERT r.rating = 5.0 AND r.review_count = 1 AND 'Ménage' = ANY (r.skills), 'Léa''s profile is incomplete';
  SELECT * INTO r FROM api.mission_applicants(1, 1) WHERE first_name = 'Camille';
  ASSERT r.review_count = 1, 'review count missing';
  RAISE NOTICE 'ok 13. Profils des candidats : prénom, compétences, note et distance arrondie, rien d’autre';
END
$$;

RESET ROLE;

DO $$
DECLARE r record; m core.missions; n integer := 0;
BEGIN
  FOR r IN SELECT * FROM api.missions_near_provider(9) WHERE NOT is_example LOOP  -- Nora has accepted nothing
    n := n + 1;
    SELECT * INTO m FROM core.missions WHERE id = r.mission_id;
    ASSERT ST_Equals(ST_SetSRID(ST_MakePoint(r.lon, r.lat), 4326), m.approx_location::geometry),
           format('mission %s is not shown at its blurred point', r.mission_id);
  END LOOP;
  ASSERT n > 0, 'Nora should see missions around her';
  RAISE NOTICE 'ok 14. Sur la carte, le point affiché est toujours le point flouté tant que non acceptée';
END
$$;

ROLLBACK;
\echo 'Tous les tests de localisation passent.'
