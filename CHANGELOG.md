# Changelog

## 0.2.0

- Align SDK models with the current customer API, including nullable fields and connection status metadata.
- Preserve configured user and credential bindings, defaults, aliases, and saved input rules in framework tools. Reject conflicting bindings and ambiguous tool names.
- Preserve full JSON Schema in Google function declarations using `parametersJsonSchema`; update consumers that previously read `parameters`.
- Harden timeouts, response parsing, and retry delays. Ambiguous action POST failures are not automatically replayed.
- Validate transport, adapter, and generated-model behavior in release checks.

See the README migration notes before upgrading from 0.1.x.
