import { InjectionToken } from '@backend/shared/types/Token';
import type { ProviderRegistry } from '@backend/ai/ProviderRegistry';
import type { ProviderHealthManager } from '@backend/ai/ProviderHealthManager';
import type { ProviderRouter } from '@backend/ai/ProviderRouter';
import type { FallbackManager } from '@backend/ai/FallbackManager';
import type { UsageTracker } from '@backend/ai/UsageTracker';
import type { AIOrchestrator } from '@backend/ai/AIOrchestrator';
import type { ToolRegistry } from '@backend/ai/tools/ToolRegistry';

export const AI_TOKENS = {
  ProviderRegistry: new InjectionToken<ProviderRegistry>('AIProviderRegistry'),
  ProviderHealthManager: new InjectionToken<ProviderHealthManager>('AIProviderHealthManager'),
  ProviderRouter: new InjectionToken<ProviderRouter>('AIProviderRouter'),
  FallbackManager: new InjectionToken<FallbackManager>('AIFallbackManager'),
  UsageTracker: new InjectionToken<UsageTracker>('AIUsageTracker'),
  ToolRegistry: new InjectionToken<ToolRegistry>('AIToolRegistry'),
  Orchestrator: new InjectionToken<AIOrchestrator>('AIOrchestrator'),
} as const;
