-- Builds the data of the static demo page (demo.html / demo-fr.html) by calling the real api
-- functions on the fictional fixtures. demo.js only replays two rules on top of it (how many
-- examples fill a provider's list, which candidates have the chosen skills); this script fails
-- if that replay would differ from what the database returns.
-- Run by db/scripts/export-demo.sh in the same session as the fixtures; prints one JSON document.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages = warning;

CREATE TEMP TABLE demo_personas (provider_id bigint, area_fr text, area_en text, ord int);
INSERT INTO demo_personas VALUES
  (5,  'Esplanade, Strasbourg', 'Esplanade, Strasbourg', 1),
  (1,  'Krutenau, Strasbourg',  'Krutenau, Strasbourg',  2),
  (11, 'Colmar',                'Colmar',                3);

CREATE TEMP TABLE demo_addresses (key text, address_line text, postal_code text, city text, lon float8, lat float8, ord int);
INSERT INTO demo_addresses VALUES
  ('kleber',     'Place Kléber',                   '67000', 'Strasbourg', 7.7459, 48.5835, 1),
  ('universite', 'Place de l’Université',          '67000', 'Strasbourg', 7.7616, 48.5841, 2),
  ('orangerie',  'Parc de l’Orangerie',            '67000', 'Strasbourg', 7.7760, 48.5915, 3),
  ('neudorf',    'Place du Marché, Neudorf',       '67100', 'Strasbourg', 7.7586, 48.5703, 4),
  ('colmar',     'Place de la Cathédrale',         '68000', 'Colmar',     7.3585, 48.0779, 5);

CREATE TEMP TABLE demo_out (k text PRIMARY KEY, v jsonb);
CREATE TEMP TABLE demo_config AS SELECT * FROM core.config;  -- settings as deployed, restored below

-- Provider side -----------------------------------------------------------------
DO $$
DECLARE
  per        record;
  m          record;
  x          record;
  e          record;
  real_rows  jsonb;
  accepted   jsonb;
  examples   jsonb;
  personas   jsonb := '[]';
  open_count integer;
  shown      smallint[];
  prev       smallint[];
  pool_size  integer;
  rule_ids   smallint[];
  api_ids    smallint[];
BEGIN
  SELECT count(*) INTO pool_size FROM core.example_missions WHERE is_active;

  FOR per IN SELECT d.*, p.first_name, p.location, p.travel_radius_km FROM demo_personas d JOIN core.providers p ON p.id = d.provider_id ORDER BY d.ord LOOP
    -- Real missions as the provider sees them now.
    UPDATE core.config SET examples_enabled = false;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', r.mission_id, 'title', r.title, 'business', r.business_name, 'sector', r.sector,
             'startsInDays', round(extract(epoch FROM r.starts_at - now()) / 86400),
             'skills', to_jsonb(core.mission_skill_codes(r.mission_id)), 'qualified', r.qualified, 'accepted', r.accepted,
             'lon', round(r.lon::numeric, 6), 'lat', round(r.lat::numeric, 6), 'precisionM', r.precision_m,
             'distanceKm', r.distance_km, 'postalCode', r.postal_code, 'city', r.city, 'address', r.address_line)
           ORDER BY r.distance_km, r.starts_at), '[]')
    INTO real_rows
    FROM api.missions_near_provider(per.provider_id) r;

    -- What each open mission becomes once accepted (the acceptance is rolled back right after).
    accepted := '{}';
    FOR m IN SELECT r.mission_id FROM api.missions_near_provider(per.provider_id) r WHERE NOT r.accepted AND r.qualified LOOP
      BEGIN
        PERFORM api.accept_mission(per.provider_id, m.mission_id);
        SELECT * INTO x FROM api.missions_near_provider(per.provider_id) r WHERE r.mission_id = m.mission_id;
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
    SELECT count(*) INTO open_count FROM api.missions_near_provider(per.provider_id) r WHERE NOT r.is_example AND NOT r.accepted;
    examples := '[]';
    prev := '{}';
    FOR k IN 1..pool_size LOOP
      UPDATE core.config SET examples_target = open_count + k;
      SELECT array_agg(r.example_id) INTO shown FROM api.missions_near_provider(per.provider_id) r WHERE r.is_example;
      IF cardinality(shown) <> k THEN
        RAISE EXCEPTION 'expected % examples for provider %, got %', k, per.provider_id, cardinality(shown);
      END IF;
      SELECT r.*, em.title_fr, em.title_en INTO e
      FROM api.missions_near_provider(per.provider_id) r
      JOIN core.example_missions em ON em.id = r.example_id
      WHERE r.is_example AND NOT (r.example_id = ANY (prev));
      examples := examples || jsonb_build_array(jsonb_build_object(
        'exampleId', e.example_id, 'titleFr', e.title_fr, 'titleEn', e.title_en, 'sector', e.sector,
        'startsInDays', round(extract(epoch FROM e.starts_at - now()) / 86400),
        'skills', to_jsonb(core.example_skill_codes(e.example_id)), 'qualified', e.qualified,
        'lon', round(e.lon::numeric, 6), 'lat', round(e.lat::numeric, 6), 'precisionM', e.precision_m, 'distanceKm', e.distance_km));
      prev := shown;
    END LOOP;

    -- Check the replay of demo.js: with the real target, the first (target - open) examples.
    UPDATE core.config c SET examples_target = d.examples_target FROM demo_config d;
    SELECT coalesce(array_agg(r.example_id ORDER BY r.example_id), '{}') INTO api_ids FROM api.missions_near_provider(per.provider_id) r WHERE r.is_example;
    SELECT coalesce(array_agg((j->>'exampleId')::smallint ORDER BY (j->>'exampleId')::smallint), '{}') INTO rule_ids
    FROM (SELECT j FROM jsonb_array_elements(examples) WITH ORDINALITY AS t(j, n) WHERE n <= greatest(0, (SELECT examples_target FROM demo_config) - open_count)) s;
    IF api_ids <> rule_ids THEN
      RAISE EXCEPTION 'demo.js would show examples % instead of % for provider %', rule_ids, api_ids, per.provider_id;
    END IF;

    personas := personas || jsonb_build_array(jsonb_build_object(
      'id', per.provider_id, 'firstName', per.first_name, 'areaFr', per.area_fr, 'areaEn', per.area_en,
      'lon', round(ST_X(per.location::geometry)::numeric, 6), 'lat', round(ST_Y(per.location::geometry)::numeric, 6),
      'radiusKm', per.travel_radius_km,
      'skills', to_jsonb(ARRAY(SELECT ps.skill_code FROM core.provider_skills ps WHERE ps.provider_id = per.provider_id ORDER BY 1)),
      'missions', real_rows, 'acceptedState', accepted, 'examples', examples));
  END LOOP;

  INSERT INTO demo_out VALUES ('providers', personas);
END
$$;

-- Business side -----------------------------------------------------------------
DO $$
DECLARE
  a           record;
  p           record;
  mid         bigint;
  skill_order text[];
  codes       text[];
  counts      jsonb;
  candidates  jsonb;
  from_api    jsonb;
  from_rule   jsonb;
  cnt         integer;
  addresses   jsonb := '[]';
BEGIN
  SELECT array_agg(code ORDER BY code) INTO skill_order FROM core.skills;

  FOR a IN SELECT * FROM demo_addresses ORDER BY ord LOOP
    mid := api.create_mission(1, 'Mission de démonstration', a.address_line, a.postal_code, a.city, a.lon, a.lat,
                              now() + interval '2 days', ARRAY[skill_order[1]]);
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

    counts := '[null]';  -- index = bit mask of the chosen skills (bit i = skills[i]); 0 is not allowed
    FOR mask IN 1..(power(2, cardinality(skill_order))::integer - 1) LOOP
      codes := ARRAY(SELECT skill_order[i] FROM generate_subscripts(skill_order, 1) AS i WHERE (mask >> (i - 1)) & 1 = 1);
      DELETE FROM core.mission_skills WHERE mission_id = mid;
      INSERT INTO core.mission_skills (mission_id, skill_code) SELECT mid, c FROM unnest(codes) AS c;
      DELETE FROM core.mission_responses WHERE mission_id = mid;

      SELECT q.qualified_count INTO cnt FROM api.qualified_providers(1, mid) q;
      counts := counts || coalesce(to_jsonb(cnt), 'null'::jsonb);

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
      INTO from_rule FROM jsonb_array_elements(candidates) AS c WHERE (c->'skills') @> to_jsonb(codes);
      IF from_api <> from_rule THEN
        RAISE EXCEPTION 'demo.js would show different applicants at % for %: % vs %', a.key, codes, from_rule, from_api;
      END IF;
    END LOOP;

    addresses := addresses || jsonb_build_array(jsonb_build_object(
      'key', a.key, 'label', a.address_line || ', ' || a.postal_code || ' ' || a.city,
      'counts', counts, 'candidates', candidates));
  END LOOP;

  INSERT INTO demo_out VALUES ('business', jsonb_build_object(
    'id', 1, 'name', (SELECT name FROM core.businesses WHERE id = 1), 'radiusKm', 10, 'addresses', addresses));
  INSERT INTO demo_out VALUES ('skills', (
    SELECT jsonb_agg(jsonb_build_object('code', code, 'fr', label_fr, 'en', label_en) ORDER BY code) FROM core.skills));
END
$$;

SELECT jsonb_build_object(
  'config', (SELECT jsonb_build_object('examplesTarget', d.examples_target, 'countDisplayMin', d.count_display_min, 'blurRadiusM', core.blur_radius_m()) FROM demo_config d),
  'skills', (SELECT v FROM demo_out WHERE k = 'skills'),
  'providers', (SELECT v FROM demo_out WHERE k = 'providers'),
  'business', (SELECT v FROM demo_out WHERE k = 'business')
)::text;
