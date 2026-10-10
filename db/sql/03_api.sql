-- Q DEAL · localisation — functions called by the application.
-- They are SECURITY DEFINER: they read "core" with the owner's rights, while the application
-- role (qdeal_app) has no access to "core" at all. The p_provider_id / p_business_id arguments
-- must come from the authenticated session in the API layer, never from the client.

-- Shared: a business may only act on its own missions.
CREATE FUNCTION core.owned_mission(p_business_id bigint, p_mission_id bigint)
RETURNS core.missions LANGUAGE plpgsql STABLE AS $$
DECLARE
  m core.missions;
BEGIN
  SELECT * INTO m FROM core.missions WHERE id = p_mission_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mission % not found for business %', p_mission_id, p_business_id USING ERRCODE = 'no_data_found';
  END IF;
  RETURN m;
END
$$;

-- Provider side ---------------------------------------------------------------

-- Map and list of missions around the provider. Until the provider accepts a mission, it is
-- placed at its blurred point (precision_m = 1000), with a whole-kilometre distance, the
-- postal code and city only. Once accepted: exact point, exact address, distance to 100 m.
-- Missions the provider declined, and closed missions, are left out.
CREATE FUNCTION api.missions_near_provider(p_provider_id bigint, p_radius_km numeric DEFAULT NULL, p_lang text DEFAULT 'fr')
RETURNS TABLE (
  mission_id    bigint,
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
  WITH me AS (
    SELECT p.id, p.location, coalesce(p_radius_km, p.travel_radius_km) * 1000 AS radius_m
    FROM providers p
    WHERE p.id = p_provider_id AND p.is_active
  ),
  visible AS (
    SELECT m.*, coalesce(r.status = 'accepted', false) AS is_accepted, me.location AS my_location
    FROM me
    CROSS JOIN missions m
    LEFT JOIN mission_responses r ON r.mission_id = m.id AND r.provider_id = me.id
    WHERE (r.status = 'accepted' AND m.status <> 'closed')
       OR (m.status = 'published' AND r.status IS NULL AND ST_DWithin(m.approx_location, me.location, me.radius_m))
  )
  SELECT v.id,
         v.title,
         b.name,
         b.sector,
         v.starts_at,
         ARRAY(SELECT skill_label(ms.skill_code, p_lang) FROM mission_skills ms WHERE ms.mission_id = v.id ORDER BY 1),
         is_qualified(p_provider_id, v.id),
         v.is_accepted,
         ST_X((CASE WHEN v.is_accepted THEN v.location ELSE v.approx_location END)::geometry),
         ST_Y((CASE WHEN v.is_accepted THEN v.location ELSE v.approx_location END)::geometry),
         CASE WHEN v.is_accepted THEN 0 ELSE blur_radius_m() END,
         CASE WHEN v.is_accepted THEN round((ST_Distance(v.location, v.my_location) / 1000.0)::numeric, 1)
              ELSE round_km(ST_Distance(v.approx_location, v.my_location)) END,
         v.postal_code,
         v.city,
         CASE WHEN v.is_accepted THEN v.address_line END
  FROM visible v
  JOIN businesses b ON b.id = v.business_id
  ORDER BY 12, v.starts_at
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
    RAISE EXCEPTION 'provider % not found or inactive', p_provider_id USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO m FROM missions WHERE id = p_mission_id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mission % is not open', p_mission_id USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT is_qualified(p.id, m.id) THEN
    RAISE EXCEPTION 'provider % lacks a skill required by mission %', p.id, m.id USING ERRCODE = 'check_violation';
  END IF;
  IF NOT ST_DWithin(m.approx_location, p.location, p.travel_radius_km * 1000) THEN
    RAISE EXCEPTION 'mission % is outside the travel radius of provider %', m.id, p.id USING ERRCODE = 'check_violation';
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
  IF NOT EXISTS (SELECT 1 FROM missions WHERE id = p_mission_id AND status = 'published') THEN
    RAISE EXCEPTION 'mission % is not open', p_mission_id USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO mission_responses (mission_id, provider_id, status) VALUES (p_mission_id, p_provider_id, 'declined')
  ON CONFLICT (mission_id, provider_id) DO UPDATE SET status = 'declined', responded_at = now();
END
$$;

CREATE FUNCTION api.set_provider_location(p_provider_id bigint, p_lon double precision, p_lat double precision, p_travel_radius_km numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
BEGIN
  UPDATE providers
  SET location = ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      travel_radius_km = coalesce(p_travel_radius_km, travel_radius_km)
  WHERE id = p_provider_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider % not found', p_provider_id USING ERRCODE = 'no_data_found';
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
    RAISE EXCEPTION 'business % not found', p_business_id USING ERRCODE = 'no_data_found';
  END IF;
  IF coalesce(cardinality(p_skills), 0) = 0 THEN
    RAISE EXCEPTION 'a mission needs at least one skill' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO missions (business_id, title, description, address_line, postal_code, city, location, starts_at)
  VALUES (p_business_id, p_title, p_description, p_address_line, p_postal_code, p_city,
          ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_starts_at)
  RETURNING id INTO v_id;
  INSERT INTO mission_skills (mission_id, skill_code) SELECT DISTINCT v_id, s FROM unnest(p_skills) AS s;
  RETURN v_id;
END
$$;

-- "8 prestataires qualifiés à moins de 10 km": active providers who have every required skill,
-- live within p_radius_km of the mission and will actually see it in their list.
-- Businesses never get providers' positions, only this number.
CREATE FUNCTION api.qualified_providers_count(p_business_id bigint, p_mission_id bigint, p_radius_km numeric DEFAULT 10)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
DECLARE
  m missions;
BEGIN
  m := owned_mission(p_business_id, p_mission_id);
  RETURN (
    SELECT count(*)
    FROM providers p
    WHERE p.is_active
      AND ST_DWithin(p.location, m.location, p_radius_km * 1000)
      AND ST_DWithin(p.location, m.approx_location, p.travel_radius_km * 1000)
      AND is_qualified(p.id, m.id)
  );
END
$$;

-- Publishes a draft and returns the qualified-provider count shown at that moment.
CREATE FUNCTION api.publish_mission(p_business_id bigint, p_mission_id bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, public, pg_temp AS $$
DECLARE
  m missions;
BEGIN
  m := owned_mission(p_business_id, p_mission_id);
  IF m.status <> 'draft' THEN
    RAISE EXCEPTION 'mission % is already %', m.id, m.status USING ERRCODE = 'check_violation';
  END IF;
  UPDATE missions SET status = 'published' WHERE id = m.id;
  RETURN api.qualified_providers_count(p_business_id, p_mission_id);
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
           ARRAY(SELECT skill_label(ps.skill_code, p_lang) FROM provider_skills ps WHERE ps.provider_id = p.id ORDER BY 1),
           (SELECT round(avg(rv.rating), 1) FROM reviews rv WHERE rv.provider_id = p.id),
           (SELECT count(*)::integer FROM reviews rv WHERE rv.provider_id = p.id),
           round_km(ST_Distance(p.location, m.location)),
           r.responded_at
    FROM mission_responses r
    JOIN providers p ON p.id = r.provider_id
    WHERE r.mission_id = m.id AND r.status = 'accepted'
    ORDER BY r.responded_at;
END
$$;

-- Access: the application role may only call the api functions.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qdeal_app') THEN
    CREATE ROLE qdeal_app LOGIN PASSWORD 'qdeal_app';  -- development password
  END IF;
END
$$;
REVOKE ALL ON SCHEMA core FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA api FROM PUBLIC;
GRANT USAGE ON SCHEMA api TO qdeal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO qdeal_app;
