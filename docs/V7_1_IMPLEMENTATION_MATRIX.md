# V7.1 Capability Matrix

| Capability | Status | Notes |
|---|---|---|
| Native Electron desktop | ✅ Existing/preserved | Startup architecture preserved |
| OpenAI provider | ✅ | Real request path; actual quota depends on account |
| Gemini provider | ✅ Adapter + tool schema | Needs API key for runtime use |
| Claude provider | ✅ Adapter + tool schema | Needs API key for runtime use |
| Provider failover | ✅ Architecture | Needs 2+ configured providers for live failover |
| Detailed AI responses | ✅ | Brain prompt no longer enforces short replies |
| AI tool calling | ✅ | Bounded multi-round loop |
| Tool confirmation | ✅ | `yes` / `ndiyo` continuation |
| CPU/RAM/disk/system awareness | ✅ | Windows + Node telemetry |
| PC troubleshooting | ✅ Foundation | Live findings + recommendations; sensor availability varies |
| Installed app discovery | ✅ | Windows Start-app catalog |
| Open discovered app | ✅ | Discovery-first launch |
| File search/read/list | ✅ | Guarded roots |
| File create/move/copy/rename | ✅ | Confirmation-gated when initiated by AI tools |
| Word document creation | ✅ Windows foundation | Requires Microsoft Word desktop |
| PowerPoint creation | ✅ Windows foundation | Requires Microsoft PowerPoint desktop |
| Screenshot capture | ✅ | Primary display PNG capture |
| Screenshot -> AI vision analysis | ⏳ | Needs multimodal content transport |
| Real microphone standby | ⏳ | Existing framework only |
| Wake word detection | ⏳ | Provider not enabled |
| Speech-to-text | ⏳ | Provider not enabled |
| Text-to-speech | ⏳ | Provider not enabled |
| Arbitrary app UI control | ⏳ | Needs Windows UI Automation |
| Persistent installed-app watcher | ⏳ | Discovery currently on demand |
| Full release build verification | ⏳ | Must be executed on target Windows machine |
