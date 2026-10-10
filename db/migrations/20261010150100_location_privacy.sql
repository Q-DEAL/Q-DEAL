-- migrate:up
-- Location feature: privacy helpers used by the api functions.

-- Radius of the blur applied to a mission until a provider accepts it. Changing it only
-- affects missions whose location is set afterwards.
CREATE FUNCTION core.blur_radius_m() RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT 1000 $$;

-- Uniform random point in a disk of radius_m around p (sqrt keeps the density even).
CREATE FUNCTION core.blur_point(p geography, radius_m double precision)
RETURNS geography LANGUAGE sql VOLATILE AS $$
  SELECT ST_Project(p, radius_m * sqrt(random()), radians(360 * random()))
$$;

-- The blurred point is drawn once per location and kept: drawing a new one on every read
-- would let a provider average several reads back to the exact address.
CREATE FUNCTION core.missions_set_approx_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NOT ST_Equals(NEW.location::geometry, OLD.location::geometry) THEN
    NEW.approx_location := core.blur_point(NEW.location, core.blur_radius_m());
  ELSE
    NEW.approx_location := OLD.approx_location;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER missions_approx_location
BEFORE INSERT OR UPDATE ON core.missions
FOR EACH ROW EXECUTE FUNCTION core.missions_set_approx_location();

-- Distances shown before acceptance are whole kilometres (at least 1), so they cannot be
-- used to trilaterate an exact position.
CREATE FUNCTION core.round_km(meters double precision) RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT greatest(1, round(meters / 1000.0))::numeric
$$;

CREATE FUNCTION core.skill_label(p_code text, p_lang text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_lang = 'en' THEN s.label_en ELSE s.label_fr END FROM core.skills s WHERE s.code = p_code
$$;

-- True when the provider has every skill in p_codes.
CREATE FUNCTION core.has_all_skills(p_provider_id bigint, p_codes text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(p_codes) AS c(code)
    WHERE NOT EXISTS (SELECT 1 FROM core.provider_skills ps WHERE ps.provider_id = p_provider_id AND ps.skill_code = c.code)
  )
$$;

CREATE FUNCTION core.mission_skill_codes(p_mission_id bigint) RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT ARRAY(SELECT ms.skill_code FROM core.mission_skills ms WHERE ms.mission_id = p_mission_id ORDER BY 1)
$$;

CREATE FUNCTION core.example_skill_codes(p_example_id smallint) RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT ARRAY(SELECT es.skill_code FROM core.example_mission_skills es WHERE es.example_id = p_example_id ORDER BY 1)
$$;

CREATE FUNCTION core.skill_labels(p_codes text[], p_lang text) RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT ARRAY(SELECT core.skill_label(c.code, p_lang) FROM unnest(p_codes) AS c(code) ORDER BY 1)
$$;

-- Deterministic number in [0, 1) from two ids and a salt: example missions keep the same
-- place on a provider's map from one visit to the next.
CREATE FUNCTION core.stable_unit(p_a bigint, p_b bigint, p_salt text) RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT ('x' || substr(md5(p_a::text || ':' || p_b::text || ':' || p_salt), 1, 8))::bit(32)::bigint / 4294967296.0
$$;

-- A business may only act on its own missions. Unknown and foreign missions raise the same
-- error, so a business cannot probe other businesses' mission ids.
CREATE FUNCTION core.owned_mission(p_business_id bigint, p_mission_id bigint)
RETURNS core.missions LANGUAGE plpgsql STABLE AS $$
DECLARE
  m core.missions;
BEGIN
  SELECT * INTO m FROM core.missions WHERE id = p_mission_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mission % not found', p_mission_id USING ERRCODE = 'QD002';
  END IF;
  RETURN m;
END
$$;

-- migrate:down
DROP FUNCTION core.owned_mission(bigint, bigint);
DROP FUNCTION core.stable_unit(bigint, bigint, text);
DROP FUNCTION core.skill_labels(text[], text);
DROP FUNCTION core.example_skill_codes(smallint);
DROP FUNCTION core.mission_skill_codes(bigint);
DROP FUNCTION core.has_all_skills(bigint, text[]);
DROP FUNCTION core.skill_label(text, text);
DROP FUNCTION core.round_km(double precision);
DROP TRIGGER missions_approx_location ON core.missions;
DROP FUNCTION core.missions_set_approx_location();
DROP FUNCTION core.blur_point(geography, double precision);
DROP FUNCTION core.blur_radius_m();
