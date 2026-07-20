create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists "uuid-ossp";

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
--  知识来源表（项目）
create table if not exists sources (
  id uuid primary key description "项目UUID", 
  tenant_id text not null default 'default' description "租户ID", -- 多租户扩展
  name text not null description "项目名称",
  description text description "项目描述",
  metadata jsonb not null default '{}' description "元数据",
  created_at timestamptz not null default now() description "创建时间",
  updated_at timestamptz not null default now() description "更新时间"
);

create index if not exists sources_tenant_id_id_idx on sources (tenant_id, id); -- 租户ID和项目UUID联合索引
create index if not exists sources_tenant_id_name_idx on sources (tenant_id, name); -- 租户ID和项目名称索引

-- 文档表
create table if not exists documents (
  id uuid primary key description "文档UUID",
  source_id uuid not null references sources(id) on delete cascade description "项目UUID",
  external_id text description "外部ID",
  title text not null description "文档标题",
  content text description "文档内容",
  status text not null default 'PENDING' description "文档状态",
  parse_status text not null default 'PENDING' description "解析状态",
  error text description "错误信息",
  metadata jsonb not null default '{}' description "元数据",
  created_at timestamptz not null default now() description "创建时间",
  updated_at timestamptz not null default now() description "更新时间"
);

create index if not exists documents_source_id_idx on documents (source_id);
create index if not exists documents_external_id_idx on documents (external_id);

-- 文档章节表
create table if not exists document_sections (
  id uuid primary key description "文档章节UUID",
  document_id uuid not null references documents(id) on delete cascade description "文档UUID",
  order_index integer not null description "排序索引",
  render_group_index integer not null default 0 description "渲染组索引",
  type text description "章节类型",
  heading text not null default '' description "章节标题",
  content text not null description "章节内容",
  raw_content text description "原始内容",
  image_url text description "图片URL",
  metadata jsonb not null default '{}' description "元数据",
  token_count integer not null default 0 description "token数量",
  created_at timestamptz not null default now() description "创建时间",
);

create index if not exists document_sections_document_order_idx on document_sections (document_id, order_index);

-- 文档块表(chunks)
create table if not exists source_chunks (
  id uuid primary key description "文档块UUID",
  source_id uuid not null references sources(id) on delete cascade description "项目UUID",
  document_id uuid references documents(id) on delete cascade description "文档UUID",
  source_type text not null description "来源类型",
  external_source_id text description "外部来源ID",
  heading text description "块标题",
  content text not null description "块内容",
  raw_content text description "原始内容",
  rank integer not null description "排序索引",
  "references" uuid[] not null default '{}' description "引用",
  metadata jsonb not null default '{}' description "元数据",
  embedding vector(1024) description "向量",
  search_text tsvector generated always as (
    to_tsvector('simple', coalesce(heading, '') || ' ' || coalesce(content, ''))
  ) stored description "搜索文本",
  created_at timestamptz not null default now() description "创建时间",
  updated_at timestamptz not null default now() description "更新时间"
);

create index if not exists source_chunks_source_document_rank_idx on source_chunks (source_id, document_id, rank);
create index if not exists source_chunks_search_text_idx on source_chunks using gin (search_text);
create index if not exists source_chunks_embedding_hnsw on source_chunks using hnsw (embedding vector_cosine_ops);

-- 实体类型表
create table if not exists entity_types (
  id uuid primary key description "实体类型UUID",
  source_id uuid references sources(id) on delete cascade description "项目UUID",
  document_id uuid references documents(id) on delete cascade description "文档UUID",
  scope text not null default 'global',
  type text not null description "实体类型",
  name text not null description "实体类型名称",
  description text description "实体类型描述",
  weight numeric(4,2) not null default 1.0,
  similarity_threshold numeric(5,4) not null default 0.8 description "相似度阈值",
  value_constraints jsonb not null default '{}',
  is_default boolean not null default false description "是否默认",
  is_active boolean not null default true description "是否激活",
  created_at timestamptz not null default now() description "创建时间",
  updated_at timestamptz not null default now() description "更新时间"
);

create unique index if not exists entity_types_scope_unique_idx
  on entity_types (scope, coalesce(source_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(document_id, '00000000-0000-0000-0000-000000000000'::uuid), type);
create index if not exists entity_types_default_active_idx on entity_types (is_default, is_active);

-- 实体表
create table if not exists entities (
  id uuid primary key description "实体UUID",
  source_id uuid not null references sources(id) on delete cascade description "项目UUID",
  entity_type_id uuid not null references entity_types(id) description "实体类型UUID",
  type text not null description "实体类型",
  name text not null description "实体名称",
  normalized_name text not null description "标准化名称",
  description text description "实体描述",
  value_type text description "值类型",
  value_raw text description "原始值",
  int_value bigint description "整数值",
  numeric_value numeric(24,6) description "数值",
  datetime_value timestamptz description "日期时间值",
  bool_value boolean description "布尔值",
  enum_value text description "枚举值",
  value_unit text description "值单位",
  value_confidence numeric(5,4) description "值置信度",
  embedding vector(1024) description "向量",
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now() description "创建时间",
  updated_at timestamptz not null default now() description "更新时间"
);

create unique index if not exists entities_source_type_name_unique_idx on entities (source_id, type, normalized_name);
create index if not exists entities_source_type_idx on entities (source_id, type);
create index if not exists entities_embedding_hnsw on entities using hnsw (embedding vector_cosine_ops);

-- 事件表
create table if not exists events (
  id uuid primary key description "事件UUID",
  source_id uuid not null references sources(id) on delete cascade description "项目UUID",
  document_id uuid references documents(id) on delete cascade description "文档UUID",
  chunk_id uuid references source_chunks(id) on delete set null description "文档块UUID",
  source_type text not null description "来源类型",
  external_source_id text description "外部来源ID",
  parent_id uuid references events(id) on delete cascade description "父事件UUID",
  level integer not null default 0 description "层级",
  rank integer not null default 0 description "排序索引",
  title text not null description "事件标题",
  summary text not null default '' description "事件摘要",
  content text not null description "事件内容",
  category text,
  keywords text[] not null default '{}' description "关键词",
  priority text description "优先级",
  status text description "状态",
  start_time timestamptz description "开始时间",
  end_time timestamptz description "结束时间",
  "references" uuid[] not null default '{}' description "引用",
  metadata jsonb not null default '{}' description "元数据",
  title_embedding vector(1024) description "标题向量",
  content_embedding vector(1024) description "内容向量",
  search_text tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
  ) stored description "搜索文本",
  deleted_at timestamptz description "删除时间",
  created_at timestamptz not null default now() description "创建时间",
  updated_at timestamptz not null default now() description "更新时间"
);

create index if not exists events_source_deleted_idx on events (source_id, deleted_at);
create index if not exists events_source_chunk_idx on events (source_id, chunk_id);
create index if not exists events_document_rank_idx on events (document_id, rank);
create index if not exists events_search_text_idx on events using gin (search_text);
create index if not exists events_title_embedding_hnsw on events using hnsw (title_embedding vector_cosine_ops);
create index if not exists events_content_embedding_hnsw on events using hnsw (content_embedding vector_cosine_ops);

-- 事件实体表(多对多关联)
create table if not exists event_entities (
  id uuid primary key description "事件实体UUID",
  event_id uuid not null references events(id) on delete cascade description "事件UUID",
  entity_id uuid not null references entities(id) on delete cascade description "实体UUID",
  weight numeric(4,2) not null default 1.0 description "权重",
  description text description "实体描述",
  embedding vector(1024) description "向量",
  metadata jsonb not null default '{}' description "元数据",
  created_at timestamptz not null default now() description "创建时间"
);

create unique index if not exists event_entities_event_entity_unique_idx on event_entities (event_id, entity_id);
create index if not exists event_entities_entity_event_idx on event_entities (entity_id, event_id);
create index if not exists event_entities_event_entity_idx on event_entities (event_id, entity_id);
create index if not exists event_entities_embedding_hnsw on event_entities using hnsw (embedding vector_cosine_ops);

