/**
 * Debug Console Component - Real-time streaming log viewer
 */

import { logService, type LogEntry } from '../services/logService';

export class DebugConsole {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private autoScroll: boolean = true;
  private filterLevels: Set<LogEntry['level']> = new Set(['log', 'info', 'warn', 'error']);
  private unsubscribe?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.setupEventListeners();
    
    // Subscribe to log updates
    this.unsubscribe = logService.subscribe((logs) => {
      this.updateLogs(logs);
    });
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="debug-console ${this.isVisible ? 'visible' : 'hidden'}">
        <div class="debug-header">
          <div class="debug-title">
            <span class="debug-icon">🔍</span>
            <span>Debug Console</span>
            <span class="debug-count">(${logService.getLogs().length})</span>
          </div>
          <div class="debug-controls">
            <div class="debug-filters">
              <label><input type="checkbox" data-level="log" ${this.filterLevels.has('log') ? 'checked' : ''}> Log</label>
              <label><input type="checkbox" data-level="info" ${this.filterLevels.has('info') ? 'checked' : ''}> Info</label>
              <label><input type="checkbox" data-level="warn" ${this.filterLevels.has('warn') ? 'checked' : ''}> Warn</label>
              <label><input type="checkbox" data-level="error" ${this.filterLevels.has('error') ? 'checked' : ''}> Error</label>
            </div>
            <button class="debug-btn" data-action="clear">Clear</button>
            <button class="debug-btn" data-action="export">Export</button>
            <button class="debug-btn" data-action="scroll-toggle">
              ${this.autoScroll ? '📌' : '📌'}
            </button>
            <button class="debug-btn debug-toggle" data-action="toggle">
              ${this.isVisible ? '▼' : '▲'}
            </button>
          </div>
        </div>
        <div class="debug-content">
          <div class="debug-logs" id="debug-logs"></div>
        </div>
      </div>
    `;

    this.updateLogs(logService.getLogs());
  }

  private setupEventListeners(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');

      switch (action) {
        case 'toggle':
          this.toggle();
          break;
        case 'clear':
          logService.clearLogs();
          break;
        case 'export':
          this.exportLogs();
          break;
        case 'scroll-toggle':
          this.autoScroll = !this.autoScroll;
          target.textContent = this.autoScroll ? '📌' : '📌';
          target.title = this.autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled';
          break;
      }
    });

    this.container.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const level = target.getAttribute('data-level') as LogEntry['level'];
      
      if (level) {
        if (target.checked) {
          this.filterLevels.add(level);
        } else {
          this.filterLevels.delete(level);
        }
        this.updateLogs(logService.getLogs());
      }
    });
  }

  private updateLogs(logs: LogEntry[]): void {
    const logsContainer = this.container.querySelector('#debug-logs') as HTMLElement;
    if (!logsContainer) return;

    // Filter logs by selected levels
    const filteredLogs = logs.filter(log => this.filterLevels.has(log.level));

    // Update count
    const countElement = this.container.querySelector('.debug-count') as HTMLElement;
    if (countElement) {
      countElement.textContent = `(${filteredLogs.length}/${logs.length})`;
    }

    // Render logs
    logsContainer.innerHTML = filteredLogs.map(log => this.renderLogEntry(log)).join('');

    // Auto-scroll to bottom
    if (this.autoScroll && this.isVisible) {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  }

  private renderLogEntry(log: LogEntry): string {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const levelClass = `debug-log-${log.level}`;
    const source = log.source ? ` <span class="debug-source">[${log.source}]</span>` : '';
    
    let dataHtml = '';
    if (log.data) {
      const dataStr = typeof log.data === 'object' 
        ? JSON.stringify(log.data, null, 2) 
        : String(log.data);
      dataHtml = `<div class="debug-data">${this.escapeHtml(dataStr)}</div>`;
    }

    return `
      <div class="debug-log-entry ${levelClass}">
        <div class="debug-log-header">
          <span class="debug-time">${time}</span>
          <span class="debug-level">${log.level.toUpperCase()}</span>
          ${source}
        </div>
        <div class="debug-message">${this.escapeHtml(log.message)}</div>
        ${dataHtml}
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private exportLogs(): void {
    const logs = logService.exportLogs();
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    const debugConsole = this.container.querySelector('.debug-console') as HTMLElement;
    const toggleBtn = this.container.querySelector('.debug-toggle') as HTMLElement;
    
    if (debugConsole) {
      debugConsole.className = `debug-console ${this.isVisible ? 'visible' : 'hidden'}`;
    }
    
    if (toggleBtn) {
      toggleBtn.textContent = this.isVisible ? '▼' : '▲';
    }

    // Auto-scroll when opening
    if (this.isVisible && this.autoScroll) {
      setTimeout(() => {
        const logsContainer = this.container.querySelector('#debug-logs') as HTMLElement;
        if (logsContainer) {
          logsContainer.scrollTop = logsContainer.scrollHeight;
        }
      }, 100);
    }
  }

  public show(): void {
    if (!this.isVisible) {
      this.toggle();
    }
  }

  public hide(): void {
    if (this.isVisible) {
      this.toggle();
    }
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
