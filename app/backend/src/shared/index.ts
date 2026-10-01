/**
 * Shared Layer barrel. Every future module (agents, plugins,
 * communication, awareness, ...) should import from `@backend/shared/*`
 * rather than reaching into infrastructure internals directly.
 */
export * from '@backend/shared/types';
export * from '@backend/shared/interfaces';
export * from '@backend/shared/errors';
export * from '@backend/shared/constants';
export * from '@backend/shared/utilities';
export * from '@backend/shared/events';
export * from '@backend/shared/contracts';
export * from '@backend/shared/validation';
export * from '@backend/shared/base';
