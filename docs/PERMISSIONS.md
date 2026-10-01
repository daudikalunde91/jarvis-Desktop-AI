# Permissions

Two independent gates must both pass:

1. **Action policy** (`security/ActionPolicy.ts` via `PermissionManager`): risk level + confirmation.
2. **Capability grant** (`IntegrationManager`): what *you* granted when connecting.

| Action | Risk | Confirmation | Capability |
|---|---|---|---|
| `gmail.search`, `gmail.read` | low | no | `gmail.read` |
| `gmail.send` | sensitive | **always** | `gmail.send` |
| `calendar.list_events`, `calendar.search_events` | low | no | `calendar.read` |
| `calendar.create_event`, `calendar.update_event` | medium | **yes** | `calendar.create` / `calendar.update` |
| `calendar.delete_event` | high | **yes** | `calendar.delete` |

Confirmation shows `Action / Target / Content` before anything runs. Unclassified actions stay deny-by-default (sensitive/admin).
Grants are never implicit: connecting Gmail read-only grants nothing else. Reserved capability names for later:
`drive.read/write`, `whatsapp.send`, `outlook.read/send`, `onedrive.read/write`.

**Confirmation flow (existing mechanism, reused):** `ToolRegistry` returns `awaiting-confirmation` with the
`Action / Target / Content` preview → `AIOrchestrator` raises `ToolConfirmationRequiredError` → `BrainManager` shows the preview and
asks "yes / no" (English or Swahili) → on "yes" `executeConfirmedTool` runs the *same stored tool call*, so what you saw is what runs.
Unit tests cover the registry half (held, no API call, runs only when confirmed). The full spoken/typed round-trip has **not** been run
in a live Electron session here — see `INTEGRATION_TEST_PLAN.md` step 6.
