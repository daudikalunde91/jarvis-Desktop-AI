# Microsoft Graph (Outlook, OneDrive) — NOT IMPLEMENTED (planned: delivery 2)

Nothing is registered, so the AI cannot call any Outlook/OneDrive tool. Planned: Entra ID app registration (public client,
redirect `http://localhost`), delegated scopes `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite`, `Files.Read`, `Files.ReadWrite`,
auth-code + PKCE through the same loopback authorizer, tokens in the same credential store. Reserved variables are commented in
`.env.example` (`MICROSOFT_ENABLED`, `MICROSOFT_CLIENT_ID`, …).
