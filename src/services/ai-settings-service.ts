import { config, SUPPORTED_EMBEDDING_DIMENSIONS } from "../config/env.js";
import {
  getAiProviderSettings,
  upsertAiProviderSettings
} from "../db/repositories.js";
import type { AiProviderSettingsRecord, ChunkingMode, PublicAiProviderSettings, SearchMode } from "../types.js";

export const DEFAULT_SEARCH_TOP_K = 10; // 默认搜索结果数量
export const MAX_SEARCH_TOP_K = 50; // 最大搜索结果数量
export const DEFAULT_CHUNKING_MODE: ChunkingMode = "heading_strict";
export const DEFAULT_CHUNK_TOKEN_LIMIT = 512; // 默认分块Token数量
export const DEFAULT_CHUNK_OVERLAP_TOKENS = 100; // 默认分块重叠Token数量

export interface AiRuntimeSettings {
  embeddingBaseUrl: string;
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingApiKey: string;
  hasRemoteEmbedding: boolean;
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  hasRemoteLlm: boolean;
  llmTimeoutMs: number;
  llmMaxRetries: number;
  defaultSearchMode: SearchMode;
  defaultSearchTopK: number;
  defaultChunkingMode: ChunkingMode;
  chunkTokenLimit: number;
  chunkOverlapTokens: number;
}

export interface UpdateAiSettingsInput {
  embeddingBaseUrl: string; // 嵌入层API地址
  embeddingModel: string; // 嵌入层模型
  embeddingDimensions: number; // 嵌入层维度
  embeddingApiKey?: string; // 嵌入层API Key
  clearEmbeddingApiKey?: boolean; // 清除嵌入层API Key
  llmBaseUrl: string; // LLM API地址
  llmModel: string; // LLM模型
  llmApiKey?: string; // LLM API Key
  clearLlmApiKey?: boolean; // 清除LLM API Key
  llmTimeoutMs: number; // LLM超时时间
  llmMaxRetries: number; // LLM最大重试次数
  defaultSearchMode: SearchMode; // 默认搜索模式
  defaultSearchTopK: number; // 默认搜索结果数量    
  defaultChunkingMode: ChunkingMode; // 默认分块模式
  chunkTokenLimit: number; // 分块Token限制
  chunkOverlapTokens: number; // 分块重叠Token限制
}

export class AiSettingsService {
  async getPublicSettings(): Promise<PublicAiProviderSettings> {
    // 1. 查询数据库，获取数据库中第一条的AI提供者设置 AiProviderSettingsRecord
    // 2. 转换为公共AI提供者设置 PublicAiProviderSettings
    return toPublicSettings(await this.getSettingsOrFallback());  // 转换为公共AI提供者设置
  }

  async getRuntimeSettings(): Promise<AiRuntimeSettings> {
    // 1. 查询数据库，获取数据库中第一条的AI提供者设置 AiProviderSettingsRecord
    const settings = await this.getSettingsOrFallback();
    // 2. 获取嵌入层API Key
    const embeddingApiKey = settings.embeddingApiKey?.trim() ?? "";
    // 3. 获取LLM API Key
    const llmApiKey = settings.llmApiKey?.trim() ?? "";
    // 4. 获取分块Token限制
    const chunkTokenLimit = readBoundedInteger(settings.metadata.chunkTokenLimit, DEFAULT_CHUNK_TOKEN_LIMIT, 64, 8192);
    // 5. 返回AI运行时设置 AiRuntimeSettings
    return {
      embeddingBaseUrl: settings.embeddingBaseUrl,
      embeddingModel: settings.embeddingModel,
      embeddingDimensions: settings.embeddingDimensions,
      embeddingApiKey,
      hasRemoteEmbedding: embeddingApiKey.length > 0,
      llmBaseUrl: settings.llmBaseUrl,
      llmModel: settings.llmModel,
      llmApiKey,
      hasRemoteLlm: llmApiKey.length > 0,
      llmTimeoutMs: settings.llmTimeoutMs,
      llmMaxRetries: settings.llmMaxRetries,
      defaultSearchMode: readDefaultSearchMode(settings.metadata),
      defaultSearchTopK: readBoundedInteger(settings.metadata.defaultSearchTopK, DEFAULT_SEARCH_TOP_K, 1, MAX_SEARCH_TOP_K),
      defaultChunkingMode: readDefaultChunkingMode(settings.metadata),
      chunkTokenLimit,
      chunkOverlapTokens: readBoundedInteger(settings.metadata.chunkOverlapTokens, DEFAULT_CHUNK_OVERLAP_TOKENS, 0, chunkTokenLimit - 1)
    };
  }

  async updateSettings(input: UpdateAiSettingsInput): Promise<PublicAiProviderSettings> {
    // 1. 检查嵌入层维度是否支持,嵌入层尺寸必须是1024
    if (input.embeddingDimensions !== SUPPORTED_EMBEDDING_DIMENSIONS) {
      throw new Error(`embeddingDimensions must be ${SUPPORTED_EMBEDDING_DIMENSIONS}`);
    }
    // 2. 获取分块Token限制
    const chunkTokenLimit = clampInteger(input.chunkTokenLimit, DEFAULT_CHUNK_TOKEN_LIMIT, 64, 8192);
    // 3. 获取分块重叠Token限制
    const chunkOverlapTokens = clampInteger(input.chunkOverlapTokens, DEFAULT_CHUNK_OVERLAP_TOKENS, 0, chunkTokenLimit - 1);
    // 4. 获取当前AI提供者设置（数据库查询） AiProviderSettingsRecord
    const current = await this.getSettingsOrFallback();
    // 5. 获取嵌入层API Key
    const embeddingApiKey = input.clearEmbeddingApiKey ? null : normalizeOptionalSecret(input.embeddingApiKey);
    // 6. 获取LLM API Key
    const llmApiKey = input.clearLlmApiKey ? null : normalizeOptionalSecret(input.llmApiKey);
    // 7. 更新AI提供者设置
    const updated = await upsertAiProviderSettings({
      embeddingBaseUrl: input.embeddingBaseUrl.trim(),
      embeddingModel: input.embeddingModel.trim(),
      embeddingDimensions: input.embeddingDimensions,
      embeddingApiKey,
      preserveEmbeddingApiKey: !input.clearEmbeddingApiKey && embeddingApiKey == null,
      llmBaseUrl: input.llmBaseUrl.trim(),
      llmModel: input.llmModel.trim(),
      llmApiKey,
      preserveLlmApiKey: !input.clearLlmApiKey && llmApiKey == null,
      llmTimeoutMs: input.llmTimeoutMs,
      llmMaxRetries: input.llmMaxRetries,
      metadata: {
        updatedVia: "webui",
        previousUpdatedAt: current.updatedAt,
        defaultSearchMode: input.defaultSearchMode,
        defaultSearchTopK: clampInteger(input.defaultSearchTopK, DEFAULT_SEARCH_TOP_K, 1, MAX_SEARCH_TOP_K),
        defaultChunkingMode: input.defaultChunkingMode,
        chunkTokenLimit,
        chunkOverlapTokens
      }
    });
    return toPublicSettings(updated);
  }

  // 获取AI提供者设置，如果获取失败，则返回默认设置
  // AiProviderSettingsRecord 数据库中存储的AI提供者设置
  // PublicAiProviderSettings 公共AI提供者设置，不把apikey在网络中传输
  private async getSettingsOrFallback(): Promise<AiProviderSettingsRecord> {
    if (config.NODE_ENV === "test") {
      return envSettings();  // 如果当前环境是测试环境，则返回默认设置
    }
    try {
      const settings = await getAiProviderSettings();  // 获取AI提供者设置
      if (settings) {
        return settings;
      }
    } catch {
      // Tests and fresh installs can run before migrations. Runtime callers still
      // need a deterministic fallback so local operation stays bootstrappable.
    }
    return envSettings();
  }
}

function envSettings(): AiProviderSettingsRecord {  // 默认设置
  const now = new Date().toISOString();
  return {
    id: "global",
    embeddingBaseUrl: config.EMBEDDING_BASE_URL,
    embeddingModel: config.EMBEDDING_MODEL,
    embeddingDimensions: SUPPORTED_EMBEDDING_DIMENSIONS,
    embeddingApiKey: config.EMBEDDING_API_KEY || null,
    llmBaseUrl: config.LLM_BASE_URL,
    llmModel: config.LLM_MODEL,
    llmApiKey: config.LLM_API_KEY || null,
    llmTimeoutMs: config.LLM_TIMEOUT_MS,
    llmMaxRetries: config.LLM_MAX_RETRIES,
    metadata: {
      defaultSearchMode: config.DEFAULT_SEARCH_MODE,
      defaultSearchTopK: DEFAULT_SEARCH_TOP_K,
      defaultChunkingMode: DEFAULT_CHUNKING_MODE,
      chunkTokenLimit: DEFAULT_CHUNK_TOKEN_LIMIT,
      chunkOverlapTokens: DEFAULT_CHUNK_OVERLAP_TOKENS
    },
    createdAt: now,
    updatedAt: now
  };
}

function toPublicSettings(settings: AiProviderSettingsRecord): PublicAiProviderSettings { // 转换为公共AI提供者设置
  const chunkTokenLimit = readBoundedInteger(settings.metadata.chunkTokenLimit, DEFAULT_CHUNK_TOKEN_LIMIT, 64, 8192);
  return {
    id: "global",
    embeddingBaseUrl: settings.embeddingBaseUrl,
    embeddingModel: settings.embeddingModel,
    embeddingDimensions: settings.embeddingDimensions,
    hasEmbeddingApiKey: (settings.embeddingApiKey?.trim() ?? "").length > 0,
    llmBaseUrl: settings.llmBaseUrl,
    llmModel: settings.llmModel,
    hasLlmApiKey: (settings.llmApiKey?.trim() ?? "").length > 0,
    llmTimeoutMs: settings.llmTimeoutMs,
    llmMaxRetries: settings.llmMaxRetries,
    defaultSearchMode: readDefaultSearchMode(settings.metadata),
    defaultSearchTopK: readBoundedInteger(settings.metadata.defaultSearchTopK, DEFAULT_SEARCH_TOP_K, 1, MAX_SEARCH_TOP_K),
    defaultChunkingMode: readDefaultChunkingMode(settings.metadata),
    chunkTokenLimit,
    chunkOverlapTokens: readBoundedInteger(settings.metadata.chunkOverlapTokens, DEFAULT_CHUNK_OVERLAP_TOKENS, 0, chunkTokenLimit - 1),
    updatedAt: settings.updatedAt
  };
}

function readDefaultSearchMode(metadata: Record<string, unknown>): SearchMode {
  return metadata.defaultSearchMode === "standard" ? "standard" : "fast";
}

function readDefaultChunkingMode(metadata: Record<string, unknown>): ChunkingMode {
  return metadata.defaultChunkingMode === "token" ? "token" : DEFAULT_CHUNKING_MODE;
}

function readBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  return clampInteger(value, fallback, min, max);
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(Math.trunc(numberValue), max));
}

function normalizeOptionalSecret(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export const aiSettingsService = new AiSettingsService(); // 创建AI设置服务实例
