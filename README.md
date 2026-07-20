<p align="center">
  <img src="docs/assets/logo.svg" alt="SAG" width="220" />
</p>

# SAG-multimodal

基于 [Zleap-AI/SAG](https://github.com/Zleap-AI/SAG)（MIT License）二次开发的文档检索工作台。当前 **v1.0.0** 提供文本 RAG 基线能力，团队将在此基础上扩展多模态检索。

> **论文**：[SAG: Graph Retrieval on Large-Scale Dynamic Data](https://arxiv.org/abs/2606.15971)
>
> **上游项目**：[Zleap-AI/SAG](https://github.com/Zleap-AI/SAG) · **论文复现**：[Zleap-AI/SAG-Benchmark](https://github.com/Zleap-AI/SAG-Benchmark)

上传 Markdown / TXT 文档后，系统自动完成切片、向量化、事项提取、实体提取和关系整理。你可以像使用 ChatGPT 一样围绕项目资料连续提问，也可以查看切片、事项、实体、Embedding、搜索过程、原始模型日志和知识图谱。

![SAG 对话工作台](docs/assets/sag-chat.png)

## 版本规划

| 版本 | 状态 | 说明 |
|------|------|------|
| v1.0.0 | 已发布 | 文本 RAG 基线，fork 自上游 SAG |
| v2.x | 开发中 | 多模态文档解析与检索扩展 |

## SAG 是什么

SAG 是面向 Agent 的 RAG 技术路线，用轻量结构重组文档知识，而不是简单堆砌 chunk：

```text
chunk → event（事项，保留完整语义）
chunk → entities（实体，负责索引与关系扩展）
event ↔ entities（多跳召回）
```

![SAG 架构图](docs/assets/paper-sag-architecture.jpeg)

在 HotpotQA / 2WikiMultiHop / MuSiQue 基准上，SAG 对比 HippoRAG 2 的平均 Recall@2 从 68.14% 提升到 79.30%（+11.16 个百分点）。详见[论文](https://arxiv.org/abs/2606.15971)与[基准复现仓库](https://github.com/Zleap-AI/SAG-Benchmark)。

## 功能概览

- **项目管理**：每个项目拥有独立的文档、对话、图谱和 MCP 配置
- **多文档上传**：支持批量上传 Markdown / TXT，展示处理阶段和进度
- **文档处理结果**：查看切片、事项、实体、Embedding，支持标题搜索和分页
- **对话式检索**：多轮提问，流式输出，支持停止生成
- **引用原文**：回答中显示引用序号，点击可查看对应原文块
- **搜索过程可视化**：右侧面板实时展示 SAG 内部检索链路和耗时
- **原始日志**：可查看 LLM / Embedding / Rerank 原始请求和返回
- **知识图谱**：以实体和事项为节点浏览项目关系
- **MCP 接入**：每个项目可生成独立 MCP 配置，供外部 Agent 调用
- **文档归档**：支持项目/文档软归档，归档后不参与检索，可恢复

### 检索模式

- **极速模式**（默认）：query 直接在实体库做全文 / BM25 匹配，结合 SAG 多跳扩展，最后用 rerank 选 top-k，无需 LLM 抽实体
- **标准模式**：LLM 抽取 query 实体，再走 SAG 多路召回和 LLM 精排，精度更高

两种模式都基于 SAG 的 event/entity 索引和 SQL 多跳扩展，不是普通向量搜索。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React、Vite、Tailwind CSS |
| 后端 | Fastify、MCP TypeScript SDK |
| 数据库 | PostgreSQL、pgvector、全文检索 |
| 模型 | OpenAI-compatible LLM / Embedding / Rerank |

## 快速开始

### 环境要求

- Node.js ≥ 20
- npm
- PostgreSQL + pgvector（推荐 Docker 启动）

### 1. 克隆项目

```bash
git clone https://github.com/xfu4739-commits/SAG-multimodal.git
cd SAG-multimodal
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入 LLM 和 Embedding 的 API Key。未配置时系统使用本地 fallback，仅适合测试界面，无法获得真实检索效果。

### 3. 启动数据库

```bash
docker compose up -d
```

Docker 镜像已包含 pgvector，默认连接信息：

```env
DATABASE_URL=postgres://sag_lite:sag_lite_pass@localhost:5432/sag_lite
```

### 4. 安装依赖并初始化

```bash
npm install
npm run db:setup
```

### 5. 启动开发服务

```bash
npm run dev
```

| 服务 | 地址 |
|------|------|
| WebUI | http://localhost:5173 |
| API | http://localhost:4173 |

### 6. 生产部署（可选）

```bash
npm run build
npm start
```

生产模式访问 http://localhost:4173

## 第一次使用

1. 打开 WebUI，点击「新建项目」
2. 进入「文档」页，上传 `.md` 或 `.txt` 文件
3. 等待处理队列完成
4. 在「对话」页围绕项目资料提问
5. 调试时查看右侧「搜索过程」和「原始日志」
6. 在「图谱」页查看实体关系
7. 在「MCP」页复制配置，供外部 Agent 使用

## 模型配置

默认使用阿里云 DashScope 兼容接口（可在 `.env` 或 WebUI 全局设置中修改）：

```env
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1024
EMBEDDING_API_KEY=

LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen3.6-flash
LLM_API_KEY=

RERANK_MODEL=qwen3-rerank
DEFAULT_SEARCH_MODE=fast
```

配置方式：

- **WebUI**：点击左侧设置图标，填写模型和 API Key（界面只显示「已配置 / 未配置」，不回显密钥）
- **`.env`**：适合本地开发和 CI，**切勿将 `.env` 提交到 Git**

重排序默认基于 `LLM_BASE_URL` 追加 `/reranks`；若平台 endpoint 不同，可单独设置 `RERANK_BASE_URL`。

## MCP 接入

每个项目的 MCP 配置绑定当前项目 ID，工具调用时无需再传 `projectId`：

```json
{
  "mcpServers": {
    "sag": {
      "command": "npm",
      "args": ["run", "mcp"],
      "env": {
        "SAG_MCP_SOURCE_ID": "当前项目ID"
      }
    }
  }
}
```

可用工具：

| 工具 | 说明 |
|------|------|
| `sag_ingest_document` | 导入文档并执行切片、事项/实体抽取和向量化 |
| `sag_search` | 对当前项目执行 SAG 多路检索，返回内部 trace |
| `sag_explain_search` | 返回检索链路说明和 trace |
| `sag_get_event` | 按事件 ID 查询详情 |

## HTTP API 示例

```bash
# 健康检查
curl http://localhost:4173/health

# 创建项目
curl -X POST http://localhost:4173/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo 项目"}'

# 写入文档
curl -X POST http://localhost:4173/ingest \
  -H 'Content-Type: application/json' \
  -d '{"sourceId":"项目ID","title":"Demo","content":"# Demo\n\nSAG 可以检索项目文档。","extract":true}'

# 执行检索
curl -X POST http://localhost:4173/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"SAG 为什么适合多跳检索？","sourceIds":["项目ID"],"strategy":"multi","searchMode":"fast","topK":5,"returnTrace":true}'
```

## 常用命令

```bash
npm run dev          # 启动开发服务（API + WebUI）
npm run build        # 构建生产版本
npm start            # 启动生产服务
npm run db:migrate   # 执行数据库迁移
npm run db:setup     # 迁移 + 种子数据
npm run mcp          # 启动 MCP stdio server
npm run typecheck    # 类型检查
npm test             # 运行测试
```

## 项目结构

```text
src/
  ai/                 LLM、Embedding、Rerank 客户端
  api/                HTTP API
  config/             环境配置
  db/                 数据库连接、迁移、Repository
  ingestion/          文档切片和事项提取
  mcp/                MCP Server
  observability/      日志和模型调用记录
  services/           文档处理、搜索、图谱、WebUI 服务

web/src/              React WebUI
migrations/           PostgreSQL schema
test/                 单元测试
docs/assets/          文档配图
```

## 常见问题

**PostgreSQL 连接失败**

确认数据库已启动（`docker compose ps`），并检查 `.env` 中的 `DATABASE_URL`。

**pgvector 扩展不存在**

```sql
create extension if not exists vector;
```

使用 `docker compose up -d` 时镜像已包含 pgvector。

**没有真实模型效果**

未配置 `LLM_API_KEY` 和 `EMBEDDING_API_KEY` 时进入本地 fallback 模式，不适合评估检索质量。

**文档处理很慢**

处理速度取决于文档量、切片数和模型接口延迟，可通过 `INGEST_CONCURRENCY=5` 调整并发。

**端口被占用**

修改 `.env` 中的 `HTTP_PORT`；Vite 前端默认 5173，被占用时会自动切换。

## 开源协议

本项目基于上游 [Zleap-AI/SAG](https://github.com/Zleap-AI/SAG) 二次开发，遵循 [MIT License](LICENSE)。保留上游版权声明，二次开发部分同样以 MIT 协议发布。
