-- Q DEAL · localisation — checks of the privacy rules on the demo data.
-- Runs in a transaction that is rolled back: the database is left as seeded.
\set ON_ERROR_STOP on
\set QUIET on
BEGIN;

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
  BEGIN
    PERFORM 1 FROM core.missions LIMIT 1;
    RAISE EXCEPTION 'qdeal_app can read core.missions';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM 1 FROM core.providers LIMIT 1;
    RAISE EXCEPTION 'qdeal_app can read core.providers';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'ok  3. Le rôle applicatif ne peut pas lire les positions exactes, seulement appeler l’api';
END
$$;

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM api.missions_near_provider(5) WHERE mission_id = 1;  -- Camille has not answered
  ASSERT FOUND, 'mission 1 should be listed for Camille';
  ASSERT NOT r.accepted AND r.address_line IS NULL AND r.precision_m = 1000, 'address leaked before acceptance';
  ASSERT r.distance_km = round(r.distance_km) AND r.distance_km >= 1, 'distance not rounded to the kilometre';
  ASSERT r.postal_code = '67000' AND r.city = 'Strasbourg', 'postal code and city should be shown';
  RAISE NOTICE 'ok  4. Avant acceptation : position à 1 km près, distance au km, code postal et ville seulement';
END
$$;

DO $$
DECLARE a record; r record;
BEGIN
  SELECT * INTO a FROM api.accept_mission(5, 1);
  ASSERT a.address_line = '14 rue des Bouchers, 3e étage', 'accept_mission did not return the address';
  SELECT * INTO r FROM api.missions_near_provider(5) WHERE mission_id = 1;
  ASSERT r.accepted AND r.precision_m = 0 AND r.address_line = a.address_line AND r.lon = a.lon AND r.lat = a.lat,
         'exact location missing after acceptance';
  RAISE NOTICE 'ok  5. Après acceptation : adresse exacte et point exact sur la carte';
END
$$;

DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(2) WHERE mission_id = 5), 'declined mission still listed';
  BEGIN
    PERFORM api.accept_mission(2, 1);  -- Samir cannot hand over keys
    RAISE EXCEPTION 'an unqualified provider accepted a mission';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE 'ok  6. Mission refusée masquée ; un prestataire non qualifié ne peut pas accepter';
END
$$;

DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(11)), 'the Colmar provider sees Strasbourg missions';
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(10)), 'the Haguenau provider sees Strasbourg missions';
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(12)), 'an inactive provider sees missions';
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(4) WHERE mission_id = 4), 'a draft mission is visible';
  ASSERT NOT EXISTS (SELECT 1 FROM api.missions_near_provider(1) WHERE mission_id = 6), 'a closed mission is listed';
  RAISE NOTICE 'ok  7. Hors rayon, inactifs, brouillons et missions terminées : rien ne s’affiche';
END
$$;

DO $$
DECLARE n integer;
BEGIN
  n := api.qualified_providers_count(1, 1);
  ASSERT n = 4, format('mission 1: expected 4 qualified providers (Léa, Inès, Camille, Nora), got %s', n);
  n := api.qualified_providers_count(3, 4);
  ASSERT n = 2, format('mission 4: expected 2 qualified providers (Hugo, Chloé), got %s', n);
  n := api.publish_mission(3, 4);
  ASSERT n = 2, 'publish_mission should return the count';
  ASSERT EXISTS (SELECT 1 FROM api.missions_near_provider(4) WHERE mission_id = 4), 'published mission not visible to Hugo';
  RAISE NOTICE 'ok  8. Compteur entreprise : « 2 prestataires qualifiés à moins de 10 km » à la publication';
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM api.qualified_providers_count(2, 4);
    RAISE EXCEPTION 'a business read another business''s counter';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;
  BEGIN
    PERFORM api.mission_applicants(2, 1);
    RAISE EXCEPTION 'a business read another business''s applicants';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;
  RAISE NOTICE 'ok  9. Une entreprise ne voit que ses propres missions';
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
  RAISE NOTICE 'ok 10. Profils des candidats : prénom, compétences, note et distance arrondie, rien d’autre';
END
$$;

RESET ROLE;

DO $$
DECLARE r record; m core.missions; n integer := 0;
BEGIN
  FOR r IN SELECT * FROM api.missions_near_provider(9) LOOP  -- Nora has accepted nothing
    n := n + 1;
    SELECT * INTO m FROM core.missions WHERE id = r.mission_id;
    ASSERT ST_Equals(ST_SetSRID(ST_MakePoint(r.lon, r.lat), 4326), m.approx_location::geometry),
           format('mission %s is not shown at its blurred point', r.mission_id);
  END LOOP;
  ASSERT n > 0, 'Nora should see missions around her';
  RAISE NOTICE 'ok 11. Sur la carte, le point affiché est toujours le point flouté tant que non acceptée';
END
$$;

ROLLBACK;
\echo 'Tous les tests de localisation passent.'
