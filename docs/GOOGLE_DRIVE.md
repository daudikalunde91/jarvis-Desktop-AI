# Google Drive — NOT IMPLEMENTED (planned: delivery 2)

No code exists yet. The shared Google plumbing (`GoogleProviderBase`, OAuth, token refresh, HTTP client) is ready, so Drive
will be a small provider: `drive.read` (`drive.readonly` or `drive.file`), `drive.write` (`drive.file`), size caps on downloads,
and confirmation before upload/delete. No Drive tools are registered, so the AI cannot call anything Drive-related.
