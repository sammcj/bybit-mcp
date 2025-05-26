/**
 * Data Verification Panel - Shows recent tool calls and extracted metrics
 */

import type { CitationData } from '@/types/citation';
import { citationStore } from '@/services/citationStore';
import { citationProcessor } from '@/services/citationProcessor';

export class DataVerificationPanel {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private currentFilter: string = 'all';

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    if (!this.container) {
      throw new Error(`Container element with id "${containerId}" not found`);
    }

    this.initialize();
  }

  private initialize(): void {
    this.createPanelStructure();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  private createPanelStructure(): void {
    this.container.innerHTML = `
      <div class="verification-panel ${this.isVisible ? 'visible' : 'hidden'}">
        <div class="panel-header">
          <h3>Data Verification</h3>
          <div class="panel-controls">
            <select class="filter-select" id="verification-filter">
              <option value="all">All Data</option>
              <option value="price">Prices</option>
              <option value="volume">Volume</option>
              <option value="indicator">Indicators</option>
              <option value="percentage">Percentages</option>
            </select>
            <button class="toggle-btn" id="verification-toggle" aria-label="Toggle verification panel">
              <span class="toggle-icon">📊</span>
            </button>
          </div>
        </div>

        <div class="panel-content">
          <div class="citations-summary">
            <div class="summary-item">
              <span class="label">Total Citations:</span>
              <span class="value" id="total-citations">0</span>
            </div>
            <div class="summary-item">
              <span class="label">Recent Tools:</span>
              <span class="value" id="recent-tools">0</span>
            </div>
          </div>

          <div class="citations-list" id="citations-list">
            <div class="empty-state">
              <p>No tool calls yet. Start a conversation to see data verification.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Toggle panel visibility
    const toggleBtn = this.container.querySelector('#verification-toggle') as HTMLButtonElement;
    toggleBtn?.addEventListener('click', () => {
      this.toggleVisibility();
    });

    // Filter change
    const filterSelect = this.container.querySelector('#verification-filter') as HTMLSelectElement;
    filterSelect?.addEventListener('change', (e) => {
      this.currentFilter = (e.target as HTMLSelectElement).value;
      this.refreshCitationsList();
    });

    // Keyboard shortcut to toggle panel (Ctrl/Cmd + D)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.toggleVisibility();
      }
    });
  }

  private startAutoRefresh(): void {
    // Refresh every 2 seconds when panel is visible
    this.refreshInterval = setInterval(() => {
      if (this.isVisible) {
        this.refreshCitationsList();
      }
    }, 2000);
  }

  public toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    const panel = this.container.querySelector('.verification-panel');

    if (this.isVisible) {
      panel?.classList.remove('hidden');
      panel?.classList.add('visible');
      this.refreshCitationsList();
    } else {
      panel?.classList.remove('visible');
      panel?.classList.add('hidden');
    }
  }

  public show(): void {
    if (!this.isVisible) {
      this.toggleVisibility();
    }
  }

  public hide(): void {
    if (this.isVisible) {
      this.toggleVisibility();
    }
  }

  private refreshCitationsList(): void {
    const citations = citationStore.getAllCitations();
    const filteredCitations = this.filterCitations(citations);

    this.updateSummary(citations);
    this.renderCitationsList(filteredCitations);
  }

  private filterCitations(citations: CitationData[]): CitationData[] {
    if (this.currentFilter === 'all') {
      return citations;
    }

    return citations.filter(citation => {
      if (!citation.extractedMetrics) return false;

      return citation.extractedMetrics.some(metric =>
        metric.type === this.currentFilter
      );
    });
  }

  private updateSummary(citations: CitationData[]): void {
    const totalCitationsEl = this.container.querySelector('#total-citations');
    const recentToolsEl = this.container.querySelector('#recent-tools');

    if (totalCitationsEl) {
      totalCitationsEl.textContent = citations.length.toString();
    }

    if (recentToolsEl) {
      const uniqueTools = new Set(citations.map(c => c.toolName));
      recentToolsEl.textContent = uniqueTools.size.toString();
    }
  }

  private renderCitationsList(citations: CitationData[]): void {
    const listContainer = this.container.querySelector('#citations-list');
    if (!listContainer) return;

    if (citations.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No citations found for the selected filter.</p>
        </div>
      `;
      return;
    }

    const citationsHtml = citations.map(citation => this.renderCitationItem(citation)).join('');
    listContainer.innerHTML = citationsHtml;

    // Add event listeners for citation items
    this.addCitationItemListeners(listContainer);
  }

  private renderCitationItem(citation: CitationData): string {
    const timeAgo = this.getTimeAgo(citation.timestamp);
    const keyMetrics = citation.extractedMetrics?.slice(0, 3) || [];

    return `
      <div class="citation-item" data-reference-id="${citation.referenceId}">
        <div class="citation-header">
          <span class="reference-id">${citation.referenceId}</span>
          <span class="tool-name">${citation.toolName}</span>
          <span class="timestamp">${timeAgo}</span>
        </div>

        ${keyMetrics.length > 0 ? `
          <div class="key-metrics">
            ${keyMetrics.map(metric => `
              <div class="metric-item metric-${metric.significance}">
                <span class="metric-label">${metric.label}:</span>
                <span class="metric-value">${metric.value}${metric.unit ? ' ' + metric.unit : ''}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="citation-actions">
          <button class="btn-view-details" data-reference-id="${citation.referenceId}">
            View Details
          </button>
          <button class="btn-copy-data" data-reference-id="${citation.referenceId}">
            Copy Data
          </button>
        </div>
      </div>
    `;
  }

  private addCitationItemListeners(container: Element): void {
    // View details buttons
    container.querySelectorAll('.btn-view-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const referenceId = (e.target as HTMLElement).dataset.referenceId;
        if (referenceId) {
          this.showCitationDetails(referenceId);
        }
      });
    });

    // Copy data buttons
    container.querySelectorAll('.btn-copy-data').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const referenceId = (e.target as HTMLElement).dataset.referenceId;
        if (referenceId) {
          this.copyCitationData(referenceId);
        }
      });
    });
  }

  private showCitationDetails(referenceId: string): void {
    const citation = citationStore.getCitation(referenceId);
    if (!citation) {
      console.warn(`Citation ${referenceId} not found`);
      return;
    }

    this.showDetailModal(citation);
  }

  private showDetailModal(citation: CitationData): void {
    const overlay = document.createElement('div');
    overlay.className = 'verification-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'verification-modal';

    modal.innerHTML = `
      <div class="modal-header">
        <h3>Citation Details: ${citation.referenceId}</h3>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-content">
        <div class="citation-metadata">
          <div class="metadata-item">
            <strong>Tool:</strong> ${citation.toolName}
          </div>
          <div class="metadata-item">
            <strong>Timestamp:</strong> ${citationProcessor.formatTimestamp(citation.timestamp)}
          </div>
          ${citation.endpoint ? `
            <div class="metadata-item">
              <strong>Endpoint:</strong> ${citation.endpoint}
            </div>
          ` : ''}
        </div>

        ${citation.extractedMetrics && citation.extractedMetrics.length > 0 ? `
          <div class="extracted-metrics">
            <h4>Extracted Metrics</h4>
            <div class="metrics-grid">
              ${citation.extractedMetrics.map(metric => `
                <div class="metric-card metric-${metric.significance}">
                  <div class="metric-type">${metric.type}</div>
                  <div class="metric-label">${metric.label}</div>
                  <div class="metric-value">${metric.value}${metric.unit ? ' ' + metric.unit : ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="raw-data-section">
          <div class="section-header">
            <h4>Raw Data</h4>
            <button class="btn-copy-json" data-json='${JSON.stringify(citation.rawData)}'>
              Copy JSON
            </button>
          </div>
          <pre class="json-viewer"><code>${this.formatJSON(citation.rawData)}</code></pre>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const copyBtn = modal.querySelector('.btn-copy-json');

    const closeModal = () => overlay.remove();

    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    copyBtn?.addEventListener('click', (e) => {
      const jsonData = (e.target as HTMLElement).dataset.json;
      if (jsonData) {
        this.copyToClipboard(jsonData);
      }
    });

    // Close on Escape
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }

  private copyCitationData(referenceId: string): void {
    const citation = citationStore.getCitation(referenceId);
    if (!citation) {
      console.warn(`Citation ${referenceId} not found`);
      return;
    }

    const dataToExport = {
      referenceId: citation.referenceId,
      timestamp: citation.timestamp,
      toolName: citation.toolName,
      endpoint: citation.endpoint,
      extractedMetrics: citation.extractedMetrics,
      rawData: citation.rawData
    };

    this.copyToClipboard(JSON.stringify(dataToExport, null, 2));
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Data copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      this.showToast('Failed to copy data', 'error');
    });
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const toast = document.createElement('div');
    toast.className = `verification-toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  private formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private getTimeAgo(timestamp: string): string {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  public destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}
