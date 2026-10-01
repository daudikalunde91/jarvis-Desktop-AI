/**
 * Builds the "Action / Target / Content" preview shown before a confirmed
 * integration action runs. Returns null for actions that are not integration writes.
 */
const clip = (v: unknown, n = 300): string => {
  const s = typeof v === 'string' ? v : '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

export function describeIntegrationAction(action: string, args: Record<string, unknown> = {}): string | null {
  switch (action) {
    case 'gmail.send':
      return `Action: Send email\nTarget: ${clip(args.to, 120)}\nContent: Subject "${clip(args.subject, 120)}" — ${clip(args.body)}`;
    case 'calendar.create_event':
      return `Action: Create calendar event\nTarget: ${clip(args.summary, 120)}\nContent: ${clip(args.start, 40)} to ${clip(args.end, 40)}${args.location ? ` at ${clip(args.location, 80)}` : ''}`;
    case 'calendar.update_event':
      return `Action: Update calendar event\nTarget: ${clip(args.eventId, 80)}\nContent: ${Object.keys(args).filter((k) => k !== 'eventId').join(', ') || 'no changes'}`;
    case 'calendar.delete_event':
      return `Action: DELETE calendar event\nTarget: ${clip(args.eventId, 80)}\nContent: The event will be removed from your calendar.`;
    default:
      return null;
  }
}
