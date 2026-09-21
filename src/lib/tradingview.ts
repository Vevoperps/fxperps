/**
 * Our pair symbols, as TradingView knows them.
 *
 * Every market here is quoted local currency per one dollar — USDJPY, USDEUR,
 * USDTRY — and `FX_IDC` is the feed that carries that direction for the whole
 * alphabet, majors and frontier alike. The interbank feeds (`FX`, `OANDA`)
 * carry EURUSD and GBPUSD the other way up and stop well short of the
 * frontier, which is why they are not the default.
 *
 * A pair TradingView cannot price shows its own "invalid symbol" inside the
 * widget rather than breaking the page. When that happens the fix is one line
 * in `OVERRIDES` below — find the symbol on tradingview.com, copy the
 * `EXCHANGE:TICKER` from its header, and put it here.
 */

const OVERRIDES: Record<string, string> = {
  // e.g. USDXXX: "SOMEFEED:USDXXX",
};

export const tradingViewSymbol = (symbol: string): string =>
  OVERRIDES[symbol] ?? `FX_IDC:${symbol}`;
