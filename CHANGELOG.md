# Changelog

## 0.0.1 — Skeleton

- Initial project scaffolding: `ToncastClient` facade, `HttpClient`, `WsClient`.
- Resource classes: `markets`, `bets`, `odds`, `portfolio`, `coins`, `users`, `betting`.
- Error hierarchy: `ToncastError`, `ToncastApiError`, `ToncastWsError`, `ToncastValidationError`.
- Zod-backed DTO placeholders for `Market` and `Bet`.
- Smoke tests for client construction and `userAddress` handling.
- All domain logic is stubbed with `TODO(stub):` markers pending real Toncast API contracts.
