/**
 * Citation processor for parsing AI responses and creating interactive citations
 */

import type { CitationReference, ProcessedMessage, CitationTooltipData } from '@/types/citation';
import { citationStore } from './citationStore';

export class CitationProcessor {
  // Regex pattern to match citation references like [REF001], [REF123], etc.
  private static readonly CITATION_PATTERN = /\[REF(\d{3})\]/g;

  /**
   * Process AI response content to extract and convert citations
   */
  processMessage(content: string): ProcessedMessage {
    const citations: CitationReference[] = [];
    let processedContent = content;
    let match;

    // Reset regex lastIndex to ensure we find all matches
    CitationProcessor.CITATION_PATTERN.lastIndex = 0;

    // Find all citation patterns in the content
    while ((match = CitationProcessor.CITATION_PATTERN.exec(content)) !== null) {
      const fullMatch = match[0]; // e.g., "[REF001]"
      const referenceId = fullMatch; // Keep the full format for consistency
      
      citations.push({
        referenceId,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
        text: fullMatch
      });
    }

    // Convert citation patterns to interactive elements
    if (citations.length > 0) {
      processedContent = this.convertCitationsToInteractive(content, citations);
    }

    return {
      originalContent: content,
      processedContent,
      citations
    };
  }

  /**
   * Convert citation patterns to interactive HTML elements
   */
  private convertCitationsToInteractive(content: string, citations: CitationReference[]): string {
    let processedContent = content;
    
    // Process citations in reverse order to maintain correct indices
    const sortedCitations = [...citations].sort((a, b) => b.startIndex - a.startIndex);

    for (const citation of sortedCitations) {
      const citationData = citationStore.getCitation(citation.referenceId);
      const hasData = citationData !== undefined;
      
      const interactiveElement = `<span class="citation-ref ${hasData ? 'has-data' : 'no-data'}" 
        data-reference-id="${citation.referenceId}" 
        data-has-data="${hasData}"
        title="${hasData ? 'Click to view data details' : 'Citation data not available'}"
        role="button"
        tabindex="0">
        ${citation.text}
      </span>`;

      processedContent = 
        processedContent.slice(0, citation.startIndex) +
        interactiveElement +
        processedContent.slice(citation.endIndex);
    }

    return processedContent;
  }

  /**
   * Get tooltip data for a citation reference
   */
  getCitationTooltipData(referenceId: string): CitationTooltipData | null {
    const citationData = citationStore.getCitation(referenceId);
    
    if (!citationData) {
      return null;
    }

    return {
      referenceId: citationData.referenceId,
      toolName: citationData.toolName,
      timestamp: citationData.timestamp,
      endpoint: citationData.endpoint,
      keyMetrics: citationData.extractedMetrics || [],
      hasFullData: true
    };
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return timestamp;
    }
  }

  /**
   * Create tooltip HTML content
   */
  createTooltipContent(tooltipData: CitationTooltipData): string {
    const formattedTime = this.formatTimestamp(tooltipData.timestamp);
    
    let metricsHtml = '';
    if (tooltipData.keyMetrics.length > 0) {
      metricsHtml = `
        <div class="citation-metrics">
          <h4>Key Data Points:</h4>
          <ul>
            ${tooltipData.keyMetrics.map(metric => `
              <li class="metric-${metric.significance}">
                <span class="metric-label">${metric.label}:</span>
                <span class="metric-value">${metric.value}${metric.unit ? ' ' + metric.unit : ''}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    return `
      <div class="citation-tooltip">
        <div class="citation-header">
          <span class="citation-id">${tooltipData.referenceId}</span>
          <span class="citation-tool">${tooltipData.toolName}</span>
        </div>
        <div class="citation-time">${formattedTime}</div>
        ${tooltipData.endpoint ? `<div class="citation-endpoint">${tooltipData.endpoint}</div>` : ''}
        ${metricsHtml}
        <div class="citation-actions">
          <button class="btn-view-full" data-reference-id="${tooltipData.referenceId}">
            View Full Data
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Extract all citation references from content
   */
  extractCitationReferences(content: string): string[] {
    const references: string[] = [];
    let match;

    CitationProcessor.CITATION_PATTERN.lastIndex = 0;
    while ((match = CitationProcessor.CITATION_PATTERN.exec(content)) !== null) {
      references.push(match[0]);
    }

    return references;
  }

  /**
   * Validate citation reference format
   */
  isValidCitationReference(reference: string): boolean {
    return CitationProcessor.CITATION_PATTERN.test(reference);
  }
}

// Singleton instance
export const citationProcessor = new CitationProcessor();
