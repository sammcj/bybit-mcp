/**
 * Utility functions for formatting data
 */

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, currency: string = 'USD', decimals?: number): string {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
  };

  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals;
    options.maximumFractionDigits = decimals;
  }

  return new Intl.NumberFormat('en-US', options).format(value);
}

/**
 * Format a number with appropriate decimal places
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a large number with K, M, B suffixes
 */
export function formatLargeNumber(value: number): string {
  const absValue = Math.abs(value);
  
  if (absValue >= 1e9) {
    return formatNumber(value / 1e9, 2) + 'B';
  } else if (absValue >= 1e6) {
    return formatNumber(value / 1e6, 2) + 'M';
  } else if (absValue >= 1e3) {
    return formatNumber(value / 1e3, 2) + 'K';
  }
  
  return formatNumber(value, 2);
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format a timestamp
 */
export function formatTimestamp(timestamp: number, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };

  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(timestamp));
}

/**
 * Format a relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Format a trading symbol for display
 */
export function formatSymbol(symbol: string): string {
  // Convert BTCUSDT to BTC/USDT
  const commonQuotes = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB'];
  
  for (const quote of commonQuotes) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      return `${base}/${quote}`;
    }
  }
  
  return symbol;
}

/**
 * Format price change with color indication
 */
export function formatPriceChange(change: number, isPercentage: boolean = false): {
  formatted: string;
  className: string;
  icon: string;
} {
  const isPositive = change > 0;
  const isNegative = change < 0;
  
  let formatted: string;
  if (isPercentage) {
    formatted = formatPercentage(Math.abs(change));
  } else {
    formatted = formatNumber(Math.abs(change));
  }
  
  const className = isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-secondary';
  const icon = isPositive ? '↗' : isNegative ? '↘' : '→';
  
  return {
    formatted: `${isPositive ? '+' : isNegative ? '-' : ''}${formatted}`,
    className,
    icon,
  };
}

/**
 * Format volume with appropriate units
 */
export function formatVolume(volume: number): string {
  return formatLargeNumber(volume);
}

/**
 * Format market cap
 */
export function formatMarketCap(marketCap: number): string {
  return formatLargeNumber(marketCap);
}

/**
 * Format order book price levels
 */
export function formatOrderBookLevel(price: string, size: string): {
  price: string;
  size: string;
  total: string;
} {
  const priceNum = parseFloat(price);
  const sizeNum = parseFloat(size);
  const total = priceNum * sizeNum;
  
  return {
    price: formatNumber(priceNum, 4),
    size: formatNumber(sizeNum, 6),
    total: formatNumber(total, 2),
  };
}

/**
 * Format RSI value with overbought/oversold indication
 */
export function formatRSI(rsi: number): {
  formatted: string;
  className: string;
  status: 'overbought' | 'oversold' | 'neutral';
} {
  const formatted = formatNumber(rsi, 2);
  
  let className: string;
  let status: 'overbought' | 'oversold' | 'neutral';
  
  if (rsi >= 70) {
    className = 'text-danger';
    status = 'overbought';
  } else if (rsi <= 30) {
    className = 'text-success';
    status = 'oversold';
  } else {
    className = 'text-secondary';
    status = 'neutral';
  }
  
  return { formatted, className, status };
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${formatNumber(size, unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${formatNumber(seconds, 1)}s`;
  }
  
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${formatNumber(minutes, 1)}m`;
  }
  
  const hours = minutes / 60;
  return `${formatNumber(hours, 1)}h`;
}

/**
 * Format confidence score
 */
export function formatConfidence(confidence: number): {
  formatted: string;
  className: string;
  level: 'high' | 'medium' | 'low';
} {
  const formatted = formatPercentage(confidence);
  
  let className: string;
  let level: 'high' | 'medium' | 'low';
  
  if (confidence >= 80) {
    className = 'text-success';
    level = 'high';
  } else if (confidence >= 60) {
    className = 'text-warning';
    level = 'medium';
  } else {
    className = 'text-danger';
    level = 'low';
  }
  
  return { formatted, className, level };
}
