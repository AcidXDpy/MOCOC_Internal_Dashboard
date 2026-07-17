begin;

create extension if not exists pgcrypto;

create type app_user_role as enum ('chamber_admin', 'business_member', 'analyst');
create type verification_status as enum ('suggested', 'verified', 'needs_review');
create type recommendation_status as enum ('new', 'useful', 'not_relevant', 'already_doing', 'completed', 'revisit_later', 'dismissed');
create type confidence_grade as enum ('high', 'moderate', 'directional', 'insufficient');

create table business (
  id text primary key,
  display_name text not null,
  chamber_category text not null,
  public_source_url text,
  public_source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_user (
  id uuid primary key default gen_random_uuid(),
  external_subject text not null unique,
  role app_user_role not null,
  business_id text references business(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role = 'business_member' and business_id is not null) or role <> 'business_member')
);

create table business_profile (
  business_id text primary key references business(id) on delete cascade,
  legal_name text,
  short_description text,
  business_audience text,
  operating_model text,
  employee_range text,
  location_count integer check (location_count is null or location_count > 0),
  annual_customer_range text,
  year_founded integer,
  website text,
  service_radius_miles numeric,
  products_services jsonb not null default '[]',
  price_tier text,
  target_segments jsonb not null default '[]',
  desired_segments jsonb not null default '[]',
  seasonal_patterns text,
  operating_hours jsonb not null default '{}',
  accessibility_attributes jsonb not null default '[]',
  languages jsonb not null default '[]',
  growth_challenges jsonb not null default '[]',
  completeness_score numeric not null default 0 check (completeness_score between 0 and 100),
  last_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table business_location (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references business(id) on delete cascade,
  label text not null default 'Primary',
  street_address text,
  municipality text,
  state_code char(2),
  zip_code text,
  latitude double precision,
  longitude double precision,
  census_tract text,
  block_group text,
  county_subdivision text,
  county_fips text,
  state_fips text,
  cbsa_code text,
  geocoder text,
  geocode_confidence numeric check (geocode_confidence between 0 and 1),
  address_hash text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, label)
);

create table business_goal (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references business(id) on delete cascade,
  goal_code text not null,
  priority smallint not null default 1 check (priority between 1 and 5),
  active boolean not null default true,
  selected_by uuid references app_user(id),
  selected_at timestamptz not null default now(),
  unique (business_id, goal_code)
);

create table industry_classification (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references business(id) on delete cascade,
  naics_code text not null,
  naics_year integer not null default 2022,
  is_primary boolean not null default false,
  confidence numeric not null check (confidence between 0 and 1),
  method text not null,
  evidence jsonb not null default '[]',
  verification verification_status not null default 'suggested',
  verified_by uuid references app_user(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_primary_naics_per_business on industry_classification (business_id) where is_primary;
create index industry_classification_naics_idx on industry_classification (naics_code, verification);

create table external_dataset (
  id uuid primary key default gen_random_uuid(),
  source_organization text not null,
  dataset_key text not null,
  dataset_year integer not null,
  release_label text not null,
  source_url text not null,
  retrieved_at timestamptz,
  status text not null default 'pending',
  last_success_at timestamptz,
  next_check_at timestamptz,
  unique (dataset_key, dataset_year)
);

create table external_metric_definition (
  id text primary key,
  dataset_id uuid not null references external_dataset(id) on delete restrict,
  label text not null,
  plain_english_definition text not null,
  table_id text not null,
  estimate_variables text[] not null,
  margin_of_error_variables text[] not null default '{}',
  unit text not null,
  transformation_method text not null default 'direct'
);

create table geographic_metric (
  id uuid primary key default gen_random_uuid(),
  metric_definition_id text not null references external_metric_definition(id) on delete restrict,
  dataset_id uuid not null references external_dataset(id) on delete restrict,
  geography_type text not null,
  geography_id text not null,
  geography_name text not null,
  estimate numeric,
  margin_of_error numeric,
  coefficient_of_variation numeric,
  confidence confidence_grade not null,
  is_derived boolean not null default false,
  query_metadata jsonb not null,
  quality_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (metric_definition_id, dataset_id, geography_type, geography_id)
);
create index geographic_metric_lookup_idx on geographic_metric (geography_type, geography_id, metric_definition_id);

create table business_metric (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references business(id) on delete cascade,
  metric_key text not null,
  value numeric,
  unit text not null,
  source_metric_ids uuid[] not null default '{}',
  method_version text not null,
  calculated_at timestamptz not null default now(),
  unique (business_id, metric_key, method_version)
);

create table business_benchmark (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references business(id) on delete cascade,
  metric_key text not null,
  comparison_group text not null,
  group_size integer not null,
  business_value numeric,
  benchmark_value numeric,
  percentile numeric,
  suppressed boolean not null default false,
  calculated_at timestamptz not null default now(),
  check (group_size >= 0),
  unique (business_id, metric_key, comparison_group)
);

create table business_insight (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references business(id) on delete cascade,
  insight_key text not null,
  version text not null,
  statement text not null,
  relevance text not null,
  comparison_geography text,
  confidence confidence_grade not null,
  caveat text not null,
  evidence_metric_ids uuid[] not null default '{}',
  dataset_years integer[] not null default '{}',
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  unique (business_id, insight_key, version)
);

create table business_recommendation (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references business(id) on delete cascade,
  recommendation_key text not null,
  category text not null,
  title text not null,
  summary text not null,
  rationale text not null,
  action_steps jsonb not null,
  impact text not null,
  effort text not null,
  confidence confidence_grade not null,
  time_horizon text not null,
  limitation text not null,
  status recommendation_status not null default 'new',
  score numeric not null,
  score_factors jsonb not null,
  engine_version text not null,
  valid_from date not null,
  review_after date not null,
  generated_at timestamptz not null default now(),
  unique (business_id, recommendation_key, engine_version)
);
create index business_recommendation_queue_idx on business_recommendation (status, review_after, confidence);

create table recommendation_evidence (
  recommendation_id uuid not null references business_recommendation(id) on delete cascade,
  metric_definition_id text references external_metric_definition(id) on delete restrict,
  geographic_metric_id uuid references geographic_metric(id) on delete restrict,
  business_metric_id uuid references business_metric(id) on delete restrict,
  explanation text not null,
  primary key (recommendation_id, explanation)
);

create table recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references business_recommendation(id) on delete cascade,
  business_id text not null references business(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete restrict,
  status recommendation_status not null,
  comment text,
  created_at timestamptz not null default now()
);
create index recommendation_feedback_business_idx on recommendation_feedback (business_id, created_at desc);

create table business_opportunity (
  id uuid primary key default gen_random_uuid(),
  business_id text references business(id) on delete cascade,
  opportunity_type text not null,
  title text not null,
  description text not null,
  evidence jsonb not null default '[]',
  confidence confidence_grade not null,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now()
);

create table business_relationship (
  id uuid primary key default gen_random_uuid(),
  source_business_id text not null references business(id) on delete cascade,
  target_business_id text not null references business(id) on delete cascade,
  relationship_type text not null,
  status text not null default 'suggested',
  evidence jsonb not null default '[]',
  created_at timestamptz not null default now(),
  check (source_business_id <> target_business_id),
  unique (source_business_id, target_business_id, relationship_type)
);

create table data_refresh_job (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references external_dataset(id) on delete restrict,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_received integer,
  rows_applied integer,
  request_metadata jsonb not null default '{}',
  error_message text,
  retry_count integer not null default 0
);

create table data_quality_issue (
  id uuid primary key default gen_random_uuid(),
  business_id text references business(id) on delete cascade,
  issue_type text not null,
  severity text not null,
  message text not null,
  metadata jsonb not null default '{}',
  status text not null default 'open',
  resolved_by uuid references app_user(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index data_quality_issue_queue_idx on data_quality_issue (status, severity, issue_type);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references app_user(id) on delete set null,
  business_id text references business(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_business_idx on audit_log (business_id, created_at desc);

-- The authenticated API must set app.current_user_id to the verified external subject
-- for every transaction. Browser-provided values must never be trusted directly.
create function current_app_user() returns app_user
language sql stable security definer set search_path = public as $$
  select u from app_user u
  where u.external_subject = nullif(current_setting('app.current_user_id', true), '')
    and u.active
  limit 1
$$;

create function can_view_business(target_business_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (current_app_user()).role in ('chamber_admin', 'analyst')
    or ((current_app_user()).role = 'business_member' and (current_app_user()).business_id = target_business_id),
    false
  )
$$;

create function can_edit_business(target_business_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (current_app_user()).role = 'chamber_admin'
    or ((current_app_user()).role = 'business_member' and (current_app_user()).business_id = target_business_id),
    false
  )
$$;

alter table business enable row level security;
alter table business_profile enable row level security;
alter table business_location enable row level security;
alter table business_goal enable row level security;
alter table industry_classification enable row level security;
alter table business_metric enable row level security;
alter table business_benchmark enable row level security;
alter table business_insight enable row level security;
alter table business_recommendation enable row level security;
alter table recommendation_feedback enable row level security;

create policy business_select on business for select using (can_view_business(id));
create policy profile_select on business_profile for select using (can_view_business(business_id));
create policy location_select on business_location for select using (can_view_business(business_id));
create policy goal_select on business_goal for select using (can_view_business(business_id));
create policy classification_select on industry_classification for select using (can_view_business(business_id));
create policy metric_select on business_metric for select using (can_view_business(business_id));
create policy benchmark_select on business_benchmark for select using (can_view_business(business_id));
create policy insight_select on business_insight for select using (can_view_business(business_id));
create policy recommendation_select on business_recommendation for select using (can_view_business(business_id));
create policy feedback_select on recommendation_feedback for select using (can_view_business(business_id));

create policy profile_update on business_profile for update using (can_edit_business(business_id)) with check (can_edit_business(business_id));
create policy goal_write on business_goal for all using (can_edit_business(business_id)) with check (can_edit_business(business_id));
create policy feedback_write on recommendation_feedback for insert with check (
  can_edit_business(business_id)
  and (current_app_user()).id = user_id
);

commit;
