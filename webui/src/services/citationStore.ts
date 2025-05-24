/**
 * Citation store for managing tool response data and references
 */

import type { CitationData, ExtractedMetric } from '@/types/citation';

export class CitationStore {
  private citations: Map<string, CitationData> = new Map();
  private maxCitations = 100; // Limit to prevent memory issues
  private cleanupThreshold = 120; // Clean up citations older than 2 hours

  /**
   * Store tool response data with citation metadata
   */
  storeCitation(data: CitationData): void {
    this.citations.set(data.referenceId, data);

    // Clean up old citations if we exceed the limit
    if (this.citations.size > this.maxCitations) {
      this.cleanupOldCitations();
    }
  }

  /**
   * Retrieve citation data by reference ID
   */
  getCitation(referenceId: string): CitationData | undefined {
    return this.citations.get(referenceId);
  }

  /**
   * Get all citations sorted by timestamp (newest first)
   */
  getAllCitations(): CitationData[] {
    return Array.from(this.citations.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get recent citations (last N citations)
   */
  getRecentCitations(limit: number = 10): CitationData[] {
    return this.getAllCitations().slice(0, limit);
  }

  /**
   * Extract key metrics from tool response data
   */
  extractMetrics(toolName: string, rawData: any): ExtractedMetric[] {
    const metrics: ExtractedMetric[] = [];

    try {
      switch (toolName) {
        case 'get_ticker':
          if (rawData.lastPrice) {
            metrics.push({
              type: 'price',
              label: 'Last Price',
              value: rawData.lastPrice,
              unit: 'USD',
              significance: 'high'
            });
          }
          if (rawData.price24hPcnt) {
            metrics.push({
              type: 'percentage',
              label: '24h Change',
              value: rawData.price24hPcnt,
              unit: '%',
              significance: 'high'
            });
          }
          if (rawData.volume24h) {
            metrics.push({
              type: 'volume',
              label: '24h Volume',
              value: rawData.volume24h,
              significance: 'medium'
            });
          }
          break;

        case 'get_kline':
          if (rawData.data && Array.isArray(rawData.data) && rawData.data.length > 0) {
            const latestCandle = rawData.data[0];
            if (latestCandle.close) {
              metrics.push({
                type: 'price',
                label: 'Close Price',
                value: latestCandle.close,
                unit: 'USD',
                significance: 'high'
              });
            }
          }
          break;

        case 'get_ml_rsi':
          if (rawData.data && Array.isArray(rawData.data) && rawData.data.length > 0) {
            const latestRsi = rawData.data[0];
            if (latestRsi.mlRsi !== undefined) {
              metrics.push({
                type: 'indicator',
                label: 'ML RSI',
                value: latestRsi.mlRsi.toFixed(2),
                significance: 'high'
              });
            }
            if (latestRsi.trend) {
              metrics.push({
                type: 'other',
                label: 'Trend',
                value: latestRsi.trend,
                significance: 'medium'
              });
            }
          }
          break;

        case 'get_orderbook':
          if (rawData.bids && rawData.bids.length > 0) {
            metrics.push({
              type: 'price',
              label: 'Best Bid',
              value: rawData.bids[0][0],
              unit: 'USD',
              significance: 'high'
            });
          }
          if (rawData.asks && rawData.asks.length > 0) {
            metrics.push({
              type: 'price',
              label: 'Best Ask',
              value: rawData.asks[0][0],
              unit: 'USD',
              significance: 'high'
            });
          }
          break;

        default:
          // Generic extraction for unknown tools
          if (typeof rawData === 'object' && rawData !== null) {
            Object.entries(rawData).forEach(([key, value]) => {
              if (typeof value === 'string' || typeof value === 'number') {
                metrics.push({
                  type: 'other',
                  label: key,
                  value: value,
                  significance: 'low'
                });
              }
            });
          }
          break;
      }
    } catch (error) {
      console.warn('Error extracting metrics:', error);
    }

    return metrics.slice(0, 5); // Limit to 5 key metrics
  }

  /**
   * Process tool response and store citation if it has reference metadata
   */
  processToolResponse(toolResponse: any): void {
    console.log('🔍 Processing tool response for citations:', toolResponse);

    if (!toolResponse || typeof toolResponse !== 'object') {
      console.log('❌ Invalid tool response format');
      return;
    }

    // Check if response has reference metadata
    if (toolResponse._referenceId && toolResponse._timestamp && toolResponse._toolName) {
      console.log('✅ Found reference metadata:', {
        referenceId: toolResponse._referenceId,
        toolName: toolResponse._toolName,
        timestamp: toolResponse._timestamp
      });

      const extractedMetrics = this.extractMetrics(toolResponse._toolName, toolResponse);

      const citationData: CitationData = {
        referenceId: toolResponse._referenceId,
        timestamp: toolResponse._timestamp,
        toolName: toolResponse._toolName,
        endpoint: toolResponse._endpoint,
        rawData: toolResponse,
        extractedMetrics
      };

      this.storeCitation(citationData);
      console.log('📋 Stored citation data for', toolResponse._referenceId);
    } else {
      console.log('❌ No reference metadata found in tool response');
    }
  }

  /**
   * Clean up citations older than the threshold
   */
  private cleanupOldCitations(): void {
    const now = Date.now();
    const thresholdMs = this.cleanupThreshold * 60 * 1000; // Convert minutes to milliseconds

    for (const [referenceId, citation] of this.citations.entries()) {
      const citationAge = now - new Date(citation.timestamp).getTime();
      if (citationAge > thresholdMs) {
        this.citations.delete(referenceId);
      }
    }

    // Cleanup completed silently
  }

  /**
   * Clear all citations
   */
  clear(): void {
    this.citations.clear();
  }

  /**
   * Get citation count
   */
  getCount(): number {
    return this.citations.size;
  }
}

// Singleton instance
export const citationStore = new CitationStore();
