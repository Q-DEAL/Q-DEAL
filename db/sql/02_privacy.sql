-- Q DEAL · localisation — privacy helpers.

-- Radius of the blur applied to mission locations before a provider accepts.
CREATE FUNCTION core.blur_radius_m() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 1000 $$;

-- Uniform random point in a disk of radius_m around p (sqrt keeps the density even across the disk).
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
-- used to trilaterate a provider's or a mission's exact position.
CREATE FUNCTION core.round_km(meters double precision) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest(1, round(meters / 1000.0))::numeric
$$;

CREATE FUNCTION core.skill_label(p_code text, p_lang text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_lang = 'en' THEN label_en ELSE label_fr END FROM core.skills WHERE code = p_code
$$;

-- True when the provider has every skill the mission requires.
CREATE FUNCTION core.is_qualified(p_provider_id bigint, p_mission_id bigint) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM core.mission_skills ms
    WHERE ms.mission_id = p_mission_id
      AND NOT EXISTS (SELECT 1 FROM core.provider_skills ps WHERE ps.provider_id = p_provider_id AND ps.skill_code = ms.skill_code)
  )
$$;
