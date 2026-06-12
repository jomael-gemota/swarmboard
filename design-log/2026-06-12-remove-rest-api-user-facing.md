# Remove REST API as a User-Facing Feature

**Date:** 2026-06-12
**Status:** accepted
**Author:** collaborative

## Context

Swarmboard originally exposed a documented REST API (`/api/v1/tasks`, `/api/v1/boards`) as a first-class feature so developers could call it directly with curl, scripts, or CI pipelines. The `@swarmboard/mcp-server` package also wraps these same HTTP endpoints internally. The Overview page included curl examples and an expandable endpoint reference table.

After reviewing the product direction, direct REST access is not needed — MCP is the only intended interface for agent integration.

## Decision

Remove the REST API as a documented, user-facing feature:

- Delete the "REST API" section from `DocumentationPage.tsx` (Overview page), including the curl quick-start and endpoint reference table.
- Remove associated dead code: `API_ENDPOINTS`, `ApiEndpointRow`, `METHOD_STYLES`, type definitions (`EndpointDef`, `ParamDef`, `HttpMethod`), `restExample`, and `apiBase` variables.
- Update the AI agents workflow section subtitle to reflect MCP-only connectivity.
- **Retain** the backend `/api/v1` routes — they are the internal HTTP transport that the MCP server package calls. Removing them would break MCP.
- **Retain** the agent tokens system — tokens are still required for `SWARMBOARD_TOKEN` in the MCP config.

## Alternatives Considered

- **Remove backend routes entirely and refactor MCP to use a different transport** — rejected because the MCP server is a published npm package (`@swarmboard/mcp-server`) that runs as a stdio process and needs an HTTP endpoint to call; refactoring the transport is a significant effort with no benefit.
- **Keep REST API but just hide the docs** — rejected because leaving dead documentation creates confusion. Removing the section clearly signals the intended interface.

## Consequences

- The Overview page becomes simpler and MCP-focused.
- Developers who were calling the REST API directly will lose the documented interface; MCP is the replacement.
- No backend changes are required — the routes remain as MCP's internal plumbing.
- `README.md` and `packages/shared/README.md` still reference REST payloads but those are internal concerns for MCP maintainers, not end users.
