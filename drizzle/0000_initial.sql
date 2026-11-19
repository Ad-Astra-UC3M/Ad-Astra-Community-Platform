-- Initial MVP schema for Ad_Astra_Community_DB (13 tables in public)
-- Compatible with Neon PostgreSQL and PGlite 18.7 (no external extensions required).

DO $$ BEGIN
  CREATE TYPE public.capability_code AS ENUM (
    'general_admin',
    'content_editing',
    'attendance_validation',
    'talent_consultation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM (
    'active',
    'deactivated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE public.deletion_status AS ENUM (
    'pending',
    'in_review',
    'resolved'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE public.publish_status AS ENUM (
    'draft',
    'published',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE public.participation_status AS ENUM (
    'booked',
    'attended'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE public.attendance_method AS ENUM (
    'qr',
    'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE public.opportunity_type AS ENUM (
    'internship',
    'research'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_valid_talent_experiences(val jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT
    jsonb_typeof(val) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(val) AS elem
      WHERE (
        jsonb_typeof(elem) = 'object'
        AND elem ? 'kind'
        AND jsonb_typeof(elem->'kind') = 'string'
        AND (elem->>'kind') IN ('team', 'project', 'work')
        AND elem ? 'title'
        AND jsonb_typeof(elem->'title') = 'string'
        AND length(btrim(elem->>'title')) > 0
        AND (NOT (elem ? 'organization') OR jsonb_typeof(elem->'organization') IN ('string', 'null'))
        AND (NOT (elem ? 'description') OR jsonb_typeof(elem->'description') IN ('string', 'null'))
        AND elem ? 'is_featured'
        AND jsonb_typeof(elem->'is_featured') = 'boolean'
        AND elem ? 'sort_order'
        AND jsonb_typeof(elem->'sort_order') = 'number'
        AND (elem->>'sort_order') ~ '^[0-9]+$'
      ) IS NOT TRUE
    );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_valid_talent_languages(val jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT
    jsonb_typeof(val) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(val) AS elem
      WHERE (
        jsonb_typeof(elem) = 'object'
        AND elem ? 'language'
        AND jsonb_typeof(elem->'language') = 'string'
        AND length(btrim(elem->>'language')) > 0
        AND elem ? 'level'
        AND jsonb_typeof(elem->'level') = 'string'
        AND length(btrim(elem->>'level')) > 0
      ) IS NOT TRUE
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(val) AS elem
      GROUP BY lower(btrim(elem->>'language'))
      HAVING count(*) > 1
    );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_valid_talent_links(val jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT
    jsonb_typeof(val) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(val) AS elem
      WHERE (
        jsonb_typeof(elem) = 'object'
        AND elem ? 'kind'
        AND jsonb_typeof(elem->'kind') = 'string'
        AND (elem->>'kind') IN ('cv', 'linkedin', 'github', 'portfolio', 'other')
        AND elem ? 'label'
        AND jsonb_typeof(elem->'label') = 'string'
        AND length(btrim(elem->>'label')) > 0
        AND elem ? 'url'
        AND jsonb_typeof(elem->'url') = 'string'
        AND (elem->>'url') ~* '^https?://[^[:space:]]+$'
      ) IS NOT TRUE
    );
$$;
--> statement-breakpoint

-- 1. public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text UNIQUE,
  email text NOT NULL UNIQUE,
  first_name varchar(80) NOT NULL,
  last_name varchar(120) NOT NULL,
  degree varchar(120) NOT NULL,
  academic_level varchar(40),
  language_modality varchar(40),
  course varchar(40) NOT NULL,
  privacy_accepted boolean NOT NULL,
  privacy_version varchar(40) NOT NULL,
  privacy_accepted_at timestamptz NOT NULL,
  status public.account_status NOT NULL DEFAULT 'active',
  qr_version integer NOT NULL DEFAULT 1,
  registered_at timestamptz,
  email_verified_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_normalized_check CHECK (email = lower(btrim(email))),
  CONSTRAINT profiles_email_uc3m_check CHECK (
    email ~ '^[a-z0-9!#$%&''*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&''*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*uc3m\.es$'
  ),
  CONSTRAINT profiles_privacy_accepted_check CHECK (privacy_accepted = true),
  CONSTRAINT profiles_qr_version_check CHECK (qr_version >= 1)
);
--> statement-breakpoint

-- 2. public.account_capabilities
CREATE TABLE IF NOT EXISTS public.account_capabilities (
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  capability_code public.capability_code NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.profiles (id),
  CONSTRAINT account_capabilities_pkey PRIMARY KEY (profile_id, capability_code)
);
--> statement-breakpoint

-- 3. public.admin_audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles (id),
  target_type varchar(40) NOT NULL,
  target_id uuid NOT NULL,
  action varchar(60) NOT NULL,
  result varchar(20) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_logs_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT admin_audit_logs_actor_check CHECK (
    actor_profile_id IS NOT NULL OR COALESCE(metadata->>'source', '') = 'bootstrap'
  ),
  CONSTRAINT admin_audit_logs_capability_action_check CHECK (
    action NOT IN ('capability_granted', 'capability_revoked')
    OR (
      target_type = 'profile'
      AND COALESCE(metadata->>'capability', '') IN (
        'general_admin',
        'content_editing',
        'attendance_validation',
        'talent_consultation'
      )
    )
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_created_idx
  ON public.admin_audit_logs (target_type, target_id, created_at);
--> statement-breakpoint

-- 4. public.deletion_requests
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.profiles (id),
  status public.deletion_status NOT NULL DEFAULT 'pending',
  reason text,
  resolution_note text,
  resolved_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT deletion_requests_resolution_check CHECK (
    (status <> 'resolved' AND resolution_note IS NULL AND resolved_by IS NULL AND resolved_at IS NULL)
    OR (
      status = 'resolved'
      AND resolved_by IS NOT NULL
      AND resolved_at IS NOT NULL
      AND resolution_note IS NOT NULL
      AND length(btrim(resolution_note)) > 0
    )
  )
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS deletion_requests_open_person_idx
  ON public.deletion_requests (person_id)
  WHERE status IN ('pending', 'in_review');
--> statement-breakpoint

-- 5. public.activities
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE,
  title varchar(160) NOT NULL,
  description text NOT NULL,
  location varchar(200) NOT NULL,
  external_registration_url text,
  status public.publish_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES public.profiles (id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activities_external_registration_url_https_check CHECK (
    external_registration_url IS NULL OR external_registration_url ~ '^https://'
  )
);
--> statement-breakpoint

-- 6. public.activity_images
CREATE TABLE IF NOT EXISTS public.activity_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities (id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_alt varchar(240) NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_images_activity_position_unique UNIQUE (activity_id, position),
  CONSTRAINT activity_images_url_https_check CHECK (image_url ~ '^https://'),
  CONSTRAINT activity_images_alt_nonempty_check CHECK (length(btrim(image_alt)) > 0),
  CONSTRAINT activity_images_position_check CHECK (position >= 1)
);
--> statement-breakpoint

-- 7. public.shifts
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities (id),
  name varchar(100) NOT NULL DEFAULT 'normal',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer,
  location_override varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shifts_time_range_check CHECK (ends_at > starts_at),
  CONSTRAINT shifts_capacity_check CHECK (capacity IS NULL OR capacity > 0)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS shifts_activity_starts_idx
  ON public.shifts (activity_id, starts_at);
--> statement-breakpoint

-- 8. public.participations
CREATE TABLE IF NOT EXISTS public.participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.profiles (id),
  shift_id uuid NOT NULL REFERENCES public.shifts (id),
  status public.participation_status NOT NULL DEFAULT 'booked',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  attended_at timestamptz,
  validated_by uuid REFERENCES public.profiles (id),
  attendance_method public.attendance_method,
  source varchar(40) NOT NULL DEFAULT 'portal',
  external_ref varchar(120),
  CONSTRAINT participations_person_shift_unique UNIQUE (person_id, shift_id),
  CONSTRAINT participations_status_fields_check CHECK (
    (status = 'booked' AND attended_at IS NULL AND validated_by IS NULL AND attendance_method IS NULL)
    OR (status = 'attended' AND attended_at IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS participations_shift_idx
  ON public.participations (shift_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS participations_person_idx
  ON public.participations (person_id);
--> statement-breakpoint

-- 9. public.participation_events
CREATE TABLE IF NOT EXISTS public.participation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.profiles (id),
  actor_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  shift_id uuid NOT NULL REFERENCES public.shifts (id),
  from_shift_id uuid REFERENCES public.shifts (id),
  event_type varchar(24) NOT NULL,
  previous_status public.participation_status,
  new_status public.participation_status,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participation_events_event_type_check CHECK (
    event_type IN (
      'reserved',
      'changed',
      'cancelled',
      'door_registered',
      'attendance_qr',
      'attendance_manual',
      'attendance_corrected'
    )
  ),
  CONSTRAINT participation_events_from_shift_check CHECK (
    (event_type = 'changed' AND from_shift_id IS NOT NULL AND from_shift_id <> shift_id)
    OR (event_type <> 'changed' AND from_shift_id IS NULL)
  ),
  CONSTRAINT participation_events_status_transition_check CHECK (
    (
      event_type = 'attendance_corrected'
      AND previous_status IS NOT NULL
      AND new_status IS NOT NULL
      AND previous_status <> new_status
    )
    OR (
      event_type <> 'attendance_corrected'
      AND previous_status IS NULL
      AND new_status IS NULL
    )
  ),
  CONSTRAINT participation_events_reason_check CHECK (
    event_type NOT IN ('door_registered', 'attendance_manual', 'attendance_corrected')
    OR (reason IS NOT NULL AND length(btrim(reason)) > 0)
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS participation_events_chronology_idx
  ON public.participation_events (participation_id, created_at, id);
--> statement-breakpoint

-- 10. public.opportunities
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE,
  type public.opportunity_type NOT NULL,
  title varchar(160) NOT NULL,
  organization varchar(160) NOT NULL,
  description text NOT NULL,
  requirements text,
  location varchar(160),
  work_modality varchar(40),
  research_lead varchar(160),
  application_url text,
  contact_email varchar(254),
  info_url text,
  image_url text,
  image_alt varchar(240),
  status public.publish_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  deadline_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_application_url_https_check CHECK (
    application_url IS NULL OR application_url ~ '^https://'
  ),
  CONSTRAINT opportunities_info_url_https_check CHECK (
    info_url IS NULL OR info_url ~ '^https://'
  ),
  CONSTRAINT opportunities_image_url_https_check CHECK (
    image_url IS NULL OR image_url ~ '^https://'
  ),
  CONSTRAINT opportunities_image_alt_check CHECK (
    image_url IS NULL OR (image_alt IS NOT NULL AND length(btrim(image_alt)) > 0)
  ),
  CONSTRAINT opportunities_published_contact_check CHECK (
    status <> 'published'
    OR (application_url IS NOT NULL AND length(btrim(application_url)) > 0)
    OR (contact_email IS NOT NULL AND length(btrim(contact_email)) > 0)
  )
);
--> statement-breakpoint

-- 11. public.bookmarks
CREATE TABLE IF NOT EXISTS public.bookmarks (
  person_id uuid NOT NULL REFERENCES public.profiles (id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities (id),
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookmarks_pkey PRIMARY KEY (person_id, opportunity_id)
);
--> statement-breakpoint

-- 12. public.talent_profiles
CREATE TABLE IF NOT EXISTS public.talent_profiles (
  person_id uuid PRIMARY KEY REFERENCES public.profiles (id),
  university varchar(160),
  expected_graduation_year smallint,
  headline varchar(200),
  skills text[] NOT NULL DEFAULT '{}'::text[],
  tools text[] NOT NULL DEFAULT '{}'::text[],
  interests text[] NOT NULL DEFAULT '{}'::text[],
  sectors text[] NOT NULL DEFAULT '{}'::text[],
  opportunity_types text[] NOT NULL DEFAULT '{}'::text[],
  experiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talent_profiles_graduation_year_check CHECK (
    expected_graduation_year IS NULL
    OR (expected_graduation_year >= 1950 AND expected_graduation_year <= 2100)
  ),
  CONSTRAINT talent_profiles_experiences_check CHECK (
    public.is_valid_talent_experiences(experiences)
  ),
  CONSTRAINT talent_profiles_languages_check CHECK (
    public.is_valid_talent_languages(languages)
  ),
  CONSTRAINT talent_profiles_links_check CHECK (
    public.is_valid_talent_links(links)
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS talent_profiles_skills_gin_idx
  ON public.talent_profiles USING gin (skills);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS talent_profiles_tools_gin_idx
  ON public.talent_profiles USING gin (tools);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS talent_profiles_interests_gin_idx
  ON public.talent_profiles USING gin (interests);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS talent_profiles_sectors_gin_idx
  ON public.talent_profiles USING gin (sectors);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS talent_profiles_opportunity_types_gin_idx
  ON public.talent_profiles USING gin (opportunity_types);
--> statement-breakpoint

-- 13. public.talent_dissemination_decisions
CREATE TABLE IF NOT EXISTS public.talent_dissemination_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.profiles (id),
  purpose varchar(80) NOT NULL,
  granted boolean NOT NULL,
  policy_version varchar(40) NOT NULL,
  source varchar(40) NOT NULL DEFAULT 'portal',
  valid_until timestamptz,
  decided_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS talent_dissemination_decisions_person_purpose_idx
  ON public.talent_dissemination_decisions (person_id, purpose, decided_at, id);
