-- Builds the mission data of the static site (missions*.html, post-task*.html) by calling the
-- real api functions on the fictional fixtures. localisation.js only replays two rules on top of
-- it (how many examples fill a list, which candidates have the chosen skills); this script fails
-- if that replay would differ from what the database returns.
-- Run by db/scripts/export-demo.sh in the same session as the fixtures; prints one JSON document.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages = warning;

-- Places a visitor can search: Strasbourg and its surroundings only, where the (fictional)
-- missions are. A visitor is treated as a provider with every skill and a 10 km radius standing there.
CREATE TEMP TABLE site_places (key text, label_fr text, label_en text, terms text[], lon float8, lat float8, ord int);
INSERT INTO site_places VALUES
  ('strasbourg',             'Strasbourg',               'Strasbourg',               '{strasbourg,67000,67100,67200}', 7.7459, 48.5835, 1),
  ('strasbourg-krutenau',    'Strasbourg · Krutenau',    'Strasbourg · Krutenau',    '{krutenau}',                      7.7600, 48.5790, 2),
  ('strasbourg-neudorf',     'Strasbourg · Neudorf',     'Strasbourg · Neudorf',     '{neudorf}',                       7.7586, 48.5703, 3),
  ('strasbourg-robertsau',   'Strasbourg · Robertsau',   'Strasbourg · Robertsau',   '{robertsau}',                     7.7820, 48.6000, 4),
  ('strasbourg-cronenbourg', 'Strasbourg · Cronenbourg', 'Strasbourg · Cronenbourg', '{cronenbourg}',                   7.7230, 48.5960, 5),
  ('schiltigheim',           'Schiltigheim',             'Schiltigheim',             '{schiltigheim,67300}',            7.7480, 48.6060, 6),
  ('illkirch',               'Illkirch-Graffenstaden',   'Illkirch-Graffenstaden',   '{illkirch,67400}',                7.7150, 48.5290, 7);

-- Addresses offered on the mission form (public places only).
CREATE TEMP TABLE site_addresses (key text, address_line text, postal_code text, city text, lon float8, lat float8, ord int);
INSERT INTO site_addresses VALUES
  ('kleber',     'Place Kléber',             '67000', 'Strasbourg', 7.7459, 48.5835, 1),
  ('universite', 'Place de l’Université',    '67000', 'Strasbourg', 7.7616, 48.5841, 2),
  ('orangerie',  'Parc de l’Orangerie',      '67000', 'Strasbourg', 7.7760, 48.5915, 3),
  ('neudorf',    'Place du Marché, Neudorf', '67100', 'Strasbourg', 7.7586, 48.5703, 4);

CREATE TEMP TABLE site_out (k text PRIMARY KEY, v jsonb);
CREATE TEMP TABLE site_config AS SELECT * FROM core.config;  -- settings as deployed, restored below

-- Business side (computed first: the visitor providers below must not be counted) -----------
-- A mission asks for one service; for each form address and each service: counter and applicants.
DO $$
DECLARE
  a           record;
  p           record;
  svc         record;
  mid         bigint;
  counts      jsonb;
  candidates  jsonb;
  from_api    jsonb;
  from_rule   jsonb;
  cnt         integer;
  addresses   jsonb := '[]';
BEGIN
  FOR a IN SELECT * FROM site_addresses ORDER BY ord LOOP
    mid := api.create_mission(1, 'Mission publiée depuis le site', a.address_line, a.postal_code, a.city, a.lon, a.lat,
                              now() + interval '2 days', ARRAY['menage_domicile']);
    UPDATE core.missions SET status = 'published' WHERE id = mid;

    -- Providers allowed to accept a mission here, skills aside (same radius rule as api.accept_mission).
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', p2.id, 'firstName', p2.first_name,
             'skills', to_jsonb(ARRAY(SELECT ps.skill_code FROM core.provider_skills ps WHERE ps.provider_id = p2.id ORDER BY 1)),
             'rating', rv.rating, 'reviewCount', coalesce(rv.n, 0),
             'distanceKm', core.round_km(ST_Distance(p2.location, m.location)))
           ORDER BY core.round_km(ST_Distance(p2.location, m.location)), p2.id), '[]')
    INTO candidates
    FROM core.missions m
    JOIN core.providers p2 ON p2.is_active AND ST_DWithin(m.approx_location, p2.location, p2.travel_radius_km * 1000)
    LEFT JOIN LATERAL (SELECT round(avg(r.rating), 1) AS rating, count(*)::integer AS n FROM core.reviews r WHERE r.provider_id = p2.id) rv ON true
    WHERE m.id = mid;

    counts := '{}';
    FOR svc IN SELECT code FROM core.skills ORDER BY code LOOP
      DELETE FROM core.mission_skills WHERE mission_id = mid;
      INSERT INTO core.mission_skills (mission_id, skill_code) VALUES (mid, svc.code);
      DELETE FROM core.mission_responses WHERE mission_id = mid;

      SELECT q.qualified_count INTO cnt FROM api.qualified_providers(1, mid) q;
      counts := counts || jsonb_build_object(svc.code, coalesce(to_jsonb(cnt), 'null'::jsonb));

      -- As on the platform: every provider tries to accept; the api keeps those who may.
      FOR p IN SELECT id FROM core.providers LOOP
        BEGIN
          PERFORM api.accept_mission(p.id, mid);
        EXCEPTION WHEN SQLSTATE 'QD001' OR SQLSTATE 'QD003' OR SQLSTATE 'QD004' THEN
          NULL;
        END;
      END LOOP;
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.provider_id, 'firstName', x.first_name, 'rating', x.rating,
                                                   'reviewCount', x.review_count, 'distanceKm', x.distance_km) ORDER BY x.provider_id), '[]')
      INTO from_api FROM api.mission_applicants(1, mid) x;
      SELECT coalesce(jsonb_agg(c - 'skills' ORDER BY (c->>'id')::bigint), '[]')
      INTO from_rule FROM jsonb_array_elements(candidates) AS c WHERE c->'skills' ? svc.code;
      IF from_api <> from_rule THEN
        RAISE EXCEPTION 'localisation.js would show different applicants at % for %: % vs %', a.key, svc.code, from_rule, from_api;
      END IF;
    END LOOP;

    -- The mission is only a vehicle for the computation: it must not appear in the visitor views.
    DELETE FROM core.missions WHERE id = mid;
    addresses := addresses || jsonb_build_array(jsonb_build_object(
      'key', a.key, 'label', a.address_line || ', ' || a.postal_code || ' ' || a.city,
      'counts', counts, 'candidates', candidates));
  END LOOP;

  INSERT INTO site_out VALUES ('business', jsonb_build_object('radiusKm', 10, 'addresses', addresses));
  INSERT INTO site_out VALUES ('groups', (
    SELECT jsonb_agg(jsonb_build_object('code', code, 'fr', label_fr, 'en', label_en) ORDER BY ord) FROM core.service_groups));
  INSERT INTO site_out VALUES ('skills', (
    SELECT jsonb_agg(jsonb_build_object('code', s.code, 'fr', s.label_fr, 'en', s.label_en, 'group', s.group_code) ORDER BY g.ord, s.ord)
    FROM core.skills s JOIN core.service_groups g ON g.code = s.group_code));
END
$$;

-- Visitor side: missions around each place ------------------------------------------------
DO $$
DECLARE
  pl         record;
  m          record;
  x          record;
  e          record;
  visitor    bigint;
  real_rows  jsonb;
  accepted   jsonb;
  examples   jsonb;
  places     jsonb := '[]';
  open_count integer;
  shown      smallint[];
  prev       smallint[];
  pool_size  integer;
  rule_ids   smallint[];
  api_ids    smallint[];
  target     integer;
BEGIN
  SELECT count(*) INTO pool_size FROM core.example_missions WHERE is_active;
  SELECT examples_target INTO target FROM site_config;

  FOR pl IN SELECT * FROM site_places ORDER BY ord LOOP
    INSERT INTO core.providers (first_name, last_name, location, travel_radius_km)
    VALUES ('Visiteur', 'Site', ST_SetSRID(ST_MakePoint(pl.lon, pl.lat), 4326)::geography, 10)
    RETURNING id INTO visitor;
    INSERT INTO core.provider_skills (provider_id, skill_code) SELECT visitor, code FROM core.skills;

    UPDATE core.config SET examples_enabled = false;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', r.mission_id, 'title', r.title, 'business', r.business_name, 'sector', r.sector,
             'startsInDays', round(extract(epoch FROM r.starts_at - now()) / 86400),
             'skills', to_jsonb(core.mission_skill_codes(r.mission_id)),
             'lon', round(r.lon::numeric, 6), 'lat', round(r.lat::numeric, 6), 'precisionM', r.precision_m,
             'distanceKm', r.distance_km, 'postalCode', r.postal_code, 'city', r.city)
           ORDER BY r.distance_km, r.starts_at), '[]')
    INTO real_rows
    FROM api.missions_near_provider(visitor) r;

    -- What each mission becomes once accepted (the acceptance is rolled back right after).
    accepted := '{}';
    FOR m IN SELECT r.mission_id FROM api.missions_near_provider(visitor) r LOOP
      BEGIN
        PERFORM api.accept_mission(visitor, m.mission_id);
        SELECT * INTO x FROM api.missions_near_provider(visitor) r WHERE r.mission_id = m.mission_id;
        accepted := accepted || jsonb_build_object(m.mission_id::text, jsonb_build_object(
          'lon', round(x.lon::numeric, 6), 'lat', round(x.lat::numeric, 6), 'precisionM', x.precision_m,
          'distanceKm', x.distance_km, 'postalCode', x.postal_code, 'city', x.city, 'address', x.address_line));
        RAISE EXCEPTION 'rollback' USING ERRCODE = 'QD999';
      EXCEPTION WHEN SQLSTATE 'QD999' THEN
        NULL;
      END;
    END LOOP;

    -- Example missions in the order the database picks them: raising the target one step at a
    -- time adds exactly the next one.
    UPDATE core.config SET examples_enabled = true;
    SELECT count(*) INTO open_count FROM api.missions_near_provider(visitor) r WHERE NOT r.is_example;
    examples := '[]';
    prev := '{}';
    FOR k IN 1..pool_size LOOP
      UPDATE core.config SET examples_target = open_count + k;
      SELECT array_agg(r.example_id) INTO shown FROM api.missions_near_provider(visitor) r WHERE r.is_example;
      IF cardinality(shown) <> k THEN
        RAISE EXCEPTION 'expected % examples at %, got %', k, pl.key, cardinality(shown);
      END IF;
      SELECT r.*, em.title_fr, em.title_en INTO e
      FROM api.missions_near_provider(visitor) r
      JOIN core.example_missions em ON em.id = r.example_id
      WHERE r.is_example AND NOT (r.example_id = ANY (prev));
      examples := examples || jsonb_build_array(jsonb_build_object(
        'exampleId', e.example_id, 'titleFr', e.title_fr, 'titleEn', e.title_en, 'sector', e.sector,
        'startsInDays', round(extract(epoch FROM e.starts_at - now()) / 86400),
        'skills', to_jsonb(core.example_skill_codes(e.example_id)),
        'lon', round(e.lon::numeric, 6), 'lat', round(e.lat::numeric, 6), 'precisionM', e.precision_m, 'distanceKm', e.distance_km));
      prev := shown;
    END LOOP;

    -- Check the replay of localisation.js: with the real target, the first (target - open) examples.
    UPDATE core.config SET examples_target = target;
    SELECT coalesce(array_agg(r.example_id ORDER BY r.example_id), '{}') INTO api_ids FROM api.missions_near_provider(visitor) r WHERE r.is_example;
    SELECT coalesce(array_agg((j->>'exampleId')::smallint ORDER BY (j->>'exampleId')::smallint), '{}') INTO rule_ids
    FROM (SELECT j FROM jsonb_array_elements(examples) WITH ORDINALITY AS t(j, n) WHERE n <= greatest(0, target - open_count)) s;
    IF api_ids <> rule_ids THEN
      RAISE EXCEPTION 'localisation.js would show examples % instead of % at %', rule_ids, api_ids, pl.key;
    END IF;

    DELETE FROM core.providers WHERE id = visitor;
    places := places || jsonb_build_array(jsonb_build_object(
      'key', pl.key, 'labelFr', pl.label_fr, 'labelEn', pl.label_en, 'terms', to_jsonb(pl.terms),
      'lon', pl.lon, 'lat', pl.lat, 'radiusKm', 10,
      'missions', real_rows, 'acceptedState', accepted, 'examples', examples));
  END LOOP;

  INSERT INTO site_out VALUES ('places', places);
END
$$;

SELECT jsonb_build_object(
  'config', (SELECT jsonb_build_object('examplesTarget', c.examples_target, 'countDisplayMin', c.count_display_min, 'blurRadiusM', core.blur_radius_m()) FROM site_config c),
  'groups', (SELECT v FROM site_out WHERE k = 'groups'),
  'skills', (SELECT v FROM site_out WHERE k = 'skills'),
  'places', (SELECT v FROM site_out WHERE k = 'places'),
  'business', (SELECT v FROM site_out WHERE k = 'business')
)::text;

-- Second line: the catalogue used by the search dialog on every page (places, groups, services).
SELECT jsonb_build_object(
  'places', (SELECT jsonb_agg(jsonb_build_object('key', p->'key', 'labelFr', p->'labelFr', 'labelEn', p->'labelEn', 'terms', p->'terms',
                                                 'missionCount', jsonb_array_length(p->'missions')) ORDER BY n)
             FROM site_out, jsonb_array_elements(v) WITH ORDINALITY AS t(p, n) WHERE k = 'places'),
  'groups', (SELECT v FROM site_out WHERE k = 'groups'),
  'services', (SELECT v FROM site_out WHERE k = 'skills')
)::text;
