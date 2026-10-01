# JARVIS OS — Test Matrix

## Tests that should work now after installation

| Test | Expected |
|---|---|
| App starts | Electron window opens and IPC reports connected |
| `habari yako` | Offline Swahili greeting |
| `hello` | Offline English greeting |
| `system info` | CPU/RAM/OS information |
| `time` | Current system time |
| `fungua vscode` | Launches VS Code if `code` is installed |
| `fungua chrome` | Launches Chrome if installed |
| `tafuta faili ...` | Searches allowed home folders |
| `orodhesha documents` | Lists files under Documents |
| `open github` | Opens GitHub in browser |
| `search web ...` | Opens Google search |
| `kumbuka kwamba ...` | Writes SQLite memory |
| `unakumbuka ...` | Reads matching SQLite memory |
| `inspect project` | Inspects the configured JARVIS workspace |
| `lock computer` | Requires confirmation, then locks on Windows |
| `shutdown computer` | Requires confirmation, then schedules Windows shutdown |
| Brain pipeline | Rules -> Planner -> Permission -> Agent -> Result |

## Tests that should be simulated/unit-tested only for now

- Real microphone capture.
- Real STT.
- Real wake-word detection.
- Real TTS.
- Camera/vision.
- Full browser DOM automation.
- Autonomous coding across a repository.

## Tests that require Windows

- `cmd.exe` application launching.
- `taskkill.exe` application closing.
- `rundll32.exe` lock/sleep.
- `shutdown.exe` restart/shutdown.
- Real microphone/audio devices.
- Windows installer packaging.

## Tests that require provider credentials or external services

- OpenAI-compatible cloud reasoning.
- Hosted STT/TTS providers.
- Hosted wake-word/voice services if selected.

## Safety tests

1. Unknown action must be denied by default.
2. Sensitive/high-risk action without confirmation must not execute.
3. Non-admin role must not execute admin-only actions.
4. File traversal outside allowed roots must fail.
5. Coding file access outside workspace must fail.
6. Unknown application names must not be passed to a shell executable.
7. Disabled memory must not read or mutate stored memory.
8. Renderer must never receive direct Node/Electron access.
