# JARVIS V7.2 RC2 Release Notes

## Purpose

This release is a stabilization pass over the V7.2 Production Foundation ZIP. It preserves the Electron/npm architecture while hardening Windows application discovery and aligning the Gemini default with Google's current stable Flash model catalog.

## Changes

- Hardened Windows Start Menu application discovery against malformed or incomplete `Name` / `AppID` records.
- Added centralized safe application-name normalization before comparisons and aliases.
- Prevented `undefined.toLowerCase()` crashes in application discovery/open/close paths.
- Updated the default Gemini model to `gemini-3.8-flash` and kept model discovery enabled.
- Updated Gemini fallback ordering to prefer the current stable Flash model.
- Bumped project package version to `0.2.2`.
- Preserved the existing multi-provider architecture: Gemini, Groq, Lovable, OpenRouter, Claude, OpenAI and Local provider boundary.
- Preserved the no-microphone-button UI requirement.

## Important limitations

The uploaded build does not contain provider credentials, so live Groq/Lovable/OpenRouter/Claude/OpenAI checks cannot be truthfully marked as passed inside this ZIP. Configure them in `.env` and run `npm run doctor:ai` locally.

The voice runtime remains an architecture/foundation layer. It exposes the runtime lifecycle and optional wake-word/speech/voice interfaces, but the ZIP does not claim a fully operational native wake-word engine unless a concrete provider is connected.

The Local provider remains intentionally unconfigured until a local model runtime is selected.

## Validation

The archive was rebuilt from the uploaded source tree and ZIP integrity was checked after packaging. Full dependency installation could not be completed in the packaging environment within the available execution window, so `npm run build` and `npm run dev` are not represented as passed here. Run them on the Windows target machine after `npm install`.
