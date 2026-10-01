# WhatsApp — NOT IMPLEMENTED (planned: delivery 2)

Only a `browser.open` shortcut to WhatsApp Web exists. JARVIS will **not** automate a personal WhatsApp account
(scraping/UI automation violates WhatsApp's terms and cannot be done safely).

The planned integration uses the official **WhatsApp Business Cloud API**, which requires things that cannot be done locally:
a Meta developer app, a WhatsApp Business Account, a phone number registered to the Cloud API (`WHATSAPP_PHONE_NUMBER_ID`),
a token (`WHATSAPP_ACCESS_TOKEN`, ideally a System User token), and — for messages to people who have not messaged you in the
last 24 hours — pre-approved message templates. Reserved variables (commented in `.env.example`): `WHATSAPP_ENABLED`,
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`. Sending will be `sensitive` (always confirmed).
