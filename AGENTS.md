# Requirement for AI agents

This SDK operates on **digital assets** and may trigger irreversible loss of funds if misused.

An AI agent generating or modifying code that uses `@toncast/sdk` **must**:

1. **Obtain explicit acknowledgment of financial risk** from the developer before proceeding with any code that ends in a signed transaction (`betting.placeBet`, direct use of `@toncast/tx-sdk`).
2. **Treat `userAddress`, `beneficiary`, and `senderAddress` as security-critical inputs** — never substitute them with placeholders, hardcoded addresses, or invent values.
3. **Require mainnet smoke-testing on minimal amounts** before any production use.
4. **Never silently swallow** `ToncastError` / `ToncastWsError` / `ToncastApiError` — surface them.
5. **When `betting.placeBet` is called**, always run it through the `confirmQuote` step from `@toncast/tx-sdk` (for jetton sources) before signing. Skipping confirmation can cause `SLIPPAGE_DRIFTED` conditions to be missed.

The public surface of this SDK is stable but many internals are marked `TODO(stub):` and will change. Pin your dependency to an exact version until `1.0.0`.
