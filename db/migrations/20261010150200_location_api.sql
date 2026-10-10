-- migrate:up
-- Location feature: functions called by the application.
-- They are SECURITY DEFINER: they read "core" with the owner's rights, while the application
-- role (qdeal_app) has no access to "core". The p_provider_id / p_business_id arguments must
-- come from the authenticated session in the API layer, never from the client.
--
-- Errors (SQLSTATE):
--   QD001 provider not found or inactive    QD004 mission outside the provider's travel radius
--   QD002 mission not found or not open     QD005 invalid argument
--   QD003 provider lacks a required skill   QD006 business not found

-- Provider side ---------------------------------------------------------------

-- Map and list of missions around the provider, nearest first.
-- Real missions not yet accepted: blurred point (precision_m = 1000), whole-kilometre distance,
-- postal code and city only. Accepted missions: exact point and address, distance to 100 m.
-- Declined and closed missions are left out.
-- While fewer than config.examples_target real missions are open around the provider, the list
-- is topped up with example missions (is_example = true, no id, no address, cannot be accepted)
-- placed around the provider; each new real mission replaces one example.
-- At most p_limit rows (nearest first) so a dense area cannot produce an oversized response.
CREATE FUNCTION api.missions_near_provider(
  p_provider_id bigint,
  p_radius_km   numeric DEFAULT NULL,
  p_lang        text DEFAULT 'fr',
  p_limit       integer DEFAULT 100
)
RETURNS TABLE (
  mission_id    bigint,
  example_id    smallint,
  is_example    boolean,
  title         text,
  business_name text,
  sector        text,
  starts_at     timestamptz,
  skills        text[],
  qualified     boolean,
  accepted      boolean,
  lon           double precision,
  lat           double precision,
  precision_m   integer,
  distance_km   numeric,
  postal_code   text,
  city          text,
  address_line  text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
BEGIN
  IF p_radius_km IS NOT NULL AND p_radius_km <= 0 THEN
    RAISE EXCEPTION 'radius must be positive' USING ERRCODE = 'QD005';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'limit must be between 1 and 500' USING ERRCODE = 'QD005';
  END IF;

  RETURN QUERY
  WITH me AS (
    SELECT p.id, p.location,
           least(coalesce(p_radius_km, p.travel_radius_km), p.travel_radius_km) * 1000 AS radius_m
    FROM providers p
    WHERE p.id = p_provider_id AND p.is_active
  ),
  open_nearby AS (
    SELECT m.id
    FROM me
    JOIN missions m ON m.status = 'published' AND ST_DWithin(m.approx_location, me.location, me.radius_m)
    WHERE NOT EXISTS (SELECT 1 FROM mission_responses r WHERE r.mission_id = m.id AND r.provider_id = me.id)
  ),
  accepted_open AS (
    SELECT r.mission_id AS id
    FROM me
    JOIN mission_responses r ON r.provider_id = me.id AND r.status = 'accepted'
    JOIN missions m ON m.id = r.mission_id AND m.status = 'published'
  ),
  real_missions AS (
    SELECT m.id AS mission_id,
           NULL::smallint AS example_id,
           false AS is_example,
           m.title,
           b.name AS business_name,
           b.sector,
           m.starts_at,
           skill_labels(mission_skill_codes(m.id), p_lang) AS skills,
           has_all_skills(me.id, mission_skill_codes(m.id)) AS qualified,
           a.id IS NOT NULL AS accepted,
           CASE WHEN a.id IS NOT NULL THEN m.location ELSE m.approx_location END AS shown,
           CASE WHEN a.id IS NOT NULL THEN 0 ELSE blur_radius_m() END AS precision_m,
           CASE WHEN a.id IS NOT NULL THEN round((ST_Distance(m.location, me.location) / 1000.0)::numeric, 1)
                ELSE round_km(ST_Distance(m.approx_location, me.location)) END AS distance_km,
           m.postal_code,
           m.city,
           CASE WHEN a.id IS NOT NULL THEN m.address_line END AS address_line
    FROM me
    JOIN (SELECT o.id FROM open_nearby o UNION SELECT ao.id FROM accepted_open ao) ids ON true
    JOIN missions m ON m.id = ids.id
    JOIN businesses b ON b.id = m.business_id
    LEFT JOIN accepted_open a ON a.id = m.id
  ),
  example_pool AS (
    SELECT e.*,
           me.id AS provider_id,
           me.location AS provider_location,
           least(me.radius_m, 8000) * (0.25 + 0.75 * sqrt(stable_unit(me.id, e.id, 'distance'))) AS offset_m,
           2 * pi() * stable_unit(me.id, e.id, 'azimuth') AS azimuth,
           has_all_skills(me.id, example_skill_codes(e.id)) AS is_qualified
    FROM me
    JOIN config c ON c.examples_enabled
    JOIN example_missions e ON e.is_active
  ),
  examples AS (
    SELECT x.*, row_number() OVER (ORDER BY x.is_qualified DESC, stable_unit(x.provider_id, x.id, 'order')) AS rank
    FROM example_pool x
  )
  SELECT r.mission_id, r.example_id, r.is_example, r.title, r.business_name, r.sector, r.starts_at, r.skills,
         r.qualified, r.accepted, ST_X(r.shown::geometry), ST_Y(r.shown::geometry), r.precision_m, r.distance_km,
         r.postal_code, r.city, r.address_line
  FROM (
    SELECT * FROM real_missions
    UNION ALL
    SELECT NULL::bigint,
           ex.id,
           true,
           CASE WHEN p_lang = 'en' THEN ex.title_en ELSE ex.title_fr END,
           NULL::text,
           ex.sector,
           date_trunc('day', now()) + make_interval(days => ex.starts_in_days) + interval '9 hours',
           skill_labels(example_skill_codes(ex.id), p_lang),
           ex.is_qualified,
           false,
           ST_Project(ex.provider_location, ex.offset_m, ex.azimuth),
           blur_radius_m(),
           round_km(ex.offset_m),
           NULL::text,
           NULL::text,
           NULL::text
    FROM examples ex
    WHERE ex.rank <= (SELECT greatest(0, c.examples_target - (SELECT count(*) FROM open_nearby)) FROM config c)
  ) r
  ORDER BY r.is_example, r.distance_km, r.starts_at
  LIMIT p_limit;
END
$$;

-- The provider accepts a published mission they qualify for and can reach; returns the exact address.
CREATE FUNCTION api.accept_mission(p_provider_id bigint, p_mission_id bigint)
RETURNS TABLE (address_line text, postal_code text, city text, lon double precision, lat double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  p providers;
  m missions;
BEGIN
  SELECT * INTO p FROM providers WHERE id = p_provider_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider % not found or inactive', p_provider_id USING ERRCODE = 'QD001';
  END IF;
  SELECT * INTO m FROM missions WHERE id = p_mission_id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mission % is not open', p_mission_id USING ERRCODE = 'QD002';
  END IF;
  IF NOT has_all_skills(p.id, mission_skill_codes(m.id)) THEN
    RAISE EXCEPTION 'provider % lacks a skill required by mission %', p.id, m.id USING ERRCODE = 'QD003';
  END IF;
  IF NOT ST_DWithin(m.approx_location, p.location, p.travel_radius_km * 1000) THEN
    RAISE EXCEPTION 'mission % is outside the travel radius of provider %', m.id, p.id USING ERRCODE = 'QD004';
  END IF;

  INSERT INTO mission_responses (mission_id, provider_id, status) VALUES (m.id, p.id, 'accepted')
  ON CONFLICT (mission_id, provider_id) DO UPDATE SET status = 'accepted', responded_at = now();

  address_line := m.address_line;
  postal_code := m.postal_code;
  city := m.city;
  lon := ST_X(m.location::geometry);
  lat := ST_Y(m.location::geometry);
  RETURN NEXT;
END
$$;

CREATE FUNCTION api.decline_mission(p_provider_id bigint, p_mission_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM providers WHERE id = p_provider_id AND is_active) THEN
    RAISE EXCEPTION 'provider % not found or inactive', p_provider_id USING ERRCODE = 'QD001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM missions WHERE id = p_mission_id AND status = 'published') THEN
    RAISE EXCEPTION 'mission % is not open', p_mission_id USING ERRCODE = 'QD002';
  END IF;
  INSERT INTO mission_responses (mission_id, provider_id, status) VALUES (p_mission_id, p_provider_id, 'declined')
  ON CONFLICT (mission_id, provider_id) DO UPDATE SET status = 'declined', responded_at = now();
END
$$;

CREATE FUNCTION api.set_provider_location(p_provider_id bigint, p_lon double precision, p_lat double precision, p_travel_radius_km numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
BEGIN
  IF p_lon NOT BETWEEN -180 AND 180 OR p_lat NOT BETWEEN -90 AND 90 THEN
    RAISE EXCEPTION 'invalid coordinates (%, %)', p_lon, p_lat USING ERRCODE = 'QD005';
  END IF;
  IF p_travel_radius_km IS NOT NULL AND p_travel_radius_km NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'travel radius must be between 1 and 50 km' USING ERRCODE = 'QD005';
  END IF;
  UPDATE providers
  SET location = ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      travel_radius_km = coalesce(p_travel_radius_km, travel_radius_km)
  WHERE id = p_provider_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider % not found', p_provider_id USING ERRCODE = 'QD001';
  END IF;
END
$$;

-- Business side ---------------------------------------------------------------

-- Creates a draft mission. Coordinates come from geocoding the address in the API layer.
CREATE FUNCTION api.create_mission(
  p_business_id  bigint,
  p_title        text,
  p_address_line text,
  p_postal_code  text,
  p_city         text,
  p_lon          double precision,
  p_lat          double precision,
  p_starts_at    timestamptz,
  p_skills       text[],
  p_description  text DEFAULT NULL
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
DECLARE
  v_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = p_business_id) THEN
    RAISE EXCEPTION 'business % not found', p_business_id USING ERRCODE = 'QD006';
  END IF;
  IF coalesce(cardinality(p_skills), 0) = 0 THEN
    RAISE EXCEPTION 'a mission needs at least one skill' USING ERRCODE = 'QD005';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_skills) AS s(code) WHERE NOT EXISTS (SELECT 1 FROM skills k WHERE k.code = s.code)) THEN
    RAISE EXCEPTION 'unknown skill in %', p_skills USING ERRCODE = 'QD005';
  END IF;
  IF p_lon NOT BETWEEN -180 AND 180 OR p_lat NOT BETWEEN -90 AND 90 THEN
    RAISE EXCEPTION 'invalid coordinates (%, %)', p_lon, p_lat USING ERRCODE = 'QD005';
  END IF;
  IF p_starts_at <= now() THEN
    RAISE EXCEPTION 'a mission must start in the future' USING ERRCODE = 'QD005';
  END IF;

  INSERT INTO missions (business_id, title, description, address_line, postal_code, city, location, starts_at)
  VALUES (p_business_id, p_title, p_description, p_address_line, p_postal_code, p_city,
          ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_starts_at)
  RETURNING id INTO v_id;
  INSERT INTO mission_skills (mission_id, skill_code) SELECT DISTINCT v_id, s FROM unnest(p_skills) AS s;
  RETURN v_id;
END
$$;

-- "N prestataires qualifiés à moins de 10 km": active providers with every required skill who
-- live within p_radius_km of the mission and will see it in their list. Only real providers
-- count. Below config.count_display_min, qualified_count is NULL and the screen says
-- "fewer than <display_min>": honest while the network grows, and a lone provider cannot be
-- located by moving a draft around. Businesses never get providers' positions.
CREATE FUNCTION api.qualified_providers(p_business_id bigint, p_mission_id bigint, p_radius_km numeric DEFAULT 10)
RETURNS TABLE (qualified_count integer, display_min integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  m missions;
  n integer;
  k integer;
BEGIN
  IF p_radius_km NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'radius must be between 1 and 50 km' USING ERRCODE = 'QD005';
  END IF;
  m := owned_mission(p_business_id, p_mission_id);
  SELECT count(*) INTO n
  FROM providers p
  WHERE p.is_active
    AND ST_DWithin(p.location, m.location, p_radius_km * 1000)
    AND ST_DWithin(p.location, m.approx_location, p.travel_radius_km * 1000)
    AND has_all_skills(p.id, mission_skill_codes(m.id));
  SELECT c.count_display_min INTO k FROM config c;
  qualified_count := CASE WHEN n >= k THEN n END;
  display_min := k;
  RETURN NEXT;
END
$$;

-- Publishes a draft and returns the qualified-provider figure shown at that moment.
CREATE FUNCTION api.publish_mission(p_business_id bigint, p_mission_id bigint)
RETURNS TABLE (qualified_count integer, display_min integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
DECLARE
  m missions;
BEGIN
  m := owned_mission(p_business_id, p_mission_id);
  IF m.status <> 'draft' THEN
    RAISE EXCEPTION 'mission % is already %', m.id, m.status USING ERRCODE = 'QD002';
  END IF;
  UPDATE missions SET status = 'published' WHERE id = m.id;
  RETURN QUERY SELECT * FROM api.qualified_providers(p_business_id, p_mission_id);
END
$$;

-- Providers who accepted the mission: first name, skills, rating and rounded distance only.
CREATE FUNCTION api.mission_applicants(p_business_id bigint, p_mission_id bigint, p_lang text DEFAULT 'fr')
RETURNS TABLE (
  provider_id  bigint,
  first_name   text,
  skills       text[],
  rating       numeric,
  review_count integer,
  distance_km  numeric,
  accepted_at  timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  m missions;
BEGIN
  m := owned_mission(p_business_id, p_mission_id);
  RETURN QUERY
    SELECT p.id,
           p.first_name,
           skill_labels(ARRAY(SELECT ps.skill_code FROM provider_skills ps WHERE ps.provider_id = p.id), p_lang),
           rv.rating,
           coalesce(rv.review_count, 0),
           round_km(ST_Distance(p.location, m.location)),
           r.responded_at
    FROM mission_responses r
    JOIN providers p ON p.id = r.provider_id
    LEFT JOIN LATERAL (
      SELECT round(avg(x.rating), 1) AS rating, count(*)::integer AS review_count
      FROM reviews x WHERE x.provider_id = p.id
    ) rv ON true
    WHERE r.mission_id = m.id AND r.status = 'accepted'
    ORDER BY r.responded_at;
END
$$;

-- Access ----------------------------------------------------------------------
-- qdeal_app is a privilege-holding role without login. The API logs in with its own role,
-- created outside the migrations with a secret password and granted qdeal_app (see db/README.md).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qdeal_app') THEN
    CREATE ROLE qdeal_app NOLOGIN;
  END IF;
END
$$;
REVOKE ALL ON SCHEMA core FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA api FROM PUBLIC;
GRANT USAGE ON SCHEMA api TO qdeal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO qdeal_app;
-- Access is decided by schema: only qdeal_app may use "api", nobody but the owner may use
-- "core". Functions added to "api" by later migrations are granted to qdeal_app automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT EXECUTE ON FUNCTIONS TO qdeal_app;

-- migrate:down
ALTER DEFAULT PRIVILEGES IN SCHEMA api REVOKE EXECUTE ON FUNCTIONS FROM qdeal_app;
REVOKE USAGE ON SCHEMA api FROM qdeal_app;
DROP FUNCTION api.mission_applicants(bigint, bigint, text);
DROP FUNCTION api.publish_mission(bigint, bigint);
DROP FUNCTION api.qualified_providers(bigint, bigint, numeric);
DROP FUNCTION api.create_mission(bigint, text, text, text, text, double precision, double precision, timestamptz, text[], text);
DROP FUNCTION api.set_provider_location(bigint, double precision, double precision, numeric);
DROP FUNCTION api.decline_mission(bigint, bigint);
DROP FUNCTION api.accept_mission(bigint, bigint);
DROP FUNCTION api.missions_near_provider(bigint, numeric, text, integer);
-- qdeal_app is cluster-wide and may serve other databases of the cluster: it is not dropped.
