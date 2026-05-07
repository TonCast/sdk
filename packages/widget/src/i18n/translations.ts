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

  "pari.meta.yesVol": "YES vol",
  "pari.meta.noVol": "NO vol",
  "pari.meta.bestYes": "best YES",

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
  "page.paris.empty": "В этой категории нет рынков.",
  "page.paris.loadFailed": "Ошибка загрузки: {error}",
  "page.paris.detail.back": "← Назад",
  "page.paris.detail.notFound": "Рынок не найден",
  "page.paris.detail.failed": "Ошибка: {error}",

  "category.all": "Все",

  "pari.result.title": "Итог",
  "pari.result.yes": "ДА победил",
  "pari.result.no": "НЕТ победил",
  "pari.result.draw": "Ничья",
  "pari.result.unknown": "Итог: {result}",
  "pari.result.pendingInactive": "Рынок неактивен — итог ожидается.",
  "pari.bettingClosed": "Ставки закрыты — рынок завершён.",

  "bet.title": "Сделать ставку",
  "bet.mode.market": "Маркет",
  "bet.mode.limit": "Лимит",
  "bet.mode.fixed": "Фикс",
  "bet.sourceCoin": "Оплата",
  "bet.sourceCoin.placeholder": "Выберите монету",
  "bet.notViable": "недоступно",
  "bet.amount": "Сумма ({sym})",
  "bet.tickets": "Билеты",
  "bet.coefficient": "Коэффициент",
  "bet.action": "Ставка {side}",
  "bet.action.confirming": "Подтверждение…",
  "bet.matched": "Совпало: {n} билетов",
  "bet.placed": "Размещено: {n} билетов",
  "bet.placed.note": "@ {odds}% (×{mult}) — исполняется при совпадении",
  "bet.total": "Итого",
  "bet.walletReserve": "Резерв кошелька",
  "bet.required": "Необходимо",
  "bet.winnings": "Выигрыш при победе {side}",
  "bet.previewOnly": "Предпросмотр — {reason}",
  "bet.connectPrompt": "Подключите кошелёк для ставки.",
  "bet.quoteWillAppear": "Котировка появится после ввода суммы.",
  "bet.balanceTooLow": "Недостаточно средств — попробуйте выше коэффициент.",
  "bet.loadingPrice": "загрузка…",
  "bet.maxOf": "{current} / {max}",
  "bet.oneTicket": "1 билет",

  "page.bets.title": "Мои ставки",
  "page.bets.empty": "Ставок пока нет.",
  "page.bets.connectPrompt": "Подключите кошелёк для просмотра ставок.",
  "page.bets.loadFailed": "Ошибка: {error}",

  "bet.status.placed": "размещена",
  "bet.status.matched": "совпала",
  "bet.status.won": "выиграна",
  "bet.status.won_yes": "выиграна",
  "bet.status.won_no": "выиграна",
  "bet.status.lost": "проиграна",
  "bet.status.cancelled": "отменена",
  "bet.status.refunded": "возврат",

  "side.yes": "ДА",
  "side.no": "НЕТ",

  "pari.meta.yesVol": "объём ДА",
  "pari.meta.noVol": "объём НЕТ",
  "pari.meta.bestYes": "лучший ДА",

  "orderBook.title": "Книга заявок",
  "orderBook.buyYes": "КУПИТЬ ДА",
  "orderBook.buyNo": "КУПИТЬ НЕТ",
  "orderBook.price": "цена",
  "orderBook.empty": "Нет открытых заявок.",

  "chart.title": "Вероятность ДА",
  "chart.trendUp": "▲",
  "chart.trendDown": "▼",
  "chart.noTrades": "Сделок пока нет",

  "common.showMore": "Загрузить ещё",
  "common.showLess": "Свернуть",
  "wallet.connect": "Подключить кошелёк",
  "wallet.disconnect": "Отключить",
};

export const EN_CATALOG = en;
export const TRANSLATIONS: Partial<Record<SupportedLanguage, Catalog>> = {
  en,
  ru,
};
