import { InjectionToken } from '@backend/shared/types/Token';
import type { RulesEngine } from '@backend/brain/RulesEngine';
import type { TaskPlanner } from '@backend/brain/TaskPlanner';
import type { ActionExecutor } from '@backend/brain/ActionExecutor';
import type { BrainManager } from '@backend/brain/BrainManager';
import type { ICloudReasoner } from '@backend/brain/CloudReasoner';

export const BRAIN_TOKENS = {
  RulesEngine: new InjectionToken<RulesEngine>('RulesEngine'),
  TaskPlanner: new InjectionToken<TaskPlanner>('TaskPlanner'),
  ActionExecutor: new InjectionToken<ActionExecutor>('ActionExecutor'),
  CloudReasoner: new InjectionToken<ICloudReasoner>('CloudReasoner'),
  BrainManager: new InjectionToken<BrainManager>('BrainManager'),
} as const;
