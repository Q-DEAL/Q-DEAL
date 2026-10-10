-- migrate:up
-- Location feature: tables. Exact positions (providers' homes, missions at private
-- addresses) live in the private schema "core". The application never reads it directly:
-- it calls the functions of the "api" schema, which apply the privacy rules.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA core;
CREATE SCHEMA api;

-- Single-row settings, changed by the operators with a plain UPDATE.
CREATE TABLE core.config (
  id                boolean  PRIMARY KEY DEFAULT true CHECK (id),
  examples_enabled  boolean  NOT NULL DEFAULT true,  -- example missions fill a provider's list while their area is quiet
  examples_target   smallint NOT NULL DEFAULT 3 CHECK (examples_target BETWEEN 0 AND 20),
  count_display_min smallint NOT NULL DEFAULT 3 CHECK (count_display_min BETWEEN 1 AND 20)  -- businesses see "fewer than N" below this
);

CREATE TABLE core.skills (
  code     text PRIMARY KEY CHECK (code ~ '^[a-z][a-z_]{1,39}$'),
  label_fr text NOT NULL CHECK (char_length(label_fr) BETWEEN 1 AND 60),
  label_en text NOT NULL CHECK (char_length(label_en) BETWEEN 1 AND 60)
);

CREATE TABLE core.businesses (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name   text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  sector text NOT NULL CHECK (sector IN ('btp', 'commerce', 'conciergerie', 'syndic', 'evenementiel'))
);

CREATE TABLE core.providers (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name       text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 60),
  last_name        text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  location         geography(Point, 4326) NOT NULL,  -- home base, never returned by the api
  travel_radius_km numeric(4, 1) NOT NULL DEFAULT 10 CHECK (travel_radius_km BETWEEN 1 AND 50),
  is_active        boolean NOT NULL DEFAULT true
);
CREATE INDEX providers_active_location_gix ON core.providers USING gist (location) WHERE is_active;

CREATE TABLE core.provider_skills (
  provider_id bigint NOT NULL REFERENCES core.providers ON DELETE CASCADE,
  skill_code  text   NOT NULL REFERENCES core.skills,
  PRIMARY KEY (provider_id, skill_code)
);

CREATE TABLE core.missions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id     bigint NOT NULL REFERENCES core.businesses ON DELETE CASCADE,
  title           text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description     text CHECK (char_length(description) <= 2000),
  address_line    text NOT NULL CHECK (char_length(address_line) BETWEEN 1 AND 200),  -- shown only after acceptance
  postal_code     text NOT NULL CHECK (char_length(postal_code) BETWEEN 2 AND 10),
  city            text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 120),
  location        geography(Point, 4326) NOT NULL,   -- exact
  approx_location geography(Point, 4326) NOT NULL,   -- blurred once by trigger
  starts_at       timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX missions_published_approx_gix ON core.missions USING gist (approx_location) WHERE status = 'published';
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
CREATE INDEX mission_responses_provider_idx ON core.mission_responses (provider_id, status);

CREATE TABLE core.reviews (
  mission_id  bigint NOT NULL REFERENCES core.missions ON DELETE CASCADE,
  provider_id bigint NOT NULL REFERENCES core.providers ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, provider_id)
);
CREATE INDEX reviews_provider_idx ON core.reviews (provider_id);

-- Example missions shown to providers (always flagged as examples) while real missions
-- around them are fewer than config.examples_target. They have no address and no owner.
CREATE TABLE core.example_missions (
  id             smallint PRIMARY KEY,
  title_fr       text NOT NULL CHECK (char_length(title_fr) BETWEEN 3 AND 120),
  title_en       text NOT NULL CHECK (char_length(title_en) BETWEEN 3 AND 120),
  sector         text NOT NULL CHECK (sector IN ('btp', 'commerce', 'conciergerie', 'syndic', 'evenementiel')),
  starts_in_days smallint NOT NULL CHECK (starts_in_days BETWEEN 1 AND 30),
  is_active      boolean NOT NULL DEFAULT true
);

CREATE TABLE core.example_mission_skills (
  example_id smallint NOT NULL REFERENCES core.example_missions ON DELETE CASCADE,
  skill_code text     NOT NULL REFERENCES core.skills,
  PRIMARY KEY (example_id, skill_code)
);

-- migrate:down
DROP SCHEMA api CASCADE;
DROP SCHEMA core CASCADE;
-- The postgis extension is kept: other schemas of the database may use it.
