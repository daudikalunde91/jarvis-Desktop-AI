import type {
  CreateWakeWordProfileInput,
  IWakeWordProviderFactory,
} from '@backend/wake-word/interfaces/IWakeWordProviderFactory';
import { WakeWordProfile } from '@backend/wake-word/models/WakeWordProfile';

/** Centralizes construction of WakeWordProfile instances. */
export class WakeWordProviderFactory implements IWakeWordProviderFactory {
  createProfile(input: CreateWakeWordProfileInput): WakeWordProfile {
    return new WakeWordProfile(input);
  }
}
