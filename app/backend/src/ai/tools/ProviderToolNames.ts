/**
 * Provider-safe tool names (V7.2.1).
 *
 * JARVIS's internal tool names are dotted (`system.get_info`,
 * `files.create_folder`). Anthropic, OpenAI and OpenAI-compatible APIs
 * (Groq, OpenRouter, Lovable) only accept `^[a-zA-Z0-9_-]{1,64}$` for
 * function names, so a dotted name makes the WHOLE request fail with
 * HTTP 400 (invalid request) — for every request that carries tools.
 *
 * Internal names stay unchanged so ToolRegistry, agents and existing
 * callers are untouched. Adapters translate at the wire boundary only:
 *   internal  ->  wire :  `system.get_info`  ->  `system_get_info`
 *   wire  ->  internal :  looked up from the tools sent on this request
 *
 * Decoding is a lookup against the request's own tool list, not a
 * blind `_` -> `.` replacement, because real names contain underscores
 * (`files.create_folder` must not become `files.create.folder`).
 */

const INVALID_CHARS = /[^a-zA-Z0-9_-]/g;
const MAX_LENGTH = 64;

/** Deterministic, stateless conversion of one name to a wire-safe name. */
export function toProviderSafeName(name: string): string {
  const cleaned = String(name ?? '').replace(INVALID_CHARS, '_').slice(0, MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : 'tool';
}

export class ProviderToolNameCodec {
  private readonly forward = new Map<string, string>();
  private readonly reverse = new Map<string, string>();

  constructor(tools?: ReadonlyArray<{ readonly name: string }>) {
    for (const tool of tools ?? []) {
      if (this.forward.has(tool.name)) continue;
      let wire = toProviderSafeName(tool.name);
      // Extremely unlikely collision (e.g. `a.b` and `a_b`): keep both
      // callable by suffixing, instead of silently dropping one.
      for (let n = 2; this.reverse.has(wire); n += 1) {
        const suffix = `_${n}`;
        wire = `${toProviderSafeName(tool.name).slice(0, MAX_LENGTH - suffix.length)}${suffix}`;
      }
      this.forward.set(tool.name, wire);
      this.reverse.set(wire, tool.name);
    }
  }

  /** Internal name -> wire name. Also used for tool calls in message history. */
  encode(name: string): string {
    return this.forward.get(name) ?? toProviderSafeName(name);
  }

  /** Wire name -> internal name. Unknown names pass through unchanged. */
  decode(name: string): string {
    return this.reverse.get(name) ?? name;
  }
}
