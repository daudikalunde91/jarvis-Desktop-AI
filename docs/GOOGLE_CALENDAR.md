# Google Calendar — IMPLEMENTED (mocked-API tested; not yet verified live)

| Permission | Google scope | Operations | Confirmation |
|---|---|---|---|
| `calendar.read` | `calendar.events.readonly` | `calendar.list_events`, `calendar.search_events` | none |
| `calendar.create` | `calendar.events` | `calendar.create_event` | **yes** (medium) |
| `calendar.update` | `calendar.events` | `calendar.update_event` | **yes** (medium) |
| `calendar.delete` | `calendar.events` | `calendar.delete_event` | **yes** (high) |

Google offers only read-only vs read/write event scopes, so create/update/delete share one Google scope; JARVIS
enforces the finer split locally (a grant of `calendar.create` alone cannot delete — covered by tests).
Operates on the **primary** calendar only. List/search default to the next 7 days, max 25 results.
Times must be ISO 8601; end must be after start. Not implemented: recurring-event editing, attendees/invites,
other calendars, reminders. Setup is the same as `GMAIL.md` (`CALENDAR_ENABLED=true`).
