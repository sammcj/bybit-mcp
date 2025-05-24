/**
 * Configuration service for managing application settings
 */

import type { ChatSettings, AIConfig } from '@/types/ai';

const STORAGE_KEY = 'bybit-mcp-webui-settings';

const DEFAULT_SETTINGS: ChatSettings = {
  ai: {
    endpoint: 'http://localhost:11434',
    model: 'qwen3-30b-a3b-ud-128k-nothink:q4_k_xl',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: `You are an AI assistant specialised in cryptocurrency trading and market analysis. You have access to the Bybit MCP server which provides real-time market data and advanced technical analysis tools.

Available tools include:
- get_ticker: Get real-time price data for trading pairs
- get_kline: Get candlestick/OHLCV data for charts
- get_orderbook: Get market depth data
- get_ml_rsi: Get ML-enhanced RSI analysis with adaptive thresholds
- get_order_blocks: Detect institutional order accumulation zones
- get_market_structure: Comprehensive market analysis with regime detection

When users ask about market data or analysis:
1. Use the appropriate MCP tools to fetch current data
2. Provide clear, actionable insights
3. Explain technical concepts in an accessible way
4. Include relevant charts and visualisations when possible
5. Always mention the timestamp of data and any limitations

IMPORTANT:
- When calling tools, ensure numeric parameters are passed as numbers, not strings. The system will automatically convert string numbers to proper numeric types, but it's best practice to use correct types.
- For all Bybit tool calls, always include the parameter "includeReferenceId": true to enable data verification.
- When citing specific data from tool responses, include the reference ID in square brackets like [REF001].

Be helpful, accurate, and focused on providing valuable trading insights while emphasising risk management.`,
  },
  mcp: {
    endpoint: 'http://localhost:8080',
    timeout: 30000,
  },
  ui: {
    theme: 'auto',
    fontSize: 'medium',
    showTimestamps: true,
    enableSounds: false,
  },
};

export class ConfigService {
  private settings: ChatSettings;
  private listeners: Set<(settings: ChatSettings) => void> = new Set();

  constructor() {
    this.settings = this.loadSettings();
    this.applyTheme();
  }

  /**
   * Get current settings
   */
  getSettings(): ChatSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<ChatSettings>): void {
    this.settings = this.mergeSettings(this.settings, updates);
    this.saveSettings();
    this.applyTheme();
    this.notifyListeners();
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.applyTheme();
    this.notifyListeners();
  }

  /**
   * Get AI configuration
   */
  getAIConfig(): AIConfig {
    return { ...this.settings.ai };
  }

  /**
   * Update AI configuration
   */
  updateAIConfig(config: Partial<AIConfig>): void {
    this.updateSettings({
      ai: { ...this.settings.ai, ...config },
    });
  }

  /**
   * Get MCP configuration
   */
  getMCPConfig(): { endpoint: string; timeout: number } {
    return { ...this.settings.mcp };
  }

  /**
   * Update MCP configuration
   */
  updateMCPConfig(config: Partial<{ endpoint: string; timeout: number }>): void {
    this.updateSettings({
      mcp: { ...this.settings.mcp, ...config },
    });
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: (settings: ChatSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Apply theme to document
   */
  private applyTheme(): void {
    const { theme } = this.settings.ui;
    const root = document.documentElement;

    if (theme === 'auto') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }

    // Apply font size
    const { fontSize } = this.settings.ui;
    root.setAttribute('data-font-size', fontSize);
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): ChatSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.mergeSettings(DEFAULT_SETTINGS, parsed);
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }

    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
  }

  /**
   * Deep merge settings objects
   */
  private mergeSettings(base: ChatSettings, updates: Partial<ChatSettings>): ChatSettings {
    return {
      ai: { ...base.ai, ...updates.ai },
      mcp: { ...base.mcp, ...updates.mcp },
      ui: { ...base.ui, ...updates.ui },
    };
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.settings);
      } catch (error) {
        console.error('Error in settings listener:', error);
      }
    });
  }
}

// Singleton instance
export const configService = new ConfigService();

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const settings = configService.getSettings();
    if (settings.ui.theme === 'auto') {
      configService.updateSettings({}); // Trigger theme reapplication
    }
  });
}

// Export convenience functions
export function getAIConfig(): AIConfig {
  return configService.getAIConfig();
}

export function getMCPConfig(): { endpoint: string; timeout: number } {
  return configService.getMCPConfig();
}

export function updateAIConfig(config: Partial<AIConfig>): void {
  configService.updateAIConfig(config);
}

export function updateMCPConfig(config: Partial<{ endpoint: string; timeout: number }>): void {
  configService.updateMCPConfig(config);
}

export function toggleTheme(): void {
  const settings = configService.getSettings();
  const currentTheme = settings.ui.theme;

  let newTheme: 'light' | 'dark' | 'auto';
  if (currentTheme === 'light') {
    newTheme = 'dark';
  } else if (currentTheme === 'dark') {
    newTheme = 'auto';
  } else {
    newTheme = 'light';
  }

  configService.updateSettings({
    ui: { ...settings.ui, theme: newTheme },
  });
}
