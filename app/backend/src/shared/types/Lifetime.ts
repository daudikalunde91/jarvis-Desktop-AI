/** DI Container registration lifetimes. */
export const LIFETIMES = ['singleton', 'transient', 'scoped'] as const;
export type Lifetime = (typeof LIFETIMES)[number];
