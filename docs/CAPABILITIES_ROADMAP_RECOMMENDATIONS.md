# Mapping your capabilities wishlist to the current codebase

Uliniambia unataka JARVIS iwe na: AI Brain, personal-data access, Gmail,
WhatsApp, Telegram/Discord/Slack, Calendar, Contacts, computer control,
browser agent, files/knowledge-base, memory levels, voice assistant,
proactive assistant, developer mode, na security layer.

Habari njema: sehemu kubwa ya *msingi wa architecture* tayari upo. Hii ni
ukaguzi wa kile kilichopo dhidi ya kile kinachohitajika, kwa kila sehemu,
ili recommendations ziwe based on ukweli wa code — si nadhani.

## Tayari ipo (real code, si placeholder)

| Eneo lako | Ipo wapi kwenye code | Hali |
|---|---|---|
| AI Brain, multi-provider, failover | `app/backend/src/ai/*` (OpenAI/Gemini/Claude/Local + `FallbackManager`, `ProviderRouter`, `ProviderHealthManager`) | Kazi, sasa na diagnostics bora (angalia `M5_1_V7_1_2_AI_DEBUG_FIX.md`) |
| Tool/function calling | `ai/tools/ToolRegistry.ts` + `ai/tools/ToolDefinitions.ts` | Kazi — AI inaomba tool, `ToolRegistry` ndiyo lango pekee kwenda kwa agents |
| Security layer (roles, confirm-before-execute) | `security/PermissionManager.ts`, `security/ActionPolicy.ts` | Msingi upo: `minRole` + `requiresConfirmation` kwa kila tool tayari inatumika |
| Memory (short-term) | `memory/MemoryManager.ts`, `memory/SqliteMemoryRepository.ts` | Kazi kwa conversation history; bado hakuna long-term/episodic/knowledge tiers |
| Computer control (files, apps, system info) | `agents/system`, `agents/files` | Kazi: open/close app, file ops, system diagnose |
| Browser agent | `agents/browser/BrowserAgent.ts` | Msingi upo (open/search); hakuna form-fill/extract bado |
| Office automation | `agents/office/OfficeAgent.ts` | Kazi: create Word/PPT |
| Vision | `agents/vision` | Action moja tu: screen capture — hakuna OCR bado |
| Voice runtime architecture | `voice-provider`, `speech-to-text`, `wake-word`, `voice-runtime`, `audio` | Architecture kamili ipo (imeandikwa milestone-by-milestone kwenye `docs/`); haijaunganishwa na engine halisi ya STT/TTS bado kwa mujibu wa `.env.example` comments |

## Bado hazipo kabisa (sivyo msingi wala tool)

- **Gmail** — hakuna OAuth flow wala Gmail API client popote kwenye repo.
- **WhatsApp Business API** — hakuna.
- **Telegram / Discord / Slack** — hakuna.
- **Calendar (Google/Outlook)** — hakuna.
- **Contacts** — hakuna.
- **Proactive assistant** (reminders, "storage yako imebaki 10%", nk.) —
  `infrastructure/HealthMonitor` tayari ina polling loop (kila 15s kwa
  mujibu wa `app.config.json`), lakini haijaunganishwa na notification wala
  "tell the user proactively" path yoyote bado.
- **Knowledge base / vector DB juu ya documents zako** — hakuna
  parser→chunking→embeddings pipeline; `file.read`/`file.search` zilizopo
  ni literal file ops, si semantic search.

## Mapendekezo ya vipaumbele (kwa order hii)

1. **Connector pattern moja, itumike kwa Gmail/Calendar/WhatsApp zote** —
   badala ya kujenga kila mmoja peke yake, iga muundo uliopo tayari wa
   `IAIProvider` + `ProviderRegistry` (kila connector: `isConfigured()`,
   `capabilities`, normalized errors kama `ai/errors.ts`). Hii inakupa
   permission gating, error handling, na health monitoring bila kuandika
   upya. Anza na **Gmail pekee** (OAuth ni ngumu zaidi ya Calendar/Contacts
   kidogo, lakini una thamani kubwa zaidi mara moja).
2. **Token vault** — kabla ya Gmail/Calendar yoyote: mahali salama pa
   kuhifadhi OAuth refresh tokens (encrypted-at-rest, siyo kwenye
   `.env` — hiyo ni sahihi kwa API keys za AI providers pekee, si kwa
   tokens za akaunti binafsi za mtumiaji). `security/` folder ndiyo mahali
   pazuri pa hii.
3. **HIGH RISK confirmation tier** — `ActionPolicy`/`PermissionManager`
   tayari ina dhana ya `requiresConfirmation`; ipanulie iwe na eneo
   maalum la "HIGH RISK" (delete data, send message, financial, account
   changes) kama ulivyoainisha, kabla hujaunganisha Gmail send/WhatsApp
   send — hizi ndizo actions za kwanza zitakazohitaji hiyo tier.
4. **Proactive notifications** — waya `HealthMonitor` iliyopo kwenye
   `infrastructure/` kwenda kwenye njia mpya ya "notify user" (badala ya
   kuunda mfumo mpya wa polling kutoka mwanzo).
5. **Memory tiers** — panua `MemoryManager` iliyopo kuwa na
   long-term/episodic/knowledge kama ulivyoainisha; short-term tayari ipo
   na inafanya kazi vizuri, hivyo hii ni extension, si mradi mpya.
6. **Telegram/Discord/Slack** baada ya Gmail — API zao ni rahisi zaidi
   (bot tokens, si full OAuth consent screens), kwa hiyo zitakuwa haraka
   mara muundo wa connector wa #1 upo.
7. **Vector DB/knowledge base** — hii ndiyo mradi mkubwa zaidi peke yake
   (parser + chunking + embeddings + vector store); ningeipa kipaumbele
   cha mwisho isipokuwa ndiyo lengo lako kuu la matumizi ya kila siku.

Kila kimoja kati ya hivi ni mradi wake peke yake — nikianza kuandika code
ya Gmail/Calendar/WhatsApp papo hapo bila upimaji (OAuth consent screens,
scopes, redirect URIs halisi za akaunti yako) itakuwa ni scaffolding tu
isiyoweza kujaribiwa. Nikuambie ni ipi unataka tuanze nayo kwanza (Gmail
ndiyo pendekezo langu), na tutaijenga hatua kwa hatua kama connector halisi
inayoweza kujaribiwa, siyo boilerplate.
