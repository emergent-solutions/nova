create sequence "public"."debug_log_id_seq";

create sequence "public"."file_sync_queue_id_seq";

create sequence "public"."sync_queue_id_seq";

create table "public"."api_access_logs" (
    "id" uuid not null default gen_random_uuid(),
    "endpoint_id" uuid,
    "request_method" character varying(10),
    "request_path" text,
    "request_params" jsonb,
    "request_headers" jsonb,
    "response_status" integer,
    "response_time_ms" integer,
    "response_size_bytes" integer,
    "client_ip" inet,
    "user_agent" text,
    "error_message" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);


alter table "public"."api_access_logs" enable row level security;

create table "public"."api_documentation" (
    "id" uuid not null default gen_random_uuid(),
    "endpoint_id" uuid,
    "openapi_spec" jsonb,
    "markdown_docs" text,
    "examples" jsonb default '[]'::jsonb,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now())
);


alter table "public"."api_documentation" enable row level security;

create table "public"."api_endpoint_sources" (
    "id" uuid not null default gen_random_uuid(),
    "endpoint_id" uuid,
    "data_source_id" uuid,
    "is_primary" boolean default false,
    "join_config" jsonb default '{}'::jsonb,
    "filter_config" jsonb default '{}'::jsonb,
    "sort_order" integer default 0,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);


alter table "public"."api_endpoint_sources" enable row level security;

create table "public"."api_endpoints" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "slug" character varying(255) not null,
    "description" text,
    "output_format" character varying(50),
    "schema_config" jsonb default '{}'::jsonb,
    "transform_config" jsonb default '{}'::jsonb,
    "relationship_config" jsonb default '{}'::jsonb,
    "cache_config" jsonb default '{"ttl": 300, "enabled": false}'::jsonb,
    "auth_config" jsonb default '{"type": "none", "required": false}'::jsonb,
    "rate_limit_config" jsonb default '{"enabled": false, "requests_per_minute": 60}'::jsonb,
    "active" boolean default true,
    "user_id" uuid,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "is_draft" boolean default false
);


alter table "public"."api_endpoints" enable row level security;

create table "public"."api_field_mappings" (
    "id" uuid not null default gen_random_uuid(),
    "endpoint_id" uuid,
    "target_field" character varying(255) not null,
    "source_id" uuid,
    "source_field" character varying(255),
    "transform_type" character varying(100),
    "transform_config" jsonb default '{}'::jsonb,
    "fallback_value" text,
    "conditions" jsonb default '[]'::jsonb,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now())
);


alter table "public"."api_field_mappings" enable row level security;

create table "public"."api_transformations" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "type" character varying(50) not null,
    "description" text,
    "config" jsonb default '{}'::jsonb,
    "user_id" uuid,
    "is_public" boolean default false,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now())
);


alter table "public"."api_transformations" enable row level security;

create table "public"."channels" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "type" text not null,
    "active" boolean default true,
    "schedule" json,
    "parent_id" uuid,
    "user_id" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "order" integer not null default 0,
    "content_id" uuid,
    "display_name" text,
    "carousel_name" text,
    "carousel_type" text
);


alter table "public"."channels" enable row level security;

create table "public"."content" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "type" text not null,
    "active" boolean default true,
    "schedule" json,
    "parent_id" uuid,
    "user_id" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "order" integer not null default 0,
    "template_id" uuid,
    "display_name" text,
    "duration" bigint,
    "data_source_id" uuid,
    "source_row_id" text,
    "source_row_hash" text
);


alter table "public"."content" enable row level security;

create table "public"."data_source_sync_logs" (
    "id" uuid not null default gen_random_uuid(),
    "data_source_id" uuid,
    "started_at" timestamp with time zone default now(),
    "completed_at" timestamp with time zone,
    "status" text not null,
    "items_processed" integer default 0,
    "error_message" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."data_source_sync_logs" enable row level security;

create table "public"."data_sources" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "type" character varying(50) not null,
    "active" boolean default true,
    "user_id" uuid,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "file_config" jsonb default '{}'::jsonb,
    "sync_config" jsonb default '{}'::jsonb,
    "template_mapping" jsonb default '{}'::jsonb,
    "last_sync_at" timestamp with time zone,
    "next_sync_at" timestamp with time zone,
    "sync_status" text default 'idle'::text,
    "last_sync_error" text,
    "last_sync_count" integer default 0,
    "last_sync_result" jsonb,
    "database_config" jsonb default '{}'::jsonb,
    "api_config" jsonb,
    "rss_config" jsonb,
    "category" character varying(100),
    "metadata" jsonb default '{}'::jsonb
);


alter table "public"."data_sources" enable row level security;

create table "public"."data_sources_backup" (
    "id" uuid,
    "name" character varying(255),
    "type" character varying(50),
    "url" text,
    "method" character varying(10),
    "active" boolean,
    "headers" jsonb,
    "auth_required" boolean,
    "auth_type" character varying(50),
    "auth_config" jsonb,
    "user_id" uuid,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "file_config" jsonb,
    "sync_config" jsonb,
    "template_mapping" jsonb,
    "last_sync_at" timestamp with time zone,
    "next_sync_at" timestamp with time zone,
    "sync_status" text,
    "last_sync_error" text,
    "last_sync_count" integer,
    "sync_mode" text,
    "last_sync_result" jsonb,
    "database_config" jsonb,
    "api_config" jsonb
);


create table "public"."debug_log" (
    "id" integer not null default nextval('debug_log_id_seq'::regclass),
    "created_at" timestamp with time zone default now(),
    "function_name" text,
    "message" text,
    "data" jsonb
);


create table "public"."file_sync_queue" (
    "id" integer not null default nextval('file_sync_queue_id_seq'::regclass),
    "data_source_id" uuid,
    "created_at" timestamp with time zone default now(),
    "processed" boolean default false,
    "processed_at" timestamp with time zone,
    "status" text default 'pending'::text,
    "error_message" text
);


create table "public"."item_tabfields" (
    "id" uuid not null default gen_random_uuid(),
    "item_id" uuid,
    "name" text not null,
    "value" text,
    "options" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."item_tabfields" enable row level security;

create table "public"."sync_queue" (
    "id" bigint not null default nextval('sync_queue_id_seq'::regclass),
    "data_source_id" uuid not null,
    "priority" integer default 0,
    "status" text default 'pending'::text,
    "attempts" integer default 0,
    "max_attempts" integer default 3,
    "created_at" timestamp with time zone default now(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "error_message" text
);


create table "public"."tabfields" (
    "id" uuid not null default gen_random_uuid(),
    "template_id" uuid,
    "name" text not null,
    "value" text,
    "user_id" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "options" jsonb default '{}'::jsonb
);


alter table "public"."tabfields" enable row level security;

create table "public"."template_forms" (
    "template_id" uuid not null,
    "schema" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."template_forms" enable row level security;

create table "public"."template_settings" (
    "template_id" uuid not null,
    "settings" jsonb not null default '{}'::jsonb,
    "scripting_enabled" boolean default false,
    "advanced_validation_enabled" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."template_settings" enable row level security;

create table "public"."templates" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "type" text not null,
    "active" boolean default true,
    "parent_id" uuid,
    "user_id" uuid,
    "order" integer not null default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."templates" enable row level security;

create table "public"."user_layouts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "layout_name" text default 'default'::text,
    "layout_data" jsonb not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."user_layouts" enable row level security;

alter sequence "public"."debug_log_id_seq" owned by "public"."debug_log"."id";

alter sequence "public"."file_sync_queue_id_seq" owned by "public"."file_sync_queue"."id";

alter sequence "public"."sync_queue_id_seq" owned by "public"."sync_queue"."id";

CREATE UNIQUE INDEX api_access_logs_pkey ON public.api_access_logs USING btree (id);

CREATE UNIQUE INDEX api_documentation_endpoint_id_key ON public.api_documentation USING btree (endpoint_id);

CREATE UNIQUE INDEX api_documentation_pkey ON public.api_documentation USING btree (id);

CREATE UNIQUE INDEX api_endpoint_sources_pkey ON public.api_endpoint_sources USING btree (id);

CREATE UNIQUE INDEX api_endpoint_sources_unique ON public.api_endpoint_sources USING btree (endpoint_id, data_source_id);

CREATE UNIQUE INDEX api_endpoints_pkey ON public.api_endpoints USING btree (id);

CREATE UNIQUE INDEX api_endpoints_slug_unique_non_draft ON public.api_endpoints USING btree (slug) WHERE ((is_draft = false) OR (is_draft IS NULL));

CREATE UNIQUE INDEX api_field_mappings_pkey ON public.api_field_mappings USING btree (id);

CREATE UNIQUE INDEX api_transformations_pkey ON public.api_transformations USING btree (id);

CREATE INDEX channels_order_idx ON public.channels USING btree ("order");

CREATE UNIQUE INDEX channels_pkey ON public.channels USING btree (id);

CREATE INDEX content_order_idx ON public.content USING btree ("order");

CREATE INDEX content_parent_id_idx ON public.content USING btree (parent_id);

CREATE UNIQUE INDEX content_pkey ON public.content USING btree (id);

CREATE INDEX content_template_id_idx ON public.content USING btree (template_id);

CREATE INDEX content_user_id_idx ON public.content USING btree (user_id);

CREATE UNIQUE INDEX data_source_sync_logs_pkey ON public.data_source_sync_logs USING btree (id);

CREATE UNIQUE INDEX data_sources_pkey ON public.data_sources USING btree (id);

CREATE UNIQUE INDEX debug_log_pkey ON public.debug_log USING btree (id);

CREATE UNIQUE INDEX file_sync_queue_pkey ON public.file_sync_queue USING btree (id);

CREATE INDEX idx_api_access_logs_created_at ON public.api_access_logs USING btree (created_at DESC);

CREATE INDEX idx_api_access_logs_endpoint_id ON public.api_access_logs USING btree (endpoint_id);

CREATE INDEX idx_api_endpoint_sources_data_source_id ON public.api_endpoint_sources USING btree (data_source_id);

CREATE INDEX idx_api_endpoint_sources_endpoint_id ON public.api_endpoint_sources USING btree (endpoint_id);

CREATE INDEX idx_api_endpoints_active ON public.api_endpoints USING btree (active);

CREATE INDEX idx_api_endpoints_is_draft ON public.api_endpoints USING btree (is_draft);

CREATE INDEX idx_api_endpoints_slug ON public.api_endpoints USING btree (slug);

CREATE INDEX idx_api_endpoints_user_id ON public.api_endpoints USING btree (user_id);

CREATE INDEX idx_api_field_mappings_endpoint_id ON public.api_field_mappings USING btree (endpoint_id);

CREATE INDEX idx_channels_content_id ON public.channels USING btree (content_id);

CREATE INDEX idx_content_data_source ON public.content USING btree (data_source_id, source_row_id);

CREATE INDEX idx_data_sources_active ON public.data_sources USING btree (active);

CREATE INDEX idx_data_sources_created_at ON public.data_sources USING btree (created_at DESC);

CREATE INDEX idx_data_sources_sync_enabled ON public.data_sources USING btree ((((sync_config ->> 'enabled'::text))::boolean)) WHERE (((sync_config ->> 'enabled'::text))::boolean = true);

CREATE INDEX idx_data_sources_type ON public.data_sources USING btree (type);

CREATE INDEX idx_data_sources_user_id ON public.data_sources USING btree (user_id);

CREATE INDEX idx_sync_queue_pending ON public.sync_queue USING btree (status, priority DESC, created_at) WHERE (status = 'pending'::text);

CREATE UNIQUE INDEX idx_sync_queue_unique_pending ON public.sync_queue USING btree (data_source_id) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));

CREATE INDEX idx_template_forms_template_id ON public.template_forms USING btree (template_id);

CREATE INDEX idx_template_forms_template_id_schema ON public.template_forms USING btree (template_id, ((schema ->> 'id'::text)));

CREATE INDEX idx_template_settings_template_id ON public.template_settings USING btree (template_id);

CREATE UNIQUE INDEX idx_unique_pending_sync ON public.sync_queue USING btree (data_source_id) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));

CREATE INDEX item_tabfields_content_id_idx ON public.item_tabfields USING btree (item_id);

CREATE UNIQUE INDEX item_tabfields_content_id_name_key ON public.item_tabfields USING btree (item_id, name);

CREATE UNIQUE INDEX item_tabfields_pkey ON public.item_tabfields USING btree (id);

CREATE UNIQUE INDEX sync_queue_pkey ON public.sync_queue USING btree (id);

CREATE UNIQUE INDEX tabfields_pkey ON public.tabfields USING btree (id);

CREATE INDEX tabfields_template_id_idx ON public.tabfields USING btree (template_id);

CREATE UNIQUE INDEX tabfields_template_id_name_key ON public.tabfields USING btree (template_id, name);

CREATE INDEX tabfields_user_id_idx ON public.tabfields USING btree (user_id);

CREATE UNIQUE INDEX template_forms_pkey ON public.template_forms USING btree (template_id);

CREATE UNIQUE INDEX template_settings_pkey ON public.template_settings USING btree (template_id);

CREATE INDEX templates_order_idx ON public.templates USING btree ("order");

CREATE INDEX templates_parent_id_idx ON public.templates USING btree (parent_id);

CREATE UNIQUE INDEX templates_pkey ON public.templates USING btree (id);

CREATE INDEX templates_user_id_idx ON public.templates USING btree (user_id);

CREATE UNIQUE INDEX user_layouts_pkey ON public.user_layouts USING btree (id);

CREATE UNIQUE INDEX user_layouts_user_id_layout_name_key ON public.user_layouts USING btree (user_id, layout_name);

alter table "public"."api_access_logs" add constraint "api_access_logs_pkey" PRIMARY KEY using index "api_access_logs_pkey";

alter table "public"."api_documentation" add constraint "api_documentation_pkey" PRIMARY KEY using index "api_documentation_pkey";

alter table "public"."api_endpoint_sources" add constraint "api_endpoint_sources_pkey" PRIMARY KEY using index "api_endpoint_sources_pkey";

alter table "public"."api_endpoints" add constraint "api_endpoints_pkey" PRIMARY KEY using index "api_endpoints_pkey";

alter table "public"."api_field_mappings" add constraint "api_field_mappings_pkey" PRIMARY KEY using index "api_field_mappings_pkey";

alter table "public"."api_transformations" add constraint "api_transformations_pkey" PRIMARY KEY using index "api_transformations_pkey";

alter table "public"."channels" add constraint "channels_pkey" PRIMARY KEY using index "channels_pkey";

alter table "public"."content" add constraint "content_pkey" PRIMARY KEY using index "content_pkey";

alter table "public"."data_source_sync_logs" add constraint "data_source_sync_logs_pkey" PRIMARY KEY using index "data_source_sync_logs_pkey";

alter table "public"."data_sources" add constraint "data_sources_pkey" PRIMARY KEY using index "data_sources_pkey";

alter table "public"."debug_log" add constraint "debug_log_pkey" PRIMARY KEY using index "debug_log_pkey";

alter table "public"."file_sync_queue" add constraint "file_sync_queue_pkey" PRIMARY KEY using index "file_sync_queue_pkey";

alter table "public"."item_tabfields" add constraint "item_tabfields_pkey" PRIMARY KEY using index "item_tabfields_pkey";

alter table "public"."sync_queue" add constraint "sync_queue_pkey" PRIMARY KEY using index "sync_queue_pkey";

alter table "public"."tabfields" add constraint "tabfields_pkey" PRIMARY KEY using index "tabfields_pkey";

alter table "public"."template_forms" add constraint "template_forms_pkey" PRIMARY KEY using index "template_forms_pkey";

alter table "public"."template_settings" add constraint "template_settings_pkey" PRIMARY KEY using index "template_settings_pkey";

alter table "public"."templates" add constraint "templates_pkey" PRIMARY KEY using index "templates_pkey";

alter table "public"."user_layouts" add constraint "user_layouts_pkey" PRIMARY KEY using index "user_layouts_pkey";

alter table "public"."api_access_logs" add constraint "api_access_logs_endpoint_id_fkey" FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE not valid;

alter table "public"."api_access_logs" validate constraint "api_access_logs_endpoint_id_fkey";

alter table "public"."api_documentation" add constraint "api_documentation_endpoint_id_fkey" FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE not valid;

alter table "public"."api_documentation" validate constraint "api_documentation_endpoint_id_fkey";

alter table "public"."api_documentation" add constraint "api_documentation_endpoint_id_key" UNIQUE using index "api_documentation_endpoint_id_key";

alter table "public"."api_endpoint_sources" add constraint "api_endpoint_sources_data_source_id_fkey" FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE not valid;

alter table "public"."api_endpoint_sources" validate constraint "api_endpoint_sources_data_source_id_fkey";

alter table "public"."api_endpoint_sources" add constraint "api_endpoint_sources_endpoint_id_fkey" FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE not valid;

alter table "public"."api_endpoint_sources" validate constraint "api_endpoint_sources_endpoint_id_fkey";

alter table "public"."api_endpoint_sources" add constraint "api_endpoint_sources_unique" UNIQUE using index "api_endpoint_sources_unique";

alter table "public"."api_endpoints" add constraint "api_endpoints_output_format_check" CHECK (((output_format)::text = ANY (ARRAY[('json'::character varying)::text, ('xml'::character varying)::text, ('rss'::character varying)::text, ('csv'::character varying)::text, ('custom'::character varying)::text]))) not valid;

alter table "public"."api_endpoints" validate constraint "api_endpoints_output_format_check";

alter table "public"."api_field_mappings" add constraint "api_field_mappings_endpoint_id_fkey" FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE not valid;

alter table "public"."api_field_mappings" validate constraint "api_field_mappings_endpoint_id_fkey";

alter table "public"."api_field_mappings" add constraint "api_field_mappings_source_id_fkey" FOREIGN KEY (source_id) REFERENCES data_sources(id) not valid;

alter table "public"."api_field_mappings" validate constraint "api_field_mappings_source_id_fkey";

alter table "public"."api_transformations" add constraint "api_transformations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."api_transformations" validate constraint "api_transformations_user_id_fkey";

alter table "public"."channels" add constraint "channels_content_id_fkey" FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE not valid;

alter table "public"."channels" validate constraint "channels_content_id_fkey";

alter table "public"."channels" add constraint "channels_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES channels(id) ON DELETE CASCADE not valid;

alter table "public"."channels" validate constraint "channels_parent_id_fkey";

alter table "public"."channels" add constraint "valid_type" CHECK ((type = ANY (ARRAY['channel'::text, 'playlist'::text, 'bucket'::text]))) not valid;

alter table "public"."channels" validate constraint "valid_type";

alter table "public"."content" add constraint "content_data_source_id_fkey" FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE SET NULL not valid;

alter table "public"."content" validate constraint "content_data_source_id_fkey";

alter table "public"."content" add constraint "content_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES content(id) ON DELETE CASCADE not valid;

alter table "public"."content" validate constraint "content_parent_id_fkey";

alter table "public"."content" add constraint "content_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE not valid;

alter table "public"."content" validate constraint "content_template_id_fkey";

alter table "public"."content" add constraint "content_type_check" CHECK ((type = ANY (ARRAY['bucketFolder'::text, 'bucket'::text, 'itemFolder'::text, 'item'::text]))) not valid;

alter table "public"."content" validate constraint "content_type_check";

alter table "public"."data_source_sync_logs" add constraint "data_source_sync_logs_data_source_id_fkey" FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE not valid;

alter table "public"."data_source_sync_logs" validate constraint "data_source_sync_logs_data_source_id_fkey";

alter table "public"."data_source_sync_logs" add constraint "data_source_sync_logs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text, 'debug'::text, 'completed_with_errors'::text]))) not valid;

alter table "public"."data_source_sync_logs" validate constraint "data_source_sync_logs_status_check";

alter table "public"."data_sources" add constraint "data_sources_sync_status_check" CHECK ((sync_status = ANY (ARRAY['idle'::text, 'pending'::text, 'running'::text, 'success'::text, 'error'::text, 'scheduled'::text, 'ready'::text]))) not valid;

alter table "public"."data_sources" validate constraint "data_sources_sync_status_check";

alter table "public"."data_sources" add constraint "data_sources_type_check" CHECK (((type)::text = ANY (ARRAY[('api'::character varying)::text, ('rss'::character varying)::text, ('database'::character varying)::text, ('file'::character varying)::text]))) not valid;

alter table "public"."data_sources" validate constraint "data_sources_type_check";

alter table "public"."file_sync_queue" add constraint "file_sync_queue_data_source_id_fkey" FOREIGN KEY (data_source_id) REFERENCES data_sources(id) not valid;

alter table "public"."file_sync_queue" validate constraint "file_sync_queue_data_source_id_fkey";

alter table "public"."item_tabfields" add constraint "item_tabfields_content_id_name_key" UNIQUE using index "item_tabfields_content_id_name_key";

alter table "public"."item_tabfields" add constraint "item_tabfields_item_id_fkey" FOREIGN KEY (item_id) REFERENCES content(id) ON DELETE CASCADE not valid;

alter table "public"."item_tabfields" validate constraint "item_tabfields_item_id_fkey";

alter table "public"."sync_queue" add constraint "sync_queue_data_source_id_fkey" FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE not valid;

alter table "public"."sync_queue" validate constraint "sync_queue_data_source_id_fkey";

alter table "public"."sync_queue" add constraint "sync_queue_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."sync_queue" validate constraint "sync_queue_status_check";

alter table "public"."tabfields" add constraint "tabfields_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE not valid;

alter table "public"."tabfields" validate constraint "tabfields_template_id_fkey";

alter table "public"."tabfields" add constraint "tabfields_template_id_name_key" UNIQUE using index "tabfields_template_id_name_key";

alter table "public"."tabfields" add constraint "tabfields_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."tabfields" validate constraint "tabfields_user_id_fkey";

alter table "public"."template_forms" add constraint "template_forms_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE not valid;

alter table "public"."template_forms" validate constraint "template_forms_template_id_fkey";

alter table "public"."template_settings" add constraint "template_settings_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE not valid;

alter table "public"."template_settings" validate constraint "template_settings_template_id_fkey";

alter table "public"."templates" add constraint "templates_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES templates(id) ON DELETE CASCADE not valid;

alter table "public"."templates" validate constraint "templates_parent_id_fkey";

alter table "public"."templates" add constraint "templates_type_check" CHECK ((type = ANY (ARRAY['templateFolder'::text, 'template'::text]))) not valid;

alter table "public"."templates" validate constraint "templates_type_check";

alter table "public"."user_layouts" add constraint "user_layouts_user_id_layout_name_key" UNIQUE using index "user_layouts_user_id_layout_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.calculate_next_sync_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only calculate if it's a file type with sync enabled
  IF NEW.type = 'file' 
     AND (NEW.sync_config->>'enabled')::boolean = true 
     AND NEW.active = true THEN
    
    -- If sync was just enabled or interval changed
    IF (OLD.sync_config->>'enabled')::boolean IS DISTINCT FROM true
       OR (OLD.sync_config->>'interval')::int IS DISTINCT FROM (NEW.sync_config->>'interval')::int
       OR NEW.next_sync_at IS NULL THEN
      
      -- Set next sync time based on interval
      NEW.next_sync_at = NOW() + ((NEW.sync_config->>'interval')::int || ' minutes')::interval;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_pg_net_request(request_id bigint)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    response_record RECORD;
    pending_record RECORD;
BEGIN
    -- Check _http_response table
    SELECT * INTO response_record
    FROM net._http_response
    WHERE id = request_id;
    
    -- Check http_request_queue (pending requests)
    SELECT * INTO pending_record
    FROM net.http_request_queue
    WHERE id = request_id;
    
    RETURN json_build_object(
        'request_id', request_id,
        'response_exists', response_record IS NOT NULL,
        'response_status', response_record.status_code,
        'response_created', response_record.created,
        'pending_exists', pending_record IS NOT NULL,
        'pending_status', pending_record.status,
        'pending_created', pending_record.created
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_sync_intervals_detailed()
 RETURNS TABLE(data_source_id uuid, name text, sync_enabled boolean, interval_value integer, interval_unit text, interval_string text, check_time timestamp with time zone, next_sync_calculated timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ds.id,
        ds.name::TEXT,  -- Cast VARCHAR to TEXT
        COALESCE((ds.sync_config->>'enabled')::boolean, true) as sync_enabled,
        COALESCE((ds.sync_config->>'interval')::INTEGER, 60) as interval_value,
        COALESCE(ds.sync_config->>'intervalUnit', 'minutes')::TEXT as interval_unit,  -- Cast to TEXT
        (COALESCE((ds.sync_config->>'interval')::INTEGER, 60) || ' ' || 
            COALESCE(ds.sync_config->>'intervalUnit', 'minutes'))::TEXT as interval_string,  -- Cast to TEXT
        NOW() as check_time,
        NOW() + (
            COALESCE((ds.sync_config->>'interval')::INTEGER, 60) || ' ' || 
            COALESCE(ds.sync_config->>'intervalUnit', 'minutes')
        )::INTERVAL as next_sync_calculated
    FROM data_sources ds
    WHERE ds.type = 'file'
    AND ds.active = true
    ORDER BY ds.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_sync_results()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    recent_response RECORD;
    recent_items INTEGER;
    queue_stats json;
BEGIN
    -- Get most recent Edge Function response
    SELECT * INTO recent_response
    FROM net._http_response
    WHERE content::text LIKE '%processed%'
    ORDER BY id DESC
    LIMIT 1;
    
    -- Count recently created items
    SELECT COUNT(*) INTO recent_items
    FROM content
    WHERE type = 'item'
    AND created_at > NOW() - INTERVAL '10 minutes';
    
    -- Get queue stats
    SELECT json_object_agg(status, count) INTO queue_stats
    FROM (
        SELECT status, COUNT(*) as count
        FROM file_sync_queue
        GROUP BY status
    ) s;
    
    RETURN json_build_object(
        'last_sync_response', recent_response.content::json,
        'recent_items_created', recent_items,
        'queue_status', queue_stats,
        'last_sync_time', recent_response.created
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_log_tables()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    debug_log_deleted INTEGER := 0;
    sync_logs_deleted INTEGER := 0;
    sync_logs_old_deleted INTEGER := 0;
    queue_deleted INTEGER := 0;
BEGIN
    -- Clean debug_log table
    -- Keep only last 3 days of debug logs
    DELETE FROM debug_log
    WHERE created_at < NOW() - INTERVAL '3 days';
    GET DIAGNOSTICS debug_log_deleted = ROW_COUNT;
    
    -- Clean data_source_sync_logs table
    -- Keep last 7 days of error logs, 1 day of success logs
    DELETE FROM data_source_sync_logs
    WHERE (status = 'success' AND created_at < NOW() - INTERVAL '1 day')
       OR (status = 'error' AND created_at < NOW() - INTERVAL '7 days')
       OR (status = 'debug' AND created_at < NOW() - INTERVAL '1 day');
    GET DIAGNOSTICS sync_logs_deleted = ROW_COUNT;
    
    -- Also clean very old logs regardless of status (30 days)
    DELETE FROM data_source_sync_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS sync_logs_old_deleted = ROW_COUNT;
    
    -- Clean old completed items from file_sync_queue
    DELETE FROM file_sync_queue
    WHERE status = 'completed'
    AND processed_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS queue_deleted = ROW_COUNT;
    
    -- Log the cleanup action itself (but this will be cleaned up in future runs)
    INSERT INTO data_source_sync_logs (status, error_message)
    VALUES ('success', format('Cleanup: deleted %s debug logs, %s sync logs, %s old sync logs, %s queue items',
                              debug_log_deleted, sync_logs_deleted, sync_logs_old_deleted, queue_deleted));
    
    RETURN json_build_object(
        'debug_log_deleted', debug_log_deleted,
        'sync_logs_deleted', sync_logs_deleted,
        'sync_logs_old_deleted', sync_logs_old_deleted,
        'queue_deleted', queue_deleted,
        'total_deleted', debug_log_deleted + sync_logs_deleted + sync_logs_old_deleted + queue_deleted
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_drafts()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Delete drafts older than 24 hours
  DELETE FROM api_endpoints 
  WHERE is_draft = true 
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_stuck_syncs()
 RETURNS TABLE(cleaned_id uuid, cleaned_name text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  UPDATE data_sources 
  SET 
    sync_status = 'error',
    last_sync_error = 'Sync timeout - automatically reset after ' || 
                      EXTRACT(EPOCH FROM (NOW() - last_sync_at))::int || ' seconds'
  WHERE 
    sync_status = 'running'
    AND type = 'file'
    AND last_sync_at < NOW() - INTERVAL '5 minutes'
  RETURNING id, name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_auth_uid()
 RETURNS TABLE(current_uid uuid, current_role_name text, is_authenticated boolean)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    SELECT 
        auth.uid() as current_uid,
        auth.role() as current_role_name,
        (auth.role() = 'authenticated') as is_authenticated;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_get_user_layout(p_layout_name text DEFAULT 'main'::text)
 RETURNS TABLE(found_user_id uuid, auth_user_id uuid, layout_exists boolean, layout_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ul.user_id as found_user_id,
    auth.uid() as auth_user_id,
    (ul.layout_data IS NOT NULL) as layout_exists,
    ul.layout_data
  FROM user_layouts ul
  WHERE ul.user_id = auth.uid()
  AND ul.layout_name = p_layout_name;
  
  -- If no rows found, return debug info
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      NULL::uuid as found_user_id,
      auth.uid() as auth_user_id,
      false as layout_exists,
      NULL::jsonb as layout_data;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_schema_not_null()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.schema IS NULL THEN
    NEW.schema := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fix_order_gaps(table_name text, parent_id_value uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  fixed_count INTEGER := 0;
  current_order INTEGER := 0;
  item RECORD;
BEGIN
  -- Build and execute dynamic query based on whether parent_id is provided
  IF parent_id_value IS NULL THEN
    -- Fix top-level items
    FOR item IN EXECUTE format('
      SELECT id, "order"
      FROM %I
      WHERE parent_id IS NULL
      ORDER BY "order", id',
      table_name
    ) LOOP
      EXECUTE format('UPDATE %I SET "order" = $1 WHERE id = $2', table_name)
      USING current_order, item.id;
      
      IF item.order != current_order THEN
        fixed_count := fixed_count + 1;
      END IF;
      
      current_order := current_order + 1;
    END LOOP;
  ELSE
    -- Fix child items
    FOR item IN EXECUTE format('
      SELECT id, "order"
      FROM %I
      WHERE parent_id = $1
      ORDER BY "order", id',
      table_name
    ) USING parent_id_value LOOP
      EXECUTE format('UPDATE %I SET "order" = $1 WHERE id = $2', table_name)
      USING current_order, item.id;
      
      IF item.order != current_order THEN
        fixed_count := fixed_count + 1;
      END IF;
      
      current_order := current_order + 1;
    END LOOP;
  END IF;
  
  RETURN fixed_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_integrations_to_sync()
 RETURNS TABLE(id uuid, name text, file_config jsonb, sync_config jsonb, template_mapping jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id,
    ds.name,
    ds.file_config,
    ds.sync_config,
    ds.template_mapping
  FROM data_sources ds
  WHERE 
    ds.type = 'file'
    AND ds.active = true
    AND (ds.sync_config->>'enabled')::boolean = true
    AND ds.sync_status != 'running'
    AND (
      ds.next_sync_at IS NULL  -- For first-time syncs
      OR ds.next_sync_at <= NOW()  -- For scheduled syncs
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_layout(p_layout_name text DEFAULT 'main'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_layout_data jsonb;
BEGIN
  SELECT layout_data INTO v_layout_data
  FROM user_layouts
  WHERE user_id = auth.uid()
  AND layout_name = p_layout_name;
  
  RETURN v_layout_data;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.inspect_pg_net_tables()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    response_count INTEGER;
    queue_count INTEGER;
    recent_responses jsonb;
    recent_queue jsonb;
BEGIN
    -- Count responses
    SELECT COUNT(*) INTO response_count FROM net._http_response;
    
    -- Count queued requests
    SELECT COUNT(*) INTO queue_count FROM net.http_request_queue;
    
    -- Get recent responses
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'status_code', status_code,
        'created', created,
        'url_host', (headers->>'host')
    ) ORDER BY created DESC)
    INTO recent_responses
    FROM net._http_response
    LIMIT 5;
    
    -- Get recent queue items
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'method', method,
        'url', url,
        'status', status,
        'created', created
    ) ORDER BY created DESC)
    INTO recent_queue
    FROM net.http_request_queue
    LIMIT 5;
    
    RETURN json_build_object(
        'response_count', response_count,
        'queue_count', queue_count,
        'recent_responses', recent_responses,
        'recent_queue', recent_queue
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_debug(func_name text, msg text, data jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO debug_log (function_name, message, data)
    VALUES (func_name, msg, data);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_edge_function()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- When a queue item becomes 'ready', your app can listen to this
    PERFORM pg_notify(
        'sync_ready',
        json_build_object(
            'queue_id', NEW.id,
            'data_source_id', NEW.data_source_id
        )::text
    );
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.populate_sync_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    inserted_count INTEGER;
BEGIN
    INSERT INTO sync_queue (data_source_id, priority)
    SELECT 
        id,
        CASE 
            WHEN type = 'database' THEN 1
            ELSE 0 
        END as priority
    FROM data_sources 
    WHERE active = true
      AND (sync_config->>'enabled')::boolean = true
      AND (next_sync_at IS NULL OR next_sync_at <= NOW())
    ON CONFLICT (data_source_id) WHERE status IN ('pending', 'processing')
    DO NOTHING;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    RETURN json_build_object(
        'inserted', inserted_count,
        'message', format('Added %s items to sync queue', inserted_count)
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_log_cleanup()
 RETURNS TABLE(table_name text, status text, age_category text, count bigint, oldest timestamp with time zone, size_estimate text)
 LANGUAGE plpgsql
AS $function$BEGIN
    -- Debug log preview
    RETURN QUERY
    SELECT 
        'debug_log'::TEXT,
        'all'::TEXT,
        'older than 3 days'::TEXT,
        COUNT(*),
        MIN(created_at),
        pg_size_pretty(SUM(pg_column_size(debug_log.*))::BIGINT) as size_estimate
    FROM debug_log
    WHERE created_at < NOW() - INTERVAL '3 days';
    
    -- Sync logs - success
    RETURN QUERY
    SELECT 
        'data_source_sync_logs'::TEXT,
        'success'::TEXT,
        'older than 1 day'::TEXT,
        COUNT(*),
        MIN(created_at),
        pg_size_pretty(SUM(pg_column_size(data_source_sync_logs.*))::BIGINT)
    FROM data_source_sync_logs
    WHERE data_source_sync_logs.status = 'success' 
    AND data_source_sync_logs.created_at < NOW() - INTERVAL '1 day';
    
    -- Sync logs - errors
    RETURN QUERY
    SELECT 
        'data_source_sync_logs'::TEXT,
        'error'::TEXT,
        'older than 7 days'::TEXT,
        COUNT(*),
        MIN(created_at),
        pg_size_pretty(SUM(pg_column_size(data_source_sync_logs.*))::BIGINT)
    FROM data_source_sync_logs
    WHERE data_source_sync_logs.status = 'error' 
    AND created_at < NOW() - INTERVAL '7 days';
    
    -- Very old logs
    RETURN QUERY
    SELECT 
        'data_source_sync_logs'::TEXT,
        'any'::TEXT,
        'older than 30 days'::TEXT,
        COUNT(*),
        MIN(created_at),
        pg_size_pretty(SUM(pg_column_size(data_source_sync_logs.*))::BIGINT)
    FROM data_source_sync_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- File sync queue
    RETURN QUERY
    SELECT 
        'file_sync_queue'::TEXT,
        'completed'::TEXT,
        'older than 7 days'::TEXT,
        COUNT(*),
        MIN(processed_at),
        pg_size_pretty(SUM(pg_column_size(file_sync_queue.*))::BIGINT)
    FROM file_sync_queue
    WHERE file_sync_queue.status = 'completed'
    AND processed_at < NOW() - INTERVAL '7 days';
END;$function$
;

CREATE OR REPLACE FUNCTION public.process_sync_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    service_key TEXT;
    project_ref TEXT;
    request_id BIGINT;
    queue_record RECORD;
    total_requests INTEGER := 0;
    edge_function TEXT;
BEGIN
    -- Get credentials
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
    SELECT decrypted_secret INTO project_ref FROM vault.decrypted_secrets WHERE name = 'project_ref';
    
    -- Process pending queue items
    FOR queue_record IN 
        SELECT 
            q.id as queue_id,
            q.data_source_id,
            q.attempts,
            ds.name,
            ds.type
        FROM sync_queue q
        JOIN data_sources ds ON ds.id = q.data_source_id
        WHERE q.status = 'pending'
          AND ds.active = true
        ORDER BY q.priority DESC, q.created_at ASC
        LIMIT 10
    LOOP
        -- Mark as processing
        UPDATE sync_queue 
        SET status = 'processing',
            started_at = NOW(),
            attempts = attempts + 1
        WHERE id = queue_record.queue_id;
        
        -- Update data source status - USE 'running' NOT 'syncing'
        UPDATE data_sources 
        SET sync_status = 'running',  -- Changed from 'syncing' to 'running'
            last_sync_at = NOW()
        WHERE id = queue_record.data_source_id;
        
        -- Determine edge function
        edge_function := CASE queue_record.type
            WHEN 'file' THEN 'sync-file-integration'
            WHEN 'database' THEN 'sync-database-integration'
            ELSE NULL
        END;
        
        IF edge_function IS NOT NULL THEN
            -- Call the edge function
            request_id := net.http_post(
                url := format('https://%s.supabase.co/functions/v1/%s', project_ref, edge_function),
                headers := jsonb_build_object(
                    'Authorization', 'Bearer ' || service_key,
                    'Content-Type', 'application/json'
                )::jsonb,
                body := jsonb_build_object(
                    'dataSourceId', queue_record.data_source_id,
                    'queueId', queue_record.queue_id
                )
            );
            
            total_requests := total_requests + 1;
            
            -- Log the request
            INSERT INTO data_source_sync_logs (
                data_source_id,
                status, 
                error_message
            )
            VALUES (
                queue_record.data_source_id,
                'running', 
                format('Started %s sync for "%s", request ID: %s', queue_record.type, queue_record.name, request_id)
            );
        ELSE
            -- Mark as failed for unknown type
            UPDATE sync_queue 
            SET status = 'failed',
                completed_at = NOW(),
                error_message = 'Unknown data source type'
            WHERE id = queue_record.queue_id;
        END IF;
    END LOOP;
    
    -- Clean up old completed/failed entries (older than 7 days)
    DELETE FROM sync_queue 
    WHERE status IN ('completed', 'failed') 
      AND completed_at < NOW() - INTERVAL '7 days';
    
    RETURN json_build_object(
        'processed', total_requests,
        'message', format('Started %s sync requests', total_requests)
    );
END;
$function$
;

create or replace view "public"."ready_for_sync" as  SELECT q.id AS queue_id,
    q.data_source_id,
    q.processed_at AS marked_ready_at,
    ds.name,
    ds.file_config,
    ds.sync_config,
    ds.template_mapping,
    ds.user_id
   FROM (file_sync_queue q
     JOIN data_sources ds ON ((ds.id = q.data_source_id)))
  WHERE ((q.status = 'ready'::text) AND ((ds.type)::text = 'file'::text) AND (ds.active = true))
  ORDER BY q.processed_at;


CREATE OR REPLACE FUNCTION public.save_user_layout(p_layout_data jsonb)
 RETURNS user_layouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result user_layouts;
BEGIN
  -- Always use 'main' as the layout name
  INSERT INTO user_layouts (user_id, layout_name, layout_data, updated_at)
  VALUES (auth.uid(), 'main', p_layout_data, now())
  ON CONFLICT (user_id, layout_name) 
  DO UPDATE SET 
    layout_data = EXCLUDED.layout_data,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.shift_items_after_deletion(p_parent_id uuid, p_deleted_order integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$BEGIN
    UPDATE content
    SET "order" = "order" - 1
    WHERE parent_id = p_parent_id AND "order" > p_deleted_order;
END;$function$
;

CREATE OR REPLACE FUNCTION public.shift_items_for_insertion(p_parent_id uuid, p_start_order integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$BEGIN
  UPDATE content
  SET "order" = "order" + 1
  WHERE parent_id = p_parent_id AND "order" >= p_start_order;
END;$function$
;

CREATE OR REPLACE FUNCTION public.shift_order_on_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    shift_count INTEGER;
BEGIN
  -- Only shift if the deleted item had an order value
  IF OLD."order" IS NULL THEN
    RETURN OLD;
  END IF;

  -- Log the deletion (helps with debugging)
  RAISE NOTICE 'Deleting % from % with order % and parent_id %', 
    OLD.id, TG_TABLE_NAME, OLD."order", OLD.parent_id;

  -- Perform the order shift
  IF OLD.parent_id IS NULL THEN
    -- Top-level item (no parent)
    EXECUTE format('
      UPDATE %I
      SET "order" = "order" - 1
      WHERE parent_id IS NULL
        AND "order" > $1',
      TG_TABLE_NAME
    ) USING OLD."order";
    
    GET DIAGNOSTICS shift_count = ROW_COUNT;
  ELSE
    -- Child item (has parent)
    EXECUTE format('
      UPDATE %I
      SET "order" = "order" - 1
      WHERE parent_id = $1
        AND "order" > $2',
      TG_TABLE_NAME
    ) USING OLD.parent_id, OLD."order";
    
    GET DIAGNOSTICS shift_count = ROW_COUNT;
  END IF;
  
  -- Log the result
  RAISE NOTICE 'Shifted % items in % after deleting item with order %', 
    shift_count, TG_TABLE_NAME, OLD."order";
  
  RETURN OLD;
END;
$function$
;

create or replace view "public"."sync_intervals_view" as  SELECT ds.id AS data_source_id,
    (ds.name)::text AS name,
    COALESCE(((ds.sync_config ->> 'enabled'::text))::boolean, true) AS sync_enabled,
    COALESCE(((ds.sync_config ->> 'interval'::text))::integer, 60) AS interval_value,
    COALESCE((ds.sync_config ->> 'intervalUnit'::text), 'minutes'::text) AS interval_unit,
    ((COALESCE(((ds.sync_config ->> 'interval'::text))::integer, 60) || ' '::text) || COALESCE((ds.sync_config ->> 'intervalUnit'::text), 'minutes'::text)) AS interval_string,
    now() AS check_time,
    (now() + (((COALESCE(((ds.sync_config ->> 'interval'::text))::integer, 60) || ' '::text) || COALESCE((ds.sync_config ->> 'intervalUnit'::text), 'minutes'::text)))::interval) AS next_sync_calculated
   FROM data_sources ds
  WHERE (((ds.type)::text = 'file'::text) AND (ds.active = true));


create or replace view "public"."sync_pipeline_status" as  SELECT 'Queue Status'::text AS metric,
    ( SELECT count(*) AS count
           FROM file_sync_queue
          WHERE (file_sync_queue.status = 'pending'::text)) AS pending,
    ( SELECT count(*) AS count
           FROM file_sync_queue
          WHERE (file_sync_queue.status = 'processing'::text)) AS processing,
    ( SELECT count(*) AS count
           FROM file_sync_queue
          WHERE ((file_sync_queue.status = 'completed'::text) AND (file_sync_queue.processed_at > (now() - '01:00:00'::interval)))) AS recent_completed,
    ( SELECT count(*) AS count
           FROM content
          WHERE ((content.type = 'item'::text) AND (content.created_at > (now() - '01:00:00'::interval)))) AS items_created_last_hour;


CREATE OR REPLACE FUNCTION public.test_auth()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    service_key TEXT;
    project_ref TEXT;
    request_id BIGINT;
    response_status INTEGER;
    response_body TEXT;
BEGIN
    -- Get credentials
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
    SELECT decrypted_secret INTO project_ref FROM vault.decrypted_secrets WHERE name = 'project_ref';
    
    -- Make a test call
    request_id := net.http_post(
        url := format('https://%s.supabase.co/functions/v1/sync-file-integration', project_ref),
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || service_key,
            'Content-Type', 'application/json'
        )::jsonb,
        body := jsonb_build_object('test', true)::jsonb
    );
    
    -- Wait for response
    PERFORM pg_sleep(3);
    
    SELECT status_code, content::text
    INTO response_status, response_body
    FROM net._http_response
    WHERE id = request_id;
    
    RETURN json_build_object(
        'status', response_status,
        'response', response_body,
        'key_preview', LEFT(service_key, 20) || '...',
        'key_length', LENGTH(service_key)
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_cascade_delete_order_shift()
 RETURNS TABLE(test_name text, result text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    test_bucket_id UUID;
    test_playlist_id UUID;
    bucket_count_before INTEGER;
    bucket_count_after INTEGER;
    max_order_before INTEGER;
    max_order_after INTEGER;
BEGIN
    -- Find a test playlist
    SELECT id INTO test_playlist_id 
    FROM channels 
    WHERE type = 'playlist' 
    LIMIT 1;
    
    IF test_playlist_id IS NULL THEN
        RETURN QUERY SELECT 'Setup', 'No playlist found for testing';
        RETURN;
    END IF;
    
    -- Count existing buckets and get max order
    SELECT COUNT(*), COALESCE(MAX("order"), -1) 
    INTO bucket_count_before, max_order_before
    FROM channels 
    WHERE parent_id = test_playlist_id AND type = 'bucket';
    
    -- Create a test content bucket
    INSERT INTO content (id, name, type, active, "order", user_id)
    VALUES (gen_random_uuid(), 'Test Cascade Bucket', 'bucket', true, 999, 
            (SELECT id FROM auth.users LIMIT 1))
    RETURNING id INTO test_bucket_id;
    
    -- Create channel bucket references
    INSERT INTO channels (name, type, active, parent_id, content_id, "order", user_id)
    VALUES 
        ('Test Channel Bucket 1', 'bucket', true, test_playlist_id, test_bucket_id, 
         max_order_before + 1, (SELECT id FROM auth.users LIMIT 1)),
        ('Test Channel Bucket 2', 'bucket', true, test_playlist_id, test_bucket_id, 
         max_order_before + 2, (SELECT id FROM auth.users LIMIT 1)),
        ('Test Channel Bucket 3', 'bucket', true, test_playlist_id, test_bucket_id, 
         max_order_before + 3, (SELECT id FROM auth.users LIMIT 1));
    
    RETURN QUERY SELECT 'Setup', format('Created test bucket %s with 3 channel references', test_bucket_id);
    
    -- Delete the content bucket (should cascade)
    DELETE FROM content WHERE id = test_bucket_id;
    
    -- Check results
    SELECT COUNT(*), COALESCE(MAX("order"), -1)
    INTO bucket_count_after, max_order_after
    FROM channels 
    WHERE parent_id = test_playlist_id AND type = 'bucket';
    
    -- Verify cascade delete worked
    IF EXISTS (SELECT 1 FROM channels WHERE content_id = test_bucket_id) THEN
        RETURN QUERY SELECT 'Cascade Delete', 'FAILED - Channel buckets still exist';
    ELSE
        RETURN QUERY SELECT 'Cascade Delete', 'PASSED - Channel buckets were deleted';
    END IF;
    
    -- Verify order shifting worked
    IF bucket_count_after = bucket_count_before THEN
        RETURN QUERY SELECT 'Order Shift', 'PASSED - Bucket count unchanged, orders maintained';
    ELSE
        RETURN QUERY SELECT 'Order Shift', 'FAILED - Order shifting may have issues';
    END IF;
    
    -- Check for order gaps
    IF EXISTS (
        WITH ordered_buckets AS (
            SELECT "order", ROW_NUMBER() OVER (ORDER BY "order") - 1 as expected_order
            FROM channels
            WHERE parent_id = test_playlist_id AND type = 'bucket'
        )
        SELECT 1 FROM ordered_buckets WHERE "order" != expected_order
    ) THEN
        RETURN QUERY SELECT 'Order Gaps', 'FAILED - Gaps found in order sequence';
    ELSE
        RETURN QUERY SELECT 'Order Gaps', 'PASSED - No gaps in order sequence';
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_edge_function_simple()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    service_key TEXT;
    project_ref TEXT;
    request_id BIGINT;
    response_record RECORD;
    wait_count INTEGER := 0;
BEGIN
    -- Get credentials
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
    SELECT decrypted_secret INTO project_ref FROM vault.decrypted_secrets WHERE name = 'project_ref';
    
    -- Make request
    request_id := net.http_post(
        url := format('https://%s.supabase.co/functions/v1/sync-file-integration', project_ref),
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || service_key,
            'Content-Type', 'application/json'
        )::jsonb,
        body := '{}'::jsonb
    );
    
    -- Wait up to 20 seconds
    WHILE wait_count < 10 LOOP
        wait_count := wait_count + 1;
        PERFORM pg_sleep(2);
        
        -- Try to get response
        BEGIN
            SELECT * INTO response_record
            FROM net._http_response
            WHERE id = request_id;
            
            IF response_record IS NOT NULL THEN
                EXIT;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors and continue waiting
        END;
    END LOOP;
    
    -- Return whatever we have
    IF response_record IS NOT NULL THEN
        RETURN json_build_object(
            'request_id', request_id,
            'status_code', response_record.status_code,
            'response_body', LEFT(response_record.content::text, 500),
            'waited_seconds', wait_count * 2
        );
    ELSE
        RETURN json_build_object(
            'request_id', request_id,
            'status_code', null,
            'error', 'No response after ' || (wait_count * 2) || ' seconds',
            'edge_function_url', format('https://%s.supabase.co/functions/v1/sync-file-integration', project_ref)
        );
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_intervals_basic()
 RETURNS TABLE(id uuid, name text, interval_num integer, interval_unit text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ds.id,
        ds.name::TEXT,
        COALESCE((ds.sync_config->>'interval')::INTEGER, 60),
        COALESCE(ds.sync_config->>'intervalUnit', 'minutes')::TEXT
    FROM data_sources ds
    WHERE ds.type = 'file'
    AND ds.active = true
    LIMIT 10;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_pg_net_basic()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    request_id BIGINT;
    attempts INTEGER := 0;
    response_status INTEGER;
    response_body TEXT;
BEGIN
    -- Make a simple request to a known endpoint
    request_id := net.http_get('https://httpbin.org/get');
    
    -- Log the request
    INSERT INTO debug_log (function_name, message, data)
    VALUES ('test_pg_net_basic', 'Request sent', jsonb_build_object('request_id', request_id));
    
    -- Wait for response with multiple checks
    WHILE attempts < 10 LOOP
        attempts := attempts + 1;
        PERFORM pg_sleep(1);
        
        -- Check for response
        SELECT status_code, content::text
        INTO response_status, response_body
        FROM net._http_response
        WHERE id = request_id;
        
        -- Log each attempt
        INSERT INTO debug_log (function_name, message, data)
        VALUES ('test_pg_net_basic', 'Check attempt', jsonb_build_object(
            'attempt', attempts,
            'found', response_status IS NOT NULL
        ));
        
        EXIT WHEN response_status IS NOT NULL;
    END LOOP;
    
    -- Check the request status
    PERFORM check_pg_net_request(request_id);
    
    RETURN json_build_object(
        'request_id', request_id,
        'attempts', attempts,
        'status', response_status,
        'body_preview', LEFT(response_body, 200),
        'success', response_status IS NOT NULL
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_pg_net_with_logging()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    request_id BIGINT;
    result_status INTEGER;
    result_body TEXT;
    service_key TEXT;
    project_ref TEXT;
BEGIN
    -- Log start
    PERFORM log_debug('test_pg_net', 'Starting test');
    
    -- Get secrets
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
    SELECT decrypted_secret INTO project_ref FROM vault.decrypted_secrets WHERE name = 'project_ref';
    
    -- Log what we found
    PERFORM log_debug('test_pg_net', 'Vault check', jsonb_build_object(
        'service_key_exists', service_key IS NOT NULL,
        'service_key_length', LENGTH(service_key),
        'project_ref', project_ref
    ));
    
    -- Make request
    request_id := net.http_get('https://httpstat.us/200');
    
    PERFORM log_debug('test_pg_net', 'Request made', jsonb_build_object('request_id', request_id));
    
    -- Wait
    PERFORM pg_sleep(2);
    
    -- Check response
    SELECT status_code, content::text
    INTO result_status, result_body
    FROM net._http_response
    WHERE id = request_id;
    
    PERFORM log_debug('test_pg_net', 'Response received', jsonb_build_object(
        'status', result_status,
        'body_length', LENGTH(result_body),
        'body_preview', LEFT(result_body, 100)
    ));
    
    RETURN json_build_object(
        'request_id', request_id,
        'status', result_status,
        'check_logs', 'SELECT * FROM debug_log ORDER BY id DESC LIMIT 10'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_simple()
 RETURNS TABLE(id uuid, name text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ds.id,
        ds.name::TEXT
    FROM data_sources ds
    WHERE ds.type = 'file'
    LIMIT 5;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_single_item_processing()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    test_item RECORD;
    result json := '{}';
BEGIN
    -- Get one item
    SELECT 
        q.id as queue_id,
        q.data_source_id,
        q.status,
        ds.name,
        ds.sync_config
    INTO test_item
    FROM file_sync_queue q
    JOIN data_sources ds ON ds.id = q.data_source_id
    WHERE q.status = 'pending'
    LIMIT 1;
    
    IF test_item IS NULL THEN
        RETURN json_build_object('error', 'No pending items found');
    END IF;
    
    -- Build the result step by step
    result := json_build_object(
        'found_item', test_item.name,
        'queue_id', test_item.queue_id,
        'current_status', test_item.status,
        'sync_config', test_item.sync_config
    );
    
    -- Try to update it
    BEGIN
        UPDATE file_sync_queue 
        SET status = 'processing', processed_at = NOW()
        WHERE id = test_item.queue_id;
        
        result := result || json_build_object('step1', 'Updated to processing');
        
        UPDATE data_sources
        SET sync_status = 'idle'
        WHERE id = test_item.data_source_id;
        
        result := result || json_build_object('step2', 'Updated data source');
        
        UPDATE file_sync_queue 
        SET status = 'ready'
        WHERE id = test_item.queue_id;
        
        result := result || json_build_object('step3', 'Updated to ready', 'success', true);
        
    EXCEPTION WHEN OTHERS THEN
        result := result || json_build_object('error', SQLERRM);
    END;
    
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_sync_components()
 RETURNS TABLE(test_name text, result text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    service_key TEXT;
    vault_count INTEGER;
    queue_count INTEGER;
    http_test RECORD;
    url_test TEXT;
BEGIN
    -- Test 1: Queue status
    SELECT COUNT(*) INTO queue_count FROM file_sync_queue WHERE status = 'pending';
    RETURN QUERY SELECT 'Queue Count'::TEXT, format('%s pending items', queue_count);
    
    -- Test 2: Vault secrets
    SELECT COUNT(*) INTO vault_count FROM vault.secrets;
    RETURN QUERY SELECT 'Vault Secrets'::TEXT, format('%s secrets found', vault_count);
    
    -- Test 3: List vault secrets
    FOR vault_count IN SELECT name FROM vault.secrets LOOP
        RETURN QUERY SELECT 'Vault Secret Name'::TEXT, vault_count::TEXT;
    END LOOP;
    
    -- Test 4: Service key retrieval
    BEGIN
        SELECT decrypted_secret INTO service_key 
        FROM vault.decrypted_secrets 
        LIMIT 1;
        
        RETURN QUERY SELECT 'Service Key'::TEXT, 
            CASE WHEN service_key IS NOT NULL 
                 THEN format('Found (length: %s)', LENGTH(service_key))
                 ELSE 'Not found' 
            END;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'Service Key'::TEXT, format('Error: %s', SQLERRM);
    END;
    
    -- Test 5: URL construction
    BEGIN
        url_test := format('https://%s.supabase.co/functions/v1/sync-file-integration', 
                          split_part(current_setting('app.supabase_url', true), '.', 1));
        RETURN QUERY SELECT 'Edge Function URL'::TEXT, url_test;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'Edge Function URL'::TEXT, format('Error: %s', SQLERRM);
    END;
    
    -- Test 6: HTTP connectivity
    BEGIN
        SELECT net.http_get('https://httpstat.us/200') INTO http_test;
        RETURN QUERY SELECT 'HTTP Test'::TEXT, format('Status: %s', http_test.status);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'HTTP Test'::TEXT, format('Error: %s', SQLERRM);
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_vault_secrets()
 RETURNS TABLE(secret_name text, status text, preview text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Check service_role_key
    RETURN QUERY
    SELECT 
        'service_role_key'::TEXT,
        CASE WHEN decrypted_secret IS NOT NULL THEN 'OK' ELSE 'MISSING' END,
        CASE 
            WHEN decrypted_secret IS NOT NULL 
            THEN 'Length: ' || LENGTH(decrypted_secret) || ', starts with: ' || LEFT(decrypted_secret, 20)
            ELSE 'Not found in vault'
        END
    FROM vault.decrypted_secrets 
    WHERE name = 'service_role_key';
    
    -- Check project_ref
    RETURN QUERY
    SELECT 
        'project_ref'::TEXT,
        CASE WHEN decrypted_secret IS NOT NULL THEN 'OK' ELSE 'MISSING' END,
        CASE 
            WHEN decrypted_secret IS NOT NULL 
            THEN 'Value: ' || decrypted_secret
            ELSE 'Not found in vault'
        END
    FROM vault.decrypted_secrets 
    WHERE name = 'project_ref';
    
    -- Check if we can build a valid URL
    RETURN QUERY
    WITH vault_data AS (
        SELECT 
            MAX(CASE WHEN name = 'project_ref' THEN decrypted_secret END) as proj_ref,
            MAX(CASE WHEN name = 'service_role_key' THEN decrypted_secret END) as svc_key
        FROM vault.decrypted_secrets
        WHERE name IN ('project_ref', 'service_role_key')
    )
    SELECT 
        'edge_function_url'::TEXT,
        CASE 
            WHEN proj_ref IS NOT NULL AND svc_key IS NOT NULL THEN 'OK'
            ELSE 'CANNOT_BUILD'
        END,
        CASE 
            WHEN proj_ref IS NOT NULL 
            THEN format('https://%s.supabase.co/functions/v1/sync-file-integration', proj_ref)
            ELSE 'Missing project_ref'
        END
    FROM vault_data;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_order_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update order for remaining items in the same parent
  IF OLD.parent_id IS NOT NULL THEN
    -- Update items with same parent
    UPDATE channels 
    SET "order" = "order" - 1 
    WHERE parent_id = OLD.parent_id 
    AND "order" > OLD."order";
    
    UPDATE content 
    SET "order" = "order" - 1 
    WHERE parent_id = OLD.parent_id 
    AND "order" > OLD."order";
    
    UPDATE templates 
    SET "order" = "order" - 1 
    WHERE parent_id = OLD.parent_id 
    AND "order" > OLD."order";
  ELSE
    -- For top-level items (parent_id is NULL)
    UPDATE channels 
    SET "order" = "order" - 1 
    WHERE parent_id IS NULL 
    AND "order" > OLD."order"
    AND id != OLD.id;
    
    UPDATE content 
    SET "order" = "order" - 1 
    WHERE parent_id IS NULL 
    AND "order" > OLD."order"
    AND id != OLD.id;
    
    UPDATE templates 
    SET "order" = "order" - 1 
    WHERE parent_id IS NULL 
    AND "order" > OLD."order"
    AND id != OLD.id;
  END IF;
  
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_user_layout(p_layout_name text, p_layout_data jsonb)
 RETURNS user_layouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result user_layouts;
  v_user_id uuid;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Insert or update the layout
  INSERT INTO user_layouts (user_id, layout_name, layout_data, updated_at)
  VALUES (v_user_id, p_layout_name, p_layout_data, now())
  ON CONFLICT (user_id, layout_name) 
  DO UPDATE SET 
    layout_data = EXCLUDED.layout_data,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_user_layout_with_id(p_user_id uuid, p_layout_name text, p_layout_data jsonb)
 RETURNS user_layouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result user_layouts;
BEGIN
  -- Verify the user is updating their own layout
  IF p_user_id != auth.uid() AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update layout for another user';
  END IF;
  
  -- Insert or update the layout
  INSERT INTO user_layouts (user_id, layout_name, layout_data, updated_at)
  VALUES (p_user_id, p_layout_name, p_layout_data, now())
  ON CONFLICT (user_id, layout_name) 
  DO UPDATE SET 
    layout_data = EXCLUDED.layout_data,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_channel_hierarchy()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.type = 'channel' AND NEW.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Channels cannot have a parent';
  END IF;

  IF NEW.type = 'playlist' AND (
    NEW.parent_id IS NULL OR 
    NOT EXISTS (
      SELECT 1 FROM channels 
      WHERE id = NEW.parent_id AND type = 'channel'
    )
  ) THEN
    RAISE EXCEPTION 'Playlists must have a channel as parent';
  END IF;

  IF NEW.type = 'bucket' AND (
    NEW.parent_id IS NULL OR 
    NOT EXISTS (
      SELECT 1 FROM channels 
      WHERE id = NEW.parent_id AND type = 'playlist'
    )
  ) THEN
    RAISE EXCEPTION 'Buckets must have a playlist as parent';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_content_hierarchy()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM content WHERE id = NEW.parent_id) THEN
      RAISE EXCEPTION 'Parent content with ID % does not exist', NEW.parent_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_item_tabfields_content()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM content 
    WHERE content.id = NEW.item_id 
    AND content.type = 'item'
  ) THEN
    RAISE EXCEPTION 'content_id must reference a content record of type "item"';
  END IF;
  RETURN NEW;
END;$function$
;

CREATE OR REPLACE FUNCTION public.validate_template_hierarchy()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM templates WHERE id = NEW.parent_id) THEN
      RAISE EXCEPTION 'Parent template with ID % does not exist', NEW.parent_id;
    END IF;
    
    IF NEW.type = 'template' AND EXISTS (
      SELECT 1 FROM templates 
      WHERE id = NEW.parent_id 
      AND type != 'templateFolder'
    ) THEN
      RAISE EXCEPTION 'Templates can only have template folders as parents';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."api_access_logs" to "anon";

grant insert on table "public"."api_access_logs" to "anon";

grant references on table "public"."api_access_logs" to "anon";

grant select on table "public"."api_access_logs" to "anon";

grant trigger on table "public"."api_access_logs" to "anon";

grant truncate on table "public"."api_access_logs" to "anon";

grant update on table "public"."api_access_logs" to "anon";

grant delete on table "public"."api_access_logs" to "authenticated";

grant insert on table "public"."api_access_logs" to "authenticated";

grant references on table "public"."api_access_logs" to "authenticated";

grant select on table "public"."api_access_logs" to "authenticated";

grant trigger on table "public"."api_access_logs" to "authenticated";

grant truncate on table "public"."api_access_logs" to "authenticated";

grant update on table "public"."api_access_logs" to "authenticated";

grant delete on table "public"."api_access_logs" to "service_role";

grant insert on table "public"."api_access_logs" to "service_role";

grant references on table "public"."api_access_logs" to "service_role";

grant select on table "public"."api_access_logs" to "service_role";

grant trigger on table "public"."api_access_logs" to "service_role";

grant truncate on table "public"."api_access_logs" to "service_role";

grant update on table "public"."api_access_logs" to "service_role";

grant delete on table "public"."api_documentation" to "anon";

grant insert on table "public"."api_documentation" to "anon";

grant references on table "public"."api_documentation" to "anon";

grant select on table "public"."api_documentation" to "anon";

grant trigger on table "public"."api_documentation" to "anon";

grant truncate on table "public"."api_documentation" to "anon";

grant update on table "public"."api_documentation" to "anon";

grant delete on table "public"."api_documentation" to "authenticated";

grant insert on table "public"."api_documentation" to "authenticated";

grant references on table "public"."api_documentation" to "authenticated";

grant select on table "public"."api_documentation" to "authenticated";

grant trigger on table "public"."api_documentation" to "authenticated";

grant truncate on table "public"."api_documentation" to "authenticated";

grant update on table "public"."api_documentation" to "authenticated";

grant delete on table "public"."api_documentation" to "service_role";

grant insert on table "public"."api_documentation" to "service_role";

grant references on table "public"."api_documentation" to "service_role";

grant select on table "public"."api_documentation" to "service_role";

grant trigger on table "public"."api_documentation" to "service_role";

grant truncate on table "public"."api_documentation" to "service_role";

grant update on table "public"."api_documentation" to "service_role";

grant delete on table "public"."api_endpoint_sources" to "anon";

grant insert on table "public"."api_endpoint_sources" to "anon";

grant references on table "public"."api_endpoint_sources" to "anon";

grant select on table "public"."api_endpoint_sources" to "anon";

grant trigger on table "public"."api_endpoint_sources" to "anon";

grant truncate on table "public"."api_endpoint_sources" to "anon";

grant update on table "public"."api_endpoint_sources" to "anon";

grant delete on table "public"."api_endpoint_sources" to "authenticated";

grant insert on table "public"."api_endpoint_sources" to "authenticated";

grant references on table "public"."api_endpoint_sources" to "authenticated";

grant select on table "public"."api_endpoint_sources" to "authenticated";

grant trigger on table "public"."api_endpoint_sources" to "authenticated";

grant truncate on table "public"."api_endpoint_sources" to "authenticated";

grant update on table "public"."api_endpoint_sources" to "authenticated";

grant delete on table "public"."api_endpoint_sources" to "service_role";

grant insert on table "public"."api_endpoint_sources" to "service_role";

grant references on table "public"."api_endpoint_sources" to "service_role";

grant select on table "public"."api_endpoint_sources" to "service_role";

grant trigger on table "public"."api_endpoint_sources" to "service_role";

grant truncate on table "public"."api_endpoint_sources" to "service_role";

grant update on table "public"."api_endpoint_sources" to "service_role";

grant delete on table "public"."api_endpoints" to "anon";

grant insert on table "public"."api_endpoints" to "anon";

grant references on table "public"."api_endpoints" to "anon";

grant select on table "public"."api_endpoints" to "anon";

grant trigger on table "public"."api_endpoints" to "anon";

grant truncate on table "public"."api_endpoints" to "anon";

grant update on table "public"."api_endpoints" to "anon";

grant delete on table "public"."api_endpoints" to "authenticated";

grant insert on table "public"."api_endpoints" to "authenticated";

grant references on table "public"."api_endpoints" to "authenticated";

grant select on table "public"."api_endpoints" to "authenticated";

grant trigger on table "public"."api_endpoints" to "authenticated";

grant truncate on table "public"."api_endpoints" to "authenticated";

grant update on table "public"."api_endpoints" to "authenticated";

grant delete on table "public"."api_endpoints" to "service_role";

grant insert on table "public"."api_endpoints" to "service_role";

grant references on table "public"."api_endpoints" to "service_role";

grant select on table "public"."api_endpoints" to "service_role";

grant trigger on table "public"."api_endpoints" to "service_role";

grant truncate on table "public"."api_endpoints" to "service_role";

grant update on table "public"."api_endpoints" to "service_role";

grant delete on table "public"."api_field_mappings" to "anon";

grant insert on table "public"."api_field_mappings" to "anon";

grant references on table "public"."api_field_mappings" to "anon";

grant select on table "public"."api_field_mappings" to "anon";

grant trigger on table "public"."api_field_mappings" to "anon";

grant truncate on table "public"."api_field_mappings" to "anon";

grant update on table "public"."api_field_mappings" to "anon";

grant delete on table "public"."api_field_mappings" to "authenticated";

grant insert on table "public"."api_field_mappings" to "authenticated";

grant references on table "public"."api_field_mappings" to "authenticated";

grant select on table "public"."api_field_mappings" to "authenticated";

grant trigger on table "public"."api_field_mappings" to "authenticated";

grant truncate on table "public"."api_field_mappings" to "authenticated";

grant update on table "public"."api_field_mappings" to "authenticated";

grant delete on table "public"."api_field_mappings" to "service_role";

grant insert on table "public"."api_field_mappings" to "service_role";

grant references on table "public"."api_field_mappings" to "service_role";

grant select on table "public"."api_field_mappings" to "service_role";

grant trigger on table "public"."api_field_mappings" to "service_role";

grant truncate on table "public"."api_field_mappings" to "service_role";

grant update on table "public"."api_field_mappings" to "service_role";

grant delete on table "public"."api_transformations" to "anon";

grant insert on table "public"."api_transformations" to "anon";

grant references on table "public"."api_transformations" to "anon";

grant select on table "public"."api_transformations" to "anon";

grant trigger on table "public"."api_transformations" to "anon";

grant truncate on table "public"."api_transformations" to "anon";

grant update on table "public"."api_transformations" to "anon";

grant delete on table "public"."api_transformations" to "authenticated";

grant insert on table "public"."api_transformations" to "authenticated";

grant references on table "public"."api_transformations" to "authenticated";

grant select on table "public"."api_transformations" to "authenticated";

grant trigger on table "public"."api_transformations" to "authenticated";

grant truncate on table "public"."api_transformations" to "authenticated";

grant update on table "public"."api_transformations" to "authenticated";

grant delete on table "public"."api_transformations" to "service_role";

grant insert on table "public"."api_transformations" to "service_role";

grant references on table "public"."api_transformations" to "service_role";

grant select on table "public"."api_transformations" to "service_role";

grant trigger on table "public"."api_transformations" to "service_role";

grant truncate on table "public"."api_transformations" to "service_role";

grant update on table "public"."api_transformations" to "service_role";

grant delete on table "public"."channels" to "anon";

grant insert on table "public"."channels" to "anon";

grant references on table "public"."channels" to "anon";

grant select on table "public"."channels" to "anon";

grant trigger on table "public"."channels" to "anon";

grant truncate on table "public"."channels" to "anon";

grant update on table "public"."channels" to "anon";

grant delete on table "public"."channels" to "authenticated";

grant insert on table "public"."channels" to "authenticated";

grant references on table "public"."channels" to "authenticated";

grant select on table "public"."channels" to "authenticated";

grant trigger on table "public"."channels" to "authenticated";

grant truncate on table "public"."channels" to "authenticated";

grant update on table "public"."channels" to "authenticated";

grant delete on table "public"."channels" to "service_role";

grant insert on table "public"."channels" to "service_role";

grant references on table "public"."channels" to "service_role";

grant select on table "public"."channels" to "service_role";

grant trigger on table "public"."channels" to "service_role";

grant truncate on table "public"."channels" to "service_role";

grant update on table "public"."channels" to "service_role";

grant delete on table "public"."content" to "anon";

grant insert on table "public"."content" to "anon";

grant references on table "public"."content" to "anon";

grant select on table "public"."content" to "anon";

grant trigger on table "public"."content" to "anon";

grant truncate on table "public"."content" to "anon";

grant update on table "public"."content" to "anon";

grant delete on table "public"."content" to "authenticated";

grant insert on table "public"."content" to "authenticated";

grant references on table "public"."content" to "authenticated";

grant select on table "public"."content" to "authenticated";

grant trigger on table "public"."content" to "authenticated";

grant truncate on table "public"."content" to "authenticated";

grant update on table "public"."content" to "authenticated";

grant delete on table "public"."content" to "service_role";

grant insert on table "public"."content" to "service_role";

grant references on table "public"."content" to "service_role";

grant select on table "public"."content" to "service_role";

grant trigger on table "public"."content" to "service_role";

grant truncate on table "public"."content" to "service_role";

grant update on table "public"."content" to "service_role";

grant delete on table "public"."data_source_sync_logs" to "anon";

grant insert on table "public"."data_source_sync_logs" to "anon";

grant references on table "public"."data_source_sync_logs" to "anon";

grant select on table "public"."data_source_sync_logs" to "anon";

grant trigger on table "public"."data_source_sync_logs" to "anon";

grant truncate on table "public"."data_source_sync_logs" to "anon";

grant update on table "public"."data_source_sync_logs" to "anon";

grant delete on table "public"."data_source_sync_logs" to "authenticated";

grant insert on table "public"."data_source_sync_logs" to "authenticated";

grant references on table "public"."data_source_sync_logs" to "authenticated";

grant select on table "public"."data_source_sync_logs" to "authenticated";

grant trigger on table "public"."data_source_sync_logs" to "authenticated";

grant truncate on table "public"."data_source_sync_logs" to "authenticated";

grant update on table "public"."data_source_sync_logs" to "authenticated";

grant delete on table "public"."data_source_sync_logs" to "service_role";

grant insert on table "public"."data_source_sync_logs" to "service_role";

grant references on table "public"."data_source_sync_logs" to "service_role";

grant select on table "public"."data_source_sync_logs" to "service_role";

grant trigger on table "public"."data_source_sync_logs" to "service_role";

grant truncate on table "public"."data_source_sync_logs" to "service_role";

grant update on table "public"."data_source_sync_logs" to "service_role";

grant delete on table "public"."data_sources" to "anon";

grant insert on table "public"."data_sources" to "anon";

grant references on table "public"."data_sources" to "anon";

grant select on table "public"."data_sources" to "anon";

grant trigger on table "public"."data_sources" to "anon";

grant truncate on table "public"."data_sources" to "anon";

grant update on table "public"."data_sources" to "anon";

grant delete on table "public"."data_sources" to "authenticated";

grant insert on table "public"."data_sources" to "authenticated";

grant references on table "public"."data_sources" to "authenticated";

grant select on table "public"."data_sources" to "authenticated";

grant trigger on table "public"."data_sources" to "authenticated";

grant truncate on table "public"."data_sources" to "authenticated";

grant update on table "public"."data_sources" to "authenticated";

grant delete on table "public"."data_sources" to "service_role";

grant insert on table "public"."data_sources" to "service_role";

grant references on table "public"."data_sources" to "service_role";

grant select on table "public"."data_sources" to "service_role";

grant trigger on table "public"."data_sources" to "service_role";

grant truncate on table "public"."data_sources" to "service_role";

grant update on table "public"."data_sources" to "service_role";

grant delete on table "public"."data_sources_backup" to "anon";

grant insert on table "public"."data_sources_backup" to "anon";

grant references on table "public"."data_sources_backup" to "anon";

grant select on table "public"."data_sources_backup" to "anon";

grant trigger on table "public"."data_sources_backup" to "anon";

grant truncate on table "public"."data_sources_backup" to "anon";

grant update on table "public"."data_sources_backup" to "anon";

grant delete on table "public"."data_sources_backup" to "authenticated";

grant insert on table "public"."data_sources_backup" to "authenticated";

grant references on table "public"."data_sources_backup" to "authenticated";

grant select on table "public"."data_sources_backup" to "authenticated";

grant trigger on table "public"."data_sources_backup" to "authenticated";

grant truncate on table "public"."data_sources_backup" to "authenticated";

grant update on table "public"."data_sources_backup" to "authenticated";

grant delete on table "public"."data_sources_backup" to "service_role";

grant insert on table "public"."data_sources_backup" to "service_role";

grant references on table "public"."data_sources_backup" to "service_role";

grant select on table "public"."data_sources_backup" to "service_role";

grant trigger on table "public"."data_sources_backup" to "service_role";

grant truncate on table "public"."data_sources_backup" to "service_role";

grant update on table "public"."data_sources_backup" to "service_role";

grant delete on table "public"."debug_log" to "anon";

grant insert on table "public"."debug_log" to "anon";

grant references on table "public"."debug_log" to "anon";

grant select on table "public"."debug_log" to "anon";

grant trigger on table "public"."debug_log" to "anon";

grant truncate on table "public"."debug_log" to "anon";

grant update on table "public"."debug_log" to "anon";

grant delete on table "public"."debug_log" to "authenticated";

grant insert on table "public"."debug_log" to "authenticated";

grant references on table "public"."debug_log" to "authenticated";

grant select on table "public"."debug_log" to "authenticated";

grant trigger on table "public"."debug_log" to "authenticated";

grant truncate on table "public"."debug_log" to "authenticated";

grant update on table "public"."debug_log" to "authenticated";

grant delete on table "public"."debug_log" to "service_role";

grant insert on table "public"."debug_log" to "service_role";

grant references on table "public"."debug_log" to "service_role";

grant select on table "public"."debug_log" to "service_role";

grant trigger on table "public"."debug_log" to "service_role";

grant truncate on table "public"."debug_log" to "service_role";

grant update on table "public"."debug_log" to "service_role";

grant delete on table "public"."file_sync_queue" to "anon";

grant insert on table "public"."file_sync_queue" to "anon";

grant references on table "public"."file_sync_queue" to "anon";

grant select on table "public"."file_sync_queue" to "anon";

grant trigger on table "public"."file_sync_queue" to "anon";

grant truncate on table "public"."file_sync_queue" to "anon";

grant update on table "public"."file_sync_queue" to "anon";

grant delete on table "public"."file_sync_queue" to "authenticated";

grant insert on table "public"."file_sync_queue" to "authenticated";

grant references on table "public"."file_sync_queue" to "authenticated";

grant select on table "public"."file_sync_queue" to "authenticated";

grant trigger on table "public"."file_sync_queue" to "authenticated";

grant truncate on table "public"."file_sync_queue" to "authenticated";

grant update on table "public"."file_sync_queue" to "authenticated";

grant delete on table "public"."file_sync_queue" to "service_role";

grant insert on table "public"."file_sync_queue" to "service_role";

grant references on table "public"."file_sync_queue" to "service_role";

grant select on table "public"."file_sync_queue" to "service_role";

grant trigger on table "public"."file_sync_queue" to "service_role";

grant truncate on table "public"."file_sync_queue" to "service_role";

grant update on table "public"."file_sync_queue" to "service_role";

grant delete on table "public"."item_tabfields" to "anon";

grant insert on table "public"."item_tabfields" to "anon";

grant references on table "public"."item_tabfields" to "anon";

grant select on table "public"."item_tabfields" to "anon";

grant trigger on table "public"."item_tabfields" to "anon";

grant truncate on table "public"."item_tabfields" to "anon";

grant update on table "public"."item_tabfields" to "anon";

grant delete on table "public"."item_tabfields" to "authenticated";

grant insert on table "public"."item_tabfields" to "authenticated";

grant references on table "public"."item_tabfields" to "authenticated";

grant select on table "public"."item_tabfields" to "authenticated";

grant trigger on table "public"."item_tabfields" to "authenticated";

grant truncate on table "public"."item_tabfields" to "authenticated";

grant update on table "public"."item_tabfields" to "authenticated";

grant delete on table "public"."item_tabfields" to "service_role";

grant insert on table "public"."item_tabfields" to "service_role";

grant references on table "public"."item_tabfields" to "service_role";

grant select on table "public"."item_tabfields" to "service_role";

grant trigger on table "public"."item_tabfields" to "service_role";

grant truncate on table "public"."item_tabfields" to "service_role";

grant update on table "public"."item_tabfields" to "service_role";

grant delete on table "public"."sync_queue" to "anon";

grant insert on table "public"."sync_queue" to "anon";

grant references on table "public"."sync_queue" to "anon";

grant select on table "public"."sync_queue" to "anon";

grant trigger on table "public"."sync_queue" to "anon";

grant truncate on table "public"."sync_queue" to "anon";

grant update on table "public"."sync_queue" to "anon";

grant delete on table "public"."sync_queue" to "authenticated";

grant insert on table "public"."sync_queue" to "authenticated";

grant references on table "public"."sync_queue" to "authenticated";

grant select on table "public"."sync_queue" to "authenticated";

grant trigger on table "public"."sync_queue" to "authenticated";

grant truncate on table "public"."sync_queue" to "authenticated";

grant update on table "public"."sync_queue" to "authenticated";

grant delete on table "public"."sync_queue" to "service_role";

grant insert on table "public"."sync_queue" to "service_role";

grant references on table "public"."sync_queue" to "service_role";

grant select on table "public"."sync_queue" to "service_role";

grant trigger on table "public"."sync_queue" to "service_role";

grant truncate on table "public"."sync_queue" to "service_role";

grant update on table "public"."sync_queue" to "service_role";

grant delete on table "public"."tabfields" to "anon";

grant insert on table "public"."tabfields" to "anon";

grant references on table "public"."tabfields" to "anon";

grant select on table "public"."tabfields" to "anon";

grant trigger on table "public"."tabfields" to "anon";

grant truncate on table "public"."tabfields" to "anon";

grant update on table "public"."tabfields" to "anon";

grant delete on table "public"."tabfields" to "authenticated";

grant insert on table "public"."tabfields" to "authenticated";

grant references on table "public"."tabfields" to "authenticated";

grant select on table "public"."tabfields" to "authenticated";

grant trigger on table "public"."tabfields" to "authenticated";

grant truncate on table "public"."tabfields" to "authenticated";

grant update on table "public"."tabfields" to "authenticated";

grant delete on table "public"."tabfields" to "service_role";

grant insert on table "public"."tabfields" to "service_role";

grant references on table "public"."tabfields" to "service_role";

grant select on table "public"."tabfields" to "service_role";

grant trigger on table "public"."tabfields" to "service_role";

grant truncate on table "public"."tabfields" to "service_role";

grant update on table "public"."tabfields" to "service_role";

grant delete on table "public"."template_forms" to "anon";

grant insert on table "public"."template_forms" to "anon";

grant references on table "public"."template_forms" to "anon";

grant select on table "public"."template_forms" to "anon";

grant trigger on table "public"."template_forms" to "anon";

grant truncate on table "public"."template_forms" to "anon";

grant update on table "public"."template_forms" to "anon";

grant delete on table "public"."template_forms" to "authenticated";

grant insert on table "public"."template_forms" to "authenticated";

grant references on table "public"."template_forms" to "authenticated";

grant select on table "public"."template_forms" to "authenticated";

grant trigger on table "public"."template_forms" to "authenticated";

grant truncate on table "public"."template_forms" to "authenticated";

grant update on table "public"."template_forms" to "authenticated";

grant delete on table "public"."template_forms" to "service_role";

grant insert on table "public"."template_forms" to "service_role";

grant references on table "public"."template_forms" to "service_role";

grant select on table "public"."template_forms" to "service_role";

grant trigger on table "public"."template_forms" to "service_role";

grant truncate on table "public"."template_forms" to "service_role";

grant update on table "public"."template_forms" to "service_role";

grant delete on table "public"."template_settings" to "anon";

grant insert on table "public"."template_settings" to "anon";

grant references on table "public"."template_settings" to "anon";

grant select on table "public"."template_settings" to "anon";

grant trigger on table "public"."template_settings" to "anon";

grant truncate on table "public"."template_settings" to "anon";

grant update on table "public"."template_settings" to "anon";

grant delete on table "public"."template_settings" to "authenticated";

grant insert on table "public"."template_settings" to "authenticated";

grant references on table "public"."template_settings" to "authenticated";

grant select on table "public"."template_settings" to "authenticated";

grant trigger on table "public"."template_settings" to "authenticated";

grant truncate on table "public"."template_settings" to "authenticated";

grant update on table "public"."template_settings" to "authenticated";

grant delete on table "public"."template_settings" to "service_role";

grant insert on table "public"."template_settings" to "service_role";

grant references on table "public"."template_settings" to "service_role";

grant select on table "public"."template_settings" to "service_role";

grant trigger on table "public"."template_settings" to "service_role";

grant truncate on table "public"."template_settings" to "service_role";

grant update on table "public"."template_settings" to "service_role";

grant delete on table "public"."templates" to "anon";

grant insert on table "public"."templates" to "anon";

grant references on table "public"."templates" to "anon";

grant select on table "public"."templates" to "anon";

grant trigger on table "public"."templates" to "anon";

grant truncate on table "public"."templates" to "anon";

grant update on table "public"."templates" to "anon";

grant delete on table "public"."templates" to "authenticated";

grant insert on table "public"."templates" to "authenticated";

grant references on table "public"."templates" to "authenticated";

grant select on table "public"."templates" to "authenticated";

grant trigger on table "public"."templates" to "authenticated";

grant truncate on table "public"."templates" to "authenticated";

grant update on table "public"."templates" to "authenticated";

grant delete on table "public"."templates" to "service_role";

grant insert on table "public"."templates" to "service_role";

grant references on table "public"."templates" to "service_role";

grant select on table "public"."templates" to "service_role";

grant trigger on table "public"."templates" to "service_role";

grant truncate on table "public"."templates" to "service_role";

grant update on table "public"."templates" to "service_role";

grant delete on table "public"."user_layouts" to "anon";

grant insert on table "public"."user_layouts" to "anon";

grant references on table "public"."user_layouts" to "anon";

grant select on table "public"."user_layouts" to "anon";

grant trigger on table "public"."user_layouts" to "anon";

grant truncate on table "public"."user_layouts" to "anon";

grant update on table "public"."user_layouts" to "anon";

grant delete on table "public"."user_layouts" to "authenticated";

grant insert on table "public"."user_layouts" to "authenticated";

grant references on table "public"."user_layouts" to "authenticated";

grant select on table "public"."user_layouts" to "authenticated";

grant trigger on table "public"."user_layouts" to "authenticated";

grant truncate on table "public"."user_layouts" to "authenticated";

grant update on table "public"."user_layouts" to "authenticated";

grant delete on table "public"."user_layouts" to "service_role";

grant insert on table "public"."user_layouts" to "service_role";

grant references on table "public"."user_layouts" to "service_role";

grant select on table "public"."user_layouts" to "service_role";

grant trigger on table "public"."user_layouts" to "service_role";

grant truncate on table "public"."user_layouts" to "service_role";

grant update on table "public"."user_layouts" to "service_role";

create policy "Full access for authenticated users"
on "public"."api_access_logs"
as permissive
for all
to authenticated
using (true)
with check (true);


create policy "Users can view logs for their endpoints"
on "public"."api_access_logs"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM api_endpoints
  WHERE ((api_endpoints.id = api_access_logs.endpoint_id) AND (api_endpoints.user_id = auth.uid())))));


create policy "Full access for authenticated users"
on "public"."api_documentation"
as permissive
for all
to authenticated
using (true)
with check (true);


create policy "Users can manage docs for their endpoints"
on "public"."api_documentation"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM api_endpoints
  WHERE ((api_endpoints.id = api_documentation.endpoint_id) AND (api_endpoints.user_id = auth.uid())))));


create policy "Full access for authenticated users"
on "public"."api_endpoint_sources"
as permissive
for all
to authenticated
using (true)
with check (true);


create policy "Users can manage sources for their endpoints"
on "public"."api_endpoint_sources"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM api_endpoints
  WHERE ((api_endpoints.id = api_endpoint_sources.endpoint_id) AND (api_endpoints.user_id = auth.uid())))));


create policy "All authenticated users can delete api_endpoints"
on "public"."api_endpoints"
as permissive
for delete
to authenticated
using (true);


create policy "All authenticated users can insert api_endpoints"
on "public"."api_endpoints"
as permissive
for insert
to authenticated
with check (true);


create policy "All authenticated users can update api_endpoints"
on "public"."api_endpoints"
as permissive
for update
to authenticated
using (true)
with check (true);


create policy "All authenticated users can view api_endpoints"
on "public"."api_endpoints"
as permissive
for select
to authenticated
using (true);


create policy "Anyone can view api_endpoints"
on "public"."api_endpoints"
as permissive
for select
to authenticated
using (true);


create policy "Authenticated users can create api_endpoints"
on "public"."api_endpoints"
as permissive
for insert
to authenticated
with check ((auth.uid() = user_id));


create policy "Full access for authenticated users"
on "public"."api_endpoints"
as permissive
for all
to authenticated
using (true)
with check (true);


create policy "Users can create their own endpoints"
on "public"."api_endpoints"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can delete their own endpoints"
on "public"."api_endpoints"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can update their own endpoints"
on "public"."api_endpoints"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own or active endpoints"
on "public"."api_endpoints"
as permissive
for select
to public
using (((auth.uid() = user_id) OR (active = true)));


create policy "Full access for authenticated users"
on "public"."api_field_mappings"
as permissive
for all
to authenticated
using (true)
with check (true);


create policy "Users can manage mappings for their endpoints"
on "public"."api_field_mappings"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM api_endpoints
  WHERE ((api_endpoints.id = api_field_mappings.endpoint_id) AND (api_endpoints.user_id = auth.uid())))));


create policy "Full access for authenticated users"
on "public"."api_transformations"
as permissive
for all
to authenticated
using (true)
with check (true);


create policy "Users can create transformations"
on "public"."api_transformations"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can delete their own transformations"
on "public"."api_transformations"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can update their own transformations"
on "public"."api_transformations"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view public or own transformations"
on "public"."api_transformations"
as permissive
for select
to public
using (((is_public = true) OR (auth.uid() = user_id)));


create policy "Authenticated can read"
on "public"."channels"
as permissive
for select
to public
using ((auth.role() = 'authenticated'::text));


create policy "Authenticated users - full access"
on "public"."channels"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));


create policy "Authenticated users - full access"
on "public"."content"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));


create policy "Users can view their own sync logs"
on "public"."data_source_sync_logs"
as permissive
for select
to public
using ((data_source_id IN ( SELECT data_sources.id
   FROM data_sources
  WHERE (data_sources.user_id = auth.uid()))));


create policy "Anyone can read active data sources"
on "public"."data_sources"
as permissive
for select
to public
using ((active = true));


create policy "Authenticated users - full access"
on "public"."data_sources"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));


create policy "Public read access to data sources"
on "public"."data_sources"
as permissive
for select
to public
using (true);


create policy "Anyone authenticated can read item_tabfields"
on "public"."item_tabfields"
as permissive
for select
to public
using ((auth.role() = 'authenticated'::text));


create policy "Authenticated users - full access"
on "public"."item_tabfields"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));


create policy "Anyone authenticated can read tabfields"
on "public"."tabfields"
as permissive
for select
to public
using ((auth.role() = 'authenticated'::text));


create policy "Authenticated users - full access"
on "public"."tabfields"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));


create policy "Anyone authenticated can read template_forms"
on "public"."template_forms"
as permissive
for select
to public
using ((auth.role() = 'authenticated'::text));


create policy "Authenticated users - full access"
on "public"."template_forms"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));


create policy "Authenticated users - full access"
on "public"."templates"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));


create policy "Users access own layouts combined"
on "public"."user_layouts"
as permissive
for all
to public
using (((auth.role() = 'authenticated'::text) AND (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR ((auth.uid() IS NOT NULL) AND ((auth.uid())::text = (user_id)::text)) OR ((user_id)::text = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)))))
with check (((auth.role() = 'authenticated'::text) AND (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR ((auth.uid() IS NOT NULL) AND ((auth.uid())::text = (user_id)::text)) OR ((user_id)::text = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text)))));


create policy "Users can manage their own layouts"
on "public"."user_layouts"
as permissive
for all
to public
using ((auth.uid() = user_id));


CREATE TRIGGER update_api_documentation_updated_at BEFORE UPDATE ON public.api_documentation FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_api_endpoints_updated_at BEFORE UPDATE ON public.api_endpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_api_field_mappings_updated_at BEFORE UPDATE ON public.api_field_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_api_transformations_updated_at BEFORE UPDATE ON public.api_transformations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shift_order_on_delete AFTER DELETE ON public.channels FOR EACH ROW EXECUTE FUNCTION shift_order_on_delete();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER validate_channel_hierarchy BEFORE INSERT OR UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION validate_channel_hierarchy();

CREATE TRIGGER shift_order_on_delete AFTER DELETE ON public.content FOR EACH ROW EXECUTE FUNCTION shift_order_on_delete();

CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON public.content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER validate_content_hierarchy BEFORE INSERT OR UPDATE ON public.content FOR EACH ROW EXECUTE FUNCTION validate_content_hierarchy();

CREATE TRIGGER set_next_sync_at BEFORE INSERT OR UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION calculate_next_sync_at();

CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER queue_ready_trigger AFTER UPDATE ON public.file_sync_queue FOR EACH ROW WHEN (((old.status = 'pending'::text) AND (new.status = 'ready'::text))) EXECUTE FUNCTION notify_edge_function();

CREATE TRIGGER update_item_tabfields_updated_at BEFORE UPDATE ON public.item_tabfields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER validate_item_tabfields_content BEFORE INSERT OR UPDATE ON public.item_tabfields FOR EACH ROW EXECUTE FUNCTION validate_item_tabfields_content();

CREATE TRIGGER update_tabfields_updated_at BEFORE UPDATE ON public.tabfields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ensure_template_forms_schema_not_null BEFORE INSERT OR UPDATE ON public.template_forms FOR EACH ROW EXECUTE FUNCTION ensure_schema_not_null();

CREATE TRIGGER update_template_forms_modtime BEFORE UPDATE ON public.template_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_settings_modtime BEFORE UPDATE ON public.template_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER shift_order_on_delete AFTER DELETE ON public.templates FOR EACH ROW EXECUTE FUNCTION shift_order_on_delete();

CREATE TRIGGER templates_order_update_after_delete AFTER DELETE ON public.templates FOR EACH ROW EXECUTE FUNCTION update_order_after_delete();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER validate_template_hierarchy BEFORE INSERT OR UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION validate_template_hierarchy();


