/**
 * Agent Dashboard - Shows memory, performance, and analysis statistics
 */

import { multiStepAgent } from '@/services/multiStepAgent';
import type { ChatApp } from './ChatApp';

// Interface for memory statistics
interface MemoryStats {
  conversations: number;
  marketContexts: number;
  analysisHistory: number;
  totalSymbols: number;
}

export class AgentDashboard {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private chatApp?: ChatApp;

  constructor(containerId: string, chatApp?: ChatApp) {
    this.container = document.getElementById(containerId)!;
    if (!this.container) {
      throw new Error(`Container element with id "${containerId}" not found`);
    }

    this.chatApp = chatApp;
    this.initialize();
  }

  private initialize(): void {
    this.createDashboardStructure();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  private createDashboardStructure(): void {
    this.container.innerHTML = `
      <div class="agent-dashboard ${this.isVisible ? 'visible' : 'hidden'}">
        <div class="dashboard-header">
          <h3>Agent Dashboard</h3>
          <div class="dashboard-controls">
            <button class="refresh-btn" id="dashboard-refresh" aria-label="Refresh dashboard">
              🔄
            </button>
            <button class="toggle-btn" id="dashboard-toggle" aria-label="Toggle dashboard">
              📊
            </button>
          </div>
        </div>

        <div class="dashboard-content">
          <!-- Empty State Notice -->
          <div class="dashboard-notice" id="dashboard-notice" style="display: none;">
            <div class="notice-content">
              <h4>🤖 Agent Dashboard</h4>
              <p>This dashboard will show agent performance metrics, memory usage, and analysis history once you start using the agent mode.</p>
              <p><strong>To get started:</strong></p>
              <ol>
                <li>Enable Agent Mode in Settings (⚙️)</li>
                <li>Ask questions about cryptocurrency markets</li>
                <li>Watch the dashboard populate with data!</li>
              </ol>
            </div>
          </div>

          <!-- Memory Statistics -->
          <div class="dashboard-section">
            <h4>Memory Statistics</h4>
            <div class="stats-grid" id="memory-stats">
              <div class="stat-item">
                <span class="stat-label">Conversations:</span>
                <span class="stat-value" id="memory-conversations">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Market Contexts:</span>
                <span class="stat-value" id="memory-contexts">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Analysis History:</span>
                <span class="stat-value" id="memory-analyses">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Tracked Symbols:</span>
                <span class="stat-value" id="memory-symbols">0</span>
              </div>
            </div>
          </div>

          <!-- Performance Statistics -->
          <div class="dashboard-section">
            <h4>Performance Statistics</h4>
            <div class="stats-grid" id="performance-stats">
              <div class="stat-item">
                <span class="stat-label">Success Rate:</span>
                <span class="stat-value" id="perf-success-rate">0%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Avg Tool Time:</span>
                <span class="stat-value" id="perf-avg-time">0ms</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Parallel Savings:</span>
                <span class="stat-value" id="perf-savings">0ms</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Tools:</span>
                <span class="stat-value" id="perf-tool-count">0</span>
              </div>
            </div>
          </div>

          <!-- Recent Analysis -->
          <div class="dashboard-section">
            <h4>Recent Analysis</h4>
            <div class="analysis-list" id="recent-analysis">
              <div class="empty-state">
                <p>No recent analysis available.</p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="dashboard-section">
            <h4>Actions</h4>
            <div class="action-buttons">
              <button class="action-btn" id="clear-memory">Clear Memory</button>
              <button class="action-btn" id="new-conversation">New Conversation</button>
              <button class="action-btn" id="export-data">Export Data</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Toggle dashboard visibility
    const toggleBtn = this.container.querySelector('#dashboard-toggle') as HTMLButtonElement;
    toggleBtn?.addEventListener('click', () => {
      this.toggleVisibility();
    });

    // Refresh dashboard
    const refreshBtn = this.container.querySelector('#dashboard-refresh') as HTMLButtonElement;
    refreshBtn?.addEventListener('click', () => {
      this.refreshDashboard();
    });

    // Clear memory
    const clearMemoryBtn = this.container.querySelector('#clear-memory') as HTMLButtonElement;
    clearMemoryBtn?.addEventListener('click', () => {
      this.clearMemory();
    });

    // New conversation
    const newConversationBtn = this.container.querySelector('#new-conversation') as HTMLButtonElement;
    newConversationBtn?.addEventListener('click', () => {
      this.startNewConversation();
    });

    // Export data
    const exportDataBtn = this.container.querySelector('#export-data') as HTMLButtonElement;
    exportDataBtn?.addEventListener('click', () => {
      this.exportData();
    });

    // Keyboard shortcut to toggle dashboard (Ctrl/Cmd + M)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        this.toggleVisibility();
      }
    });
  }

  private startAutoRefresh(): void {
    // Refresh every 5 seconds when dashboard is visible
    this.refreshInterval = setInterval(() => {
      if (this.isVisible) {
        this.refreshDashboard();
      }
    }, 5000);
  }

  public toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    const dashboard = this.container.querySelector('.agent-dashboard');

    if (this.isVisible) {
      dashboard?.classList.remove('hidden');
      dashboard?.classList.add('visible');
      this.refreshDashboard();
    } else {
      dashboard?.classList.remove('visible');
      dashboard?.classList.add('hidden');
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

  public get visible(): boolean {
    return this.isVisible;
  }

  private refreshDashboard(): void {
    this.updateMemoryStats();
    this.updatePerformanceStats();
    this.updateRecentAnalysis();
  }

  private updateMemoryStats(): void {
    try {
      const memoryStats = multiStepAgent.getMemoryStats();

      const conversationsEl = this.container.querySelector('#memory-conversations');
      const contextsEl = this.container.querySelector('#memory-contexts');
      const analysesEl = this.container.querySelector('#memory-analyses');
      const symbolsEl = this.container.querySelector('#memory-symbols');

      if (conversationsEl) conversationsEl.textContent = memoryStats.conversations.toString();
      if (contextsEl) contextsEl.textContent = memoryStats.marketContexts.toString();
      if (analysesEl) analysesEl.textContent = memoryStats.analysisHistory.toString();
      if (symbolsEl) symbolsEl.textContent = memoryStats.totalSymbols.toString();

      // Show helpful message if no data yet
      this.updateEmptyStateMessage(memoryStats);

    } catch (error) {
      console.warn('Failed to update memory stats:', error);
    }
  }

  private updatePerformanceStats(): void {
    try {
      const perfStats = multiStepAgent.getPerformanceStats();

      const successRateEl = this.container.querySelector('#perf-success-rate');
      const avgTimeEl = this.container.querySelector('#perf-avg-time');
      const savingsEl = this.container.querySelector('#perf-savings');
      const toolCountEl = this.container.querySelector('#perf-tool-count');

      if (successRateEl) {
        successRateEl.textContent = `${(perfStats.successRate * 100).toFixed(1)}%`;
      }
      if (avgTimeEl) {
        avgTimeEl.textContent = `${Math.round(perfStats.averageToolTime)}ms`;
      }
      if (savingsEl) {
        savingsEl.textContent = `${Math.round(perfStats.parallelSavings)}ms`;
      }
      if (toolCountEl) {
        toolCountEl.textContent = perfStats.toolCount.toString();
      }

    } catch (error) {
      console.warn('Failed to update performance stats:', error);
    }
  }

  private updateRecentAnalysis(): void {
    try {
      const recentAnalysis = multiStepAgent.getAnalysisHistory(undefined, 5);
      const listContainer = this.container.querySelector('#recent-analysis');

      if (!listContainer) return;

      if (recentAnalysis.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <p>No recent analysis available.</p>
          </div>
        `;
        return;
      }

      const analysisHtml = recentAnalysis.map(analysis => `
        <div class="analysis-item">
          <div class="analysis-header">
            <span class="analysis-symbol">${analysis.symbol}</span>
            <span class="analysis-type">${analysis.analysisType}</span>
            <span class="analysis-time">${this.getTimeAgo(analysis.timestamp)}</span>
          </div>
          <div class="analysis-query">${this.truncateText(analysis.query, 60)}</div>
          <div class="analysis-metrics">
            <span class="metric">Duration: ${analysis.duration}ms</span>
            <span class="metric">Tools: ${analysis.toolsUsed.length}</span>
            ${analysis.accuracy ? `<span class="metric">Accuracy: ${(analysis.accuracy * 100).toFixed(0)}%</span>` : ''}
          </div>
        </div>
      `).join('');

      listContainer.innerHTML = analysisHtml;

    } catch (error) {
      console.warn('Failed to update recent analysis:', error);
    }
  }

  private clearMemory(): void {
    if (confirm('Are you sure you want to clear all agent memory? This action cannot be undone.')) {
      multiStepAgent.clearMemory();
      this.refreshDashboard();
      this.showToast('Memory cleared successfully!');
    }
  }

  private startNewConversation(): void {
    // Clear agent memory
    multiStepAgent.startNewConversation();

    // Clear chat UI if available
    if (this.chatApp) {
      this.chatApp.clearMessages();
    }

    this.showToast('New conversation started!');
  }

  private exportData(): void {
    try {
      const data = {
        memoryStats: multiStepAgent.getMemoryStats(),
        performanceStats: multiStepAgent.getPerformanceStats(),
        recentAnalysis: multiStepAgent.getAnalysisHistory(undefined, 20),
        exportedAt: new Date().toISOString()
      };

      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('Data exported successfully!');

    } catch (error) {
      console.error('Failed to export data:', error);
      this.showToast('Failed to export data', 'error');
    }
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const toast = document.createElement('div');
    toast.className = `dashboard-toast toast-${type}`;
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

  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private updateEmptyStateMessage(memoryStats: MemoryStats): void {
    const hasData = memoryStats.conversations > 0 || memoryStats.analysisHistory > 0;

    if (!hasData) {
      // Add notice to dashboard if no data
      const dashboardContent = this.container.querySelector('.dashboard-content');
      if (dashboardContent && !dashboardContent.querySelector('.dashboard-notice')) {
        const notice = document.createElement('div');
        notice.className = 'dashboard-notice';
        notice.innerHTML = `
          <div class="notice-content">
            <h4>🤖 Agent Dashboard</h4>
            <p>This dashboard will show agent performance metrics, memory usage, and analysis history once you start using the agent mode.</p>
            <p><strong>To get started:</strong></p>
            <ol>
              <li>Enable Agent Mode in Settings (⚙️)</li>
              <li>Ask questions about cryptocurrency markets</li>
              <li>Watch the dashboard populate with data!</li>
            </ol>
          </div>
        `;
        dashboardContent.insertBefore(notice, dashboardContent.firstChild);
      }
    } else {
      // Remove notice if data exists
      const notice = this.container.querySelector('.dashboard-notice');
      if (notice) {
        notice.remove();
      }
    }
  }

  public destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}
