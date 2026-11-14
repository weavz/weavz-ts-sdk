# Changelog

## 0.3.1

- Add generated input types for Figma file outlines and selected-node design context. These are additive actions on the existing Figma integration.
- Document selection, truncation, image URLs and the distinction between REST reference data and Figma's separate MCP capabilities.

## 0.3.0

- Add Skills APIs for reusable personal and shared instructions.
- Add human watch/control access issuance for computer sessions.
- Refresh customer API models and integration input types while keeping dashboard-only APIs outside the SDK.

## 0.2.0

- Align SDK models with the current customer API, including nullable fields and connection status metadata.
- Preserve configured user and credential bindings, defaults, aliases, and saved input rules in framework tools. Reject conflicting bindings and ambiguous tool names.
- Preserve full JSON Schema in Google function declarations using `parametersJsonSchema`; update consumers that previously read `parameters`.
- Harden timeouts, response parsing, and retry delays. Ambiguous action POST failures are not automatically replayed.
- Validate transport, adapter, and generated-model behavior in release checks.

See the README migration notes before upgrading from 0.1.x.
