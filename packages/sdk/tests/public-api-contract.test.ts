import { describe, expect, it } from "vitest";

describe("@toncast/sdk public API", () => {
  it("exports only the intended root contract", async () => {
    const sdk = await import("../src/index");

    expect(Object.keys(sdk).sort()).toEqual([
      "ALL_CATEGORY_FILTER",
      "DEFAULT_BASE_URL",
      "DEFAULT_LANGUAGE",
      "DEFAULT_PARI_CHART_PARAMS",
      "DEFAULT_WS_URL",
      "SUPPORTED_LANGUAGES",
      "TON_ADDRESS",
      "TonClient",
      "ToncastApiError",
      "ToncastClient",
      "ToncastError",
      "ToncastRateLimitError",
      "ToncastValidationError",
      "ToncastWsError",
      "createTonClient",
      "formatBetQuoteReason",
      "formatUnits",
      "orderBookLadder",
      "pariCoverUrl",
      "parseTonAddress",
      "parseUnits",
      "resolveLanguage",
      "resolveWsUrlFromApiBaseUrl",
      "ticketCost",
      "toTonConnectMessage",
      "toTonConnectMessages",
      "yesOddsToDecimalOdds",
    ]);
  });

  it("keeps advanced betting primitives behind the ./betting subpath", async () => {
    const betting = await import("../src/betting");

    expect(Object.keys(betting).sort()).toEqual([
      "DEFAULT_WALLET_RESERVE",
      "ODDS_MAX",
      "ODDS_MIN",
      "ODDS_STEP",
      "PARI_EXECUTION_FEE",
      "TON_ADDRESS",
      "TonClient",
      "availableForBet",
      "availableTickets",
      "breakdownTotals",
      "buildJettonBetTx",
      "buildTonBetTx",
      "calcBetCost",
      "calcWinnings",
      "computeFixedBets",
      "computeLimitBets",
      "computeMarketBets",
      "ticketCost",
      "toTonConnectMessage",
      "toTonConnectMessages",
      "yesOddsToDecimalOdds",
      "yesOddsToProbabilityPct",
    ]);
  });
});
