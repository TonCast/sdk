import type { SupportedLanguage } from "@toncast/sdk";

const en = {
  "nav.list": "Markets",
  "nav.bets": "My Bets",

  "page.paris.title": "Markets",
  "page.paris.empty": "No markets in this category.",
  "page.paris.loadFailed": "Failed to load: {error}",
  "page.paris.detail.back": "← Back",
  "page.paris.detail.notFound": "Market not found",
  "page.paris.detail.failed": "Failed: {error}",

  "category.all": "All",

  "pari.result.title": "Final outcome",
  "pari.result.yes": "YES won",
  "pari.result.no": "NO won",
  "pari.result.draw": "Draw",
  "pari.result.unknown": "Outcome: {result}",
  "pari.result.pendingInactive": "Market is inactive — outcome pending.",
  "pari.bettingClosed": "Betting closed — market settled.",

  "bet.title": "Place a bet",
  "bet.mode.market": "Market",
  "bet.mode.limit": "Limit",
  "bet.mode.fixed": "Fixed",
  "bet.sourceCoin": "Pay with",
  "bet.sourceCoin.placeholder": "Pick a coin",
  "bet.notViable": "not viable",
  "bet.amount": "Amount ({sym})",
  "bet.tickets": "Tickets",
  "bet.coefficient": "Coefficient",
  "bet.action": "Bet {side}",
  "bet.action.confirming": "Confirming…",
  "bet.matched": "Matched: {n} tickets",
  "bet.placed": "Placed: {n} tickets",
  "bet.placed.note": "@ {odds}% (×{mult}) — fills if matched",
  "bet.total": "Total",
  "bet.walletReserve": "Wallet reserve",
  "bet.required": "Required",
  "bet.winnings": "Winnings if {side} wins",
  "bet.previewOnly": "Preview — {reason}",
  "bet.connectPrompt": "Connect your wallet to place a bet.",
  "bet.quoteWillAppear": "Quote will appear after entering an amount.",
  "bet.balanceTooLow": "Balance too low — try a higher coefficient.",
  "bet.loadingPrice": "loading…",
  "bet.maxOf": "{current} / {max}",
  "bet.oneTicket": "1 ticket",

  "page.bets.title": "My Bets",
  "page.bets.empty": "No bets yet.",
  "page.bets.connectPrompt": "Connect your wallet to see bets.",
  "page.bets.loadFailed": "Failed: {error}",

  "bet.status.placed": "placed",
  "bet.status.matched": "matched",
  "bet.status.won": "won",
  "bet.status.won_yes": "won",
  "bet.status.won_no": "won",
  "bet.status.lost": "lost",
  "bet.status.cancelled": "cancelled",
  "bet.status.refunded": "refunded",

  "side.yes": "YES",
  "side.no": "NO",

  "orderBook.title": "Order Book",
  "orderBook.buyYes": "BUY YES",
  "orderBook.buyNo": "BUY NO",
  "orderBook.price": "price",
  "orderBook.empty": "No open orders.",

  "chart.title": "YES probability",
  "chart.trendUp": "▲",
  "chart.trendDown": "▼",
  "chart.noTrades": "No trades yet",

  "common.showMore": "Load more",
  "common.showLess": "Show less",
  "wallet.connect": "Connect Wallet",
  "wallet.disconnect": "Disconnect",
} as const;

export type TranslationKey = keyof typeof en;

type Catalog = Partial<Record<TranslationKey, string>>;

const ru: Catalog = {
  "nav.list": "Рынки",
  "nav.bets": "Мои ставки",
  "page.paris.title": "Рынки",
  "page.paris.empty": "Нет рынков в этой категории.",
  "category.all": "Все",
  "bet.title": "Поставить ставку",
  "bet.mode.market": "Маркет",
  "bet.mode.limit": "Лимит",
  "bet.mode.fixed": "Фикс",
  "bet.sourceCoin": "Оплата",
  "bet.connectPrompt": "Подключите кошелёк для ставки.",
  "page.bets.title": "Мои ставки",
  "page.bets.empty": "Ставок пока нет.",
  "page.bets.connectPrompt": "Подключите кошелёк для просмотра.",
  "side.yes": "ДА",
  "side.no": "НЕТ",
  "wallet.connect": "Подключить кошелёк",
  "wallet.disconnect": "Отключить",
  "common.showMore": "Загрузить ещё",
};

export const EN_CATALOG = en;
export const TRANSLATIONS: Partial<Record<SupportedLanguage, Catalog>> = {
  en,
  ru,
};
