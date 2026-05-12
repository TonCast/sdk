// Compile-only verification that every code idiom in README.md actually typechecks
// against the public API. Not a runtime test — just `tsc --noEmit`.
//
// If anything in here breaks, the README is lying.

// biome-ignore-all lint/correctness/noUnusedVariables: compile-only file, vars used by typecheck
// biome-ignore-all lint/correctness/noUnusedImports: same — imports document the surface
// biome-ignore-all lint/style/useConst: same
// biome-ignore-all lint/suspicious/noExplicitAny: same
// biome-ignore-all lint/style/noNonNullAssertion: same
/* eslint-disable */
import {
  type BetQuote,
  type BetSummary,
  type CoinCapacity,
  type ConfirmedQuote,
  type ConfirmQuoteParams,
  type Cursor,
  DEFAULT_LANGUAGE,
  type Page,
  type ParisCursor,
  type PricedCoin,
  type QuoteFixedBetParams,
  type QuoteLimitBetParams,
  type QuoteMarketBetParams,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  TON_ADDRESS,
  TonClient,
  ToncastApiError,
  ToncastClient,
  type ToncastClientOptions,
  ToncastError,
  toTonConnectMessage,
  toTonConnectMessages,
} from "../src";

declare const userAddress: string;
declare const pariId: string;
declare const agentSignerWallet: string;
declare const recipientWallet: string;
declare const partnerWallet: string;

async function quickStart() {
  // README "Quick start"
  const tonClient = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
  });

  const client = new ToncastClient({
    tonClient,
    referral: { address: "UQMyIntegratorWallet", pct: 5 },
    // userAddress omitted
  });

  const page = await client.paris.list({ limit: 20 });
  const pari = page.items[0];
  if (!pari) return;

  client.setUserAddress(userAddress);

  const summary = await client.betting.summary(pari.id);

  // Picker
  const picked = summary.capacities.find((c) => c.source.address === TON_ADDRESS && c.feasible);
  if (!picked) throw new Error("no viable funding source");

  // CoinCapacity field access claimed in README
  const _src: string = picked.source.address;
  const _amt: bigint = picked.source.amount;
  const _sym: string | undefined = picked.source.symbol;
  const _dec: number | undefined = picked.source.decimals;
  const _min: bigint = picked.minBetTon;
  const _max: bigint = picked.maxBetTon;
  const _route = picked.route;
  const _reason: string | undefined = picked.reason;
  const _feasible: boolean = picked.feasible;

  const maxBudgetTon = picked.maxBetTon < 5_000_000_000n ? picked.maxBetTon : 5_000_000_000n;

  const quoteParams = {
    pariId: pari.id,
    isYes: true,
    maxBudgetTon,
    source: picked.source.address,
    pricedCoins: summary.pricedCoins,
    oddsState: summary.oddsState,
    financialRiskAcknowledged: true,
  } satisfies QuoteMarketBetParams & ConfirmQuoteParams;

  const quote = await client.betting.quoteMarketBet(quoteParams);

  // BetQuote shape claimed in README
  const _mode: string = quote.mode;
  const _isYes: boolean = quote.isYes;
  const _totalCost: bigint = quote.totalCost;
  const _bets = quote.bets;
  const _b0odds: number = _bets[0]!.yesOdds;
  const _b0tickets: number = _bets[0]!.ticketsCount;
  const _opt = quote.option;
  if (_opt.feasible) {
    const _est: boolean = _opt.estimated;
    const _src2 = _opt.source;
    const _bd = _opt.breakdown;
    const _spend: bigint = _bd.spend;
    const _gas: bigint = _bd.gas;
    const _warns: string[] | undefined = _opt.warnings;
  } else {
    const _r: string = _opt.reason;
  }
  const _sBreak = quote.breakdown;

  const confirmed = await client.betting.confirmQuote(quote, quoteParams);

  // ConfirmedQuote shape
  const _cq: BetQuote = confirmed.quote;
  const _ctxs = confirmed.txs;
  const _cmsg = confirmed.messages;
  const _msg0 = _cmsg[0]!;
  const _addr: string = _msg0.address;
  const _amount: string = _msg0.amount;
  const _payload: string | undefined = _msg0.payload;
}

async function readingData() {
  const client = new ToncastClient({ tonClient: new TonClient({ endpoint: "x" }), userAddress });

  const cats = await client.categories.list();
  const _catId: number = cats[0]!.id;
  const _catTitle: string = cats[0]!.title;

  const active = await client.paris.list({ categoryId: 3, limit: 20 });
  const finished = await client.paris.list({ feed: "finished" });
  const pending = await client.paris.list({ feed: "pending" });
  const search = await client.paris.list({ search: "ETH price" });

  const pari = await client.paris.get(pariId);
  const odds = await client.paris.getOddsState(pariId);
  const _yesArr: number[] = odds.Yes;
  const _noArr: number[] = odds.No;

  const history = await client.paris.getCoefficientHistory(pariId, { timeframe: "ALL" });
  const _addr: string = history.pariAddress;
  const _hp = history.history[0]!;
  const _ts: number = _hp.timestamp;
  const _coef: number = _hp.coefficient;

  const winners = await client.paris.getWinners(pariId);
  if (winners[0]) {
    const _wAddr: string = winners[0].userAddress;
    const _wAmt: number = winners[0].winAmount;
    const _side: "yes" | "no" = winners[0].side;
  }

  const userBets = await client.bets.listForUser({ pageSize: 20 });
  for await (const b of client.bets.iterateForUser()) {
    const _id: number = b.id;
  }
  const onPari = await client.bets.listForPariByUser({ pariId, pageSize: 15 });

  const myCoins = await client.coins.list();
  const _coin = myCoins[0]!;
  const _cAddr: string = _coin.address;
  const _cAmt: bigint = _coin.amount;
}

async function preparingABet() {
  const client = new ToncastClient({ tonClient: new TonClient({ endpoint: "x" }), userAddress });
  const summary = await client.betting.summary(pariId);

  // Limit mode example from README
  const limitParams = {
    pariId,
    isYes: true,
    worstYesOdds: 56,
    ticketsCount: 300,
    source: TON_ADDRESS,
    financialRiskAcknowledged: true,
  } satisfies QuoteLimitBetParams & ConfirmQuoteParams;
  const limitQuote = await client.betting.quoteLimitBet(limitParams);
  const _limitConfirmed: ConfirmedQuote = await client.betting.confirmQuote(
    limitQuote,
    limitParams,
  );

  // Fixed mode example from README
  const fixedParams = {
    pariId,
    isYes: true,
    yesOdds: 56,
    ticketsCount: 10,
    source: TON_ADDRESS,
    financialRiskAcknowledged: true,
  } satisfies QuoteFixedBetParams & ConfirmQuoteParams;
  const fixedQuote = await client.betting.quoteFixedBet(fixedParams);
  const _fixedConfirmed: ConfirmedQuote = await client.betting.confirmQuote(
    fixedQuote,
    fixedParams,
  );

  // All three addresses overridden + jetton source
  const usdt = summary.capacities.find((c) => c.source.symbol === "USDT" && c.feasible);
  if (!usdt) throw new Error("user has no viable USDT balance");

  const overrideParams = {
    pariId,
    isYes: true,
    maxBudgetTon: 5_000_000_000n,
    source: usdt.source.address,
    pricedCoins: summary.pricedCoins,
    oddsState: summary.oddsState,
    senderAddress: agentSignerWallet,
    beneficiary: recipientWallet,
    referral: partnerWallet,
    referralPct: 5,
    financialRiskAcknowledged: true,
  } satisfies QuoteMarketBetParams & ConfirmQuoteParams;
  const overrideQuote = await client.betting.quoteMarketBet(overrideParams);
  const _overrideConfirmed = await client.betting.confirmQuote(overrideQuote, overrideParams);
}

function userWalletAddress() {
  const client = new ToncastClient();
  client.setUserAddress("UQA");
  client.clearUserAddress();
  const _addr: string | undefined = client.getUserAddress();

  // Per-call override claimed in README
  client.bets.listForUser({ userAddress: "UQOther" });
}

function languages() {
  const client = new ToncastClient({ language: "ru-RU" });
  client.setLanguage("zh-Hans-CN");
  client.setLanguage("ja");
  const _lang: SupportedLanguage = client.getLanguage();
  client.categories.clearCache();
}

async function pagination() {
  const client = new ToncastClient();
  let page: Page<unknown, ParisCursor> = (await client.paris.list({
    feed: "finished",
    limit: 20,
  })) as any;
  while (page.hasMore && page.nextCursor) {
    page = (await client.paris.list({ feed: "finished", cursor: page.nextCursor })) as any;
  }
  for await (const _pari of client.paris.iterate({ feed: "finished" })) {
    /* ... */
  }
}

// Exhaustive surface check — touch everything we re-export
const _surface = {
  TON_ADDRESS,
  TonClient,
  ToncastClient,
  ToncastError,
  ToncastApiError,
  toTonConnectMessage,
  toTonConnectMessages,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
};

void quickStart;
void readingData;
void preparingABet;
void userWalletAddress;
void languages;
void pagination;
void _surface;
