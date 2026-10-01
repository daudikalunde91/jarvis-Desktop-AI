# JARVIS V7.1 Architecture Upgrade Report

## Scope

This upgrade is intentionally additive. The working Electron/Vite/SQLite startup path remains the foundation. The goal was to move JARVIS from a conversational fallback assistant toward a tool-using desktop agent.

## High priority — implemented

### 1. Real AI tool loop

`AIOrchestrator` now passes tool definitions to configured providers and can run a bounded multi-round loop:

`model -> tool call -> local agent -> tool result -> model -> final answer`

The loop is capped at eight rounds to prevent runaway execution.

Providers now preserve tool-call messages for OpenAI, Gemini, and Claude request formats.

### 2. Richer reasoning behavior

The Brain system prompt no longer forces one- or two-sentence answers. It now instructs JARVIS to provide detail proportional to the task, especially for troubleshooting, while avoiding claims that an action succeeded unless a tool reports success.

### 3. Computer awareness

`SystemAgent` now collects additional live Windows telemetry:

- CPU load
- RAM pressure
- disk capacity/free space
- top CPU processes
- battery status when Windows exposes it
- Windows thermal-zone readings when the OS exposes them

A `system.diagnose` capability turns these observations into findings and recommendations. Hardware temperature is explicitly reported as unavailable when Windows does not expose a reliable sensor.

### 4. Dynamic application discovery

`app.discover` uses the Windows Start-app catalog instead of relying only on the fixed application alias list. `app.open` attempts discovered applications first and falls back to the known-safe aliases.

### 5. File-management tool surface

The AI tool catalog now includes read/list/search/create/create-folder/rename/move/copy/open file capabilities. Existing path guards remain in place.

### 6. Risk-aware confirmation for AI tools

A model may request a tool, but the model cannot bypass JARVIS permissions. Medium/high/sensitive tools return a confirmation requirement. JARVIS stores the pending tool call and can execute it after an explicit `yes`/`ndiyo` confirmation.

### 7. Windows Office automation foundation

A new `OfficeAgent` can create `.docx` and `.pptx` files through installed Microsoft Word/PowerPoint COM automation on Windows. Output is restricted to the user's home directory and the actions are confirmation-gated.

### 8. Screenshot capture foundation

A new `VisionAgent` can capture the primary Windows display to a PNG file under the user's home directory. Capture is confirmation-gated.

## Medium priority — partially implemented

### Provider failover

The provider router/fallback system was preserved and the tool loop uses it. In the supplied runtime log, only OpenAI was actually configured; Gemini and Claude were registered but showed `configured: false`. Therefore a real cross-provider recovery cannot be verified until additional provider keys are configured.

### Vision understanding

Screenshot capture is implemented, but the captured image is not yet injected as multimodal model input. The next step is an image-content contract shared by the OpenAI/Gemini/Claude adapters.

### Application control

Discovery and launch are implemented. Deep UI interaction inside arbitrary third-party applications is not yet implemented; that requires a dedicated Windows UI Automation layer.

## Low priority / next stage

### Real standby voice

The existing audio/wake-word/STT/TTS architecture remains wired, but it is still an architecture/framework rather than a complete always-listening provider implementation. A real microphone provider, wake-word engine, speech recognizer, speech synthesizer, interruption handling, and privacy controls are still required.

### Persistent app inventory and richer hardware sensors

The current discovery is on-demand. A future awareness service can cache application inventory, watch installs, and expose richer CPU/GPU temperatures where supported.

## Important fixes included

- Fixed the frontend `timer` scope/typecheck bug in `app/frontend/src/App.tsx`.
- Removed misleading placeholder text from public module README files.
- Increased default Claude max output from 1024 to 4096 tokens to better support long-form troubleshooting and generated content.
- Updated `.env.example` and Git ignore expectations for secret handling.

## Validation performed in this build environment

All modified TypeScript/TSX source files were syntax-transpiled with the TypeScript compiler API successfully.

A full dependency-backed `tsc`/Vite/Electron build could not be completed in the inspection environment because dependencies were not present and this environment could not fetch the npm registry packages. Therefore Windows runtime claims are based on source inspection and architecture, not a fresh Windows runtime execution of this ZIP.

## Known limitations

1. A `package-lock.json` could not be generated in the inspection environment because npm registry access/cache was unavailable. The project remains npm-only.
2. OpenAI 429/rate-limit behavior still depends on the actual account/model quota. This build cannot manufacture another provider key.
3. Voice remains framework-only rather than a tested always-listening implementation.
4. Vision capture is implemented; multimodal image reasoning remains pending.
5. Office COM automation requires the corresponding Microsoft Office desktop application to be installed on Windows.
