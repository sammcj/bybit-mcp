# Bybit MCP Server

A Model Context Protocol (MCP) server that provides read-only access to Bybit's cryptocurrency exchange API.

## Features

This MCP server provides the following tools for interacting with Bybit's API:

- `get_ticker`: Get real-time ticker information for a trading pair
- `get_orderbook`: Get orderbook (market depth) data for a trading pair
- `get_kline`: Get kline/candlestick data for a trading pair
- `get_market_info`: Get detailed market information for trading pairs
- `get_trades`: Get recent trades for a trading pair
- `get_instrument_info`: Get detailed instrument information for a specific trading pair

## Installation

```bash
pnpm install
```

## Configuration

The server requires Bybit API credentials to be set as environment variables:

- `BYBIT_API_KEY`: Your Bybit API key
- `BYBIT_API_SECRET`: Your Bybit API secret
- `BYBIT_USE_TESTNET`: Set to "true" to use testnet instead of mainnet (optional, defaults to false)

## Usage

### Get Ticker Information

```typescript
// Example tool call
{
  "name": "get_ticker",
  "arguments": {
    "symbol": "BTCUSDT",
    "category": "spot" // optional, defaults to "spot"
  }
}
```

### Get Orderbook Data

```typescript
// Example tool call
{
  "name": "get_orderbook",
  "arguments": {
    "symbol": "BTCUSDT",
    "category": "spot", // optional, defaults to "spot"
    "limit": 25 // optional, defaults to 25 (available: 1, 25, 50, 100, 200)
  }
}
```

### Get Kline/Candlestick Data

```typescript
// Example tool call
{
  "name": "get_kline",
  "arguments": {
    "symbol": "BTCUSDT",
    "category": "spot", // optional, defaults to "spot"
    "interval": "1", // optional, defaults to "1" (available: "1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "M", "W")
    "limit": 200 // optional, defaults to 200 (max 1000)
  }
}
```

### Get Market Information

```typescript
// Example tool call
{
  "name": "get_market_info",
  "arguments": {
    "category": "spot", // optional, defaults to "spot"
    "symbol": "BTCUSDT", // optional, if not provided returns info for all symbols in the category
    "limit": 200 // optional, defaults to 200 (max 1000)
  }
}
```

### Get Recent Trades

```typescript
// Example tool call
{
  "name": "get_trades",
  "arguments": {
    "symbol": "BTCUSDT",
    "category": "spot", // optional, defaults to "spot"
    "limit": 200 // optional, defaults to 200 (max 1000)
  }
}
```

### Get Instrument Information

```typescript
// Example tool call
{
  "name": "get_instrument_info",
  "arguments": {
    "symbol": "BTCUSDT",
    "category": "spot" // optional, defaults to "spot"
  }
}
```

## Supported Categories

- `spot`: Spot trading
- `linear`: Linear perpetual contracts
- `inverse`: Inverse perpetual contracts

## Development

To build the project:

```bash
pnpm build
```

To run in development mode with watch mode:

```bash
pnpm watch
```

To inspect the MCP server:

```bash
pnpm inspector
```

## License

MIT
