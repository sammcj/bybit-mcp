/**
 * Types for the citation and data verification system
 */

export interface CitationData {
  referenceId: string;
  timestamp: string;
  toolName: string;
  endpoint?: string;
  rawData: any;
  extractedMetrics?: ExtractedMetric[];
}

export interface ExtractedMetric {
  type: 'price' | 'volume' | 'indicator' | 'percentage' | 'other';
  label: string;
  value: string | number;
  unit?: string;
  significance: 'high' | 'medium' | 'low';
}

export interface CitationReference {
  referenceId: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

export interface ProcessedMessage {
  originalContent: string;
  processedContent: string;
  citations: CitationReference[];
}

export interface CitationTooltipData {
  referenceId: string;
  toolName: string;
  timestamp: string;
  endpoint?: string;
  keyMetrics: ExtractedMetric[];
  hasFullData: boolean;
}
