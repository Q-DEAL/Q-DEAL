-- Q DEAL · localisation — tables.
-- Exact positions (providers' homes, missions at private addresses) live in the private
-- schema "core". The application role never reads it: it only calls the functions of the
-- "api" schema (03_api.sql), which apply the privacy rules.

CREATE EXTENSION IF NOT EXISTS postgis;

DROP SCHEMA IF EXISTS api CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;
CREATE SCHEMA core;
CREATE SCHEMA api;

CREATE TABLE core.skills (
  code     text PRIMARY KEY,
  label_fr text NOT NULL,
  label_en text NOT NULL
);

CREATE TABLE core.businesses (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name   text NOT NULL,
  sector text NOT NULL CHECK (sector IN ('btp', 'commerce', 'conciergerie', 'syndic', 'evenementiel'))
);

CREATE TABLE core.providers (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name       text NOT NULL,
  last_name        text NOT NULL,
  location         geography(Point, 4326) NOT NULL,  -- home base, never returned by the api
  travel_radius_km numeric(5, 1) NOT NULL DEFAULT 10 CHECK (travel_radius_km > 0 AND travel_radius_km <= 100),
  is_active        boolean NOT NULL DEFAULT true
);
CREATE INDEX providers_location_gix ON core.providers USING gist (location);

CREATE TABLE core.provider_skills (
  provider_id bigint NOT NULL REFERENCES core.providers ON DELETE CASCADE,
  skill_code  text   NOT NULL REFERENCES core.skills,
  PRIMARY KEY (provider_id, skill_code)
);

CREATE TABLE core.missions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id     bigint NOT NULL REFERENCES core.businesses ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  address_line    text NOT NULL,                     -- revealed only to providers who accepted
  postal_code     text NOT NULL,
  city            text NOT NULL,
  location        geography(Point, 4326) NOT NULL,   -- exact
  approx_location geography(Point, 4326) NOT NULL,   -- blurred once by trigger (02_privacy.sql)
  starts_at       timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX missions_location_gix ON core.missions USING gist (location);
CREATE INDEX missions_approx_location_gix ON core.missions USING gist (approx_location);
CREATE INDEX missions_business_idx ON core.missions (business_id);

CREATE TABLE core.mission_skills (
  mission_id bigint NOT NULL REFERENCES core.missions ON DELETE CASCADE,
  skill_code text   NOT NULL REFERENCES core.skills,
  PRIMARY KEY (mission_id, skill_code)
);

CREATE TABLE core.mission_responses (
  mission_id   bigint NOT NULL REFERENCES core.missions ON DELETE CASCADE,
  provider_id  bigint NOT NULL REFERENCES core.providers ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('accepted', 'declined')),
  responded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, provider_id)
);
CREATE INDEX mission_responses_provider_idx ON core.mission_responses (provider_id);

CREATE TABLE core.reviews (
  mission_id  bigint NOT NULL REFERENCES core.missions ON DELETE CASCADE,
  provider_id bigint NOT NULL REFERENCES core.providers ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, provider_id)
);
