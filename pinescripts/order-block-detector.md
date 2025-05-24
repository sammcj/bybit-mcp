# order-block-detector.pine README

This script makes use of high-volume activity as an indicator of the presence of market participants accumulating orders in specific areas on a lower timeframe by detecting volume peaks to form order blocks.

Mitigated order blocks are automatically hidden from the chart, also allowing users to be able to select two different mitigation methods "wick" and "close".

Additionally, users can be alerted for the creation and mitigation of bullish/bearish order blocks.

## Settings

- Volume Pivot Length: Lookback of the pivot function used to detect volume peaks, lower values will detect order blocks more frequently.
- Bullish OB: Determines the number of most recent unmitigated bullish order blocks to display on the chart.
- Bearish OB: Determines the number of most recent unmitigated bullish order blocks to display on the chart.
- Bearish OB: Determines the number of most recent unmitigated bullish order blocks to display on the chart.
- Average Line Style: Line style of the average order block level.
- Average Line Width: Line width of the average order block level.
- Mitigation Methods: Method used to determine how an order block is mitigated. "Wick" will mitigate order blocks if the candle wick goes outside of the order block and "Close" will mitigate order blocks if the closing price goes outside of the order block.

## Usage

It is common for more significant market participants to execute orders incrementally in order to avoid overwhelming the market and cause significant price movements. This practice allows the orders to be executed more efficiently and effectively, reducing the impact on the market and minimizing the potential for price volatility.

Order blocks are price areas where these orders are executed incrementally and are commonly used as areas of support/resistance for traders.

Bearish order blocks occur during a downtrend, while bullish order blocks occur in an uptrend. Bullish order blocks range from the price low to the median price, while bearish order blocks range from the median price to the price high. The median price is used as an equilibrium point.

Users can highlight the bars where an order block was detected from the style settings by toggling on the 'Bull OB' or 'Bear OB' selections.

Note that in order to confirm a peak Volume Pivot Length bars are needed, as such note that order blocks are shown retrospectively.
