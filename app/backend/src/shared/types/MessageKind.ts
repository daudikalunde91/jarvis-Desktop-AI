/** The five message kinds the Communication Bus is required to route. */
export const MESSAGE_KINDS = ['command', 'event', 'response', 'notification', 'error'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];
