import "dotenv/config";
import { z } from "zod"; // 运行时的数据格式校验库，校验外部输出的数据是否符合预期

export const SUPPORTED_EMBEDDING_DIMENSIONS = 1024; // 向量维度
//export const DEFAULT_302AI_BASE_URL = "https://api.302ai.cn/v1";
export const DEFAULT_302AI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";   //阿里云api地址

const envSchema = z.object({ // 定义环境变量对象的结构和类型
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HTTP_HOST: z.string().default("0.0.0.0"),
  HTTP_PORT: z.coerce.number().int().positive().default(4173),

  DATABASE_URL: z.string().min(1).default("postgres://sag_lite:sag_lite_pass@localhost:5432/sag_lite"),
  DEFAULT_TENANT_ID: z.string().min(1).default("default"),  // 默认租户id
  AUTH_MODE: z.enum(["none", "bearer", "external"]).default("none"),

  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(SUPPORTED_EMBEDDING_DIMENSIONS)
    .refine((value) => value === SUPPORTED_EMBEDDING_DIMENSIONS, `EMBEDDING_DIMENSIONS must be ${SUPPORTED_EMBEDDING_DIMENSIONS} because pgvector columns are vector(${SUPPORTED_EMBEDDING_DIMENSIONS})`),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-large"),
  EMBEDDING_API_KEY: z.string().default(""),
  EMBEDDING_BASE_URL: z.string().url().default(DEFAULT_302AI_BASE_URL),

  LLM_MODEL: z.string().min(1).default("qwen3.6-flash"),
  LLM_API_KEY: z.string().default(""),
  LLM_BASE_URL: z.string().url().default(DEFAULT_302AI_BASE_URL),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),

  RERANK_BASE_URL: z.string().url().optional(),
  RERANK_MODEL: z.string().min(1).default("qwen3-rerank"),
  RERANK_INSTRUCT: z.string().min(1).default("Given a user question, rank SAG event candidates by relevance and usefulness for retrieval-augmented question answering."),
  DEFAULT_SEARCH_MODE: z.enum(["standard", "fast"]).default("fast"),
  INGEST_CONCURRENCY: z.coerce.number().int().positive().max(20).default(5), // 入库并发数

  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  MCP_HTTP_PORT: z.coerce.number().int().positive().default(4174),
  MCP_TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000)
});

export type AppConfig = z.infer<typeof envSchema>;  // 从上面的 envSchema 自动推断出 TypeScript 类型，等价于自己写type config

export const config: AppConfig = envSchema.parse(process.env);  // 解析环境变量，并返回 AppConfig 类型

export const hasRemoteEmbedding = config.EMBEDDING_API_KEY.trim().length > 0;  // 判断是否配置了Embedding API Key
export const hasRemoteLlm = config.LLM_API_KEY.trim().length > 0;  // 判断是否配置了LLM API Key
