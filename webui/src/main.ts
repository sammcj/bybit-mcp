/**
 * Main application entry point
 */

console.log('🚀 Main.ts loading...');

import './styles/main.css';

import { ChatApp } from './components/ChatApp';
import { configService } from './services/configService';
import { mcpClient } from './services/mcpClient';
import { aiClient } from './services/aiClient';

class App {
  private chatApp?: ChatApp;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Show loading state
      this.showLoading();

      // Initialize services
      await this.initializeServices();

      // Initialize UI components
      this.initializeUI();

      // Hide loading and show main app
      this.hideLoading();

      this.isInitialized = true;
      console.log('✅ Bybit MCP WebUI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize application:', error);
      this.showError('Failed to initialize application. Please check your configuration.');
    }
  }

  private async initializeServices(): Promise<void> {
    console.log('🚀 Initializing services...');

    // Get current configuration
    const aiConfig = configService.getAIConfig();
    const mcpConfig = configService.getMCPConfig();

    console.log('⚙️ AI Config:', {
      endpoint: aiConfig.endpoint,
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      maxTokens: aiConfig.maxTokens
    });
    console.log('⚙️ MCP Config:', mcpConfig);

    // Note: MCP server should be started automatically with 'pnpm dev:full'
    console.log('💡 If MCP server is not running, use "pnpm dev:full" to start both services');

    // Update clients with current config
    aiClient.updateConfig(aiConfig);
    mcpClient.setBaseUrl(mcpConfig.endpoint);
    mcpClient.setTimeout(mcpConfig.timeout);

    // Test connections
    console.log('🔄 Testing connections...');
    const [aiConnected, mcpConnected] = await Promise.allSettled([
      aiClient.isConnected(),
      mcpClient.isConnected(),
    ]);

    console.log('📊 Connection results:', {
      ai: aiConnected.status === 'fulfilled' ? aiConnected.value : aiConnected.reason,
      mcp: mcpConnected.status === 'fulfilled' ? mcpConnected.value : mcpConnected.reason
    });

    // Initialize MCP client (fetch available tools)
    if (mcpConnected.status === 'fulfilled' && mcpConnected.value) {
      try {
        await mcpClient.initialize();
        console.log('✅ MCP client initialized');
      } catch (error) {
        console.warn('⚠️ MCP client initialization failed:', error);
      }
    } else {
      console.warn('⚠️ MCP server not reachable');
    }

    // Log connection status
    if (aiConnected.status === 'fulfilled' && aiConnected.value) {
      console.log('✅ AI service connected');
    } else {
      console.warn('⚠️ AI service not reachable');
    }

    console.log('✅ Service initialization complete');
  }

  private initializeUI(): void {
    // Initialize chat application
    this.chatApp = new ChatApp();

    // Set up global event listeners
    this.setupGlobalEventListeners();

    // Set up theme toggle
    this.setupThemeToggle();

    // Set up settings modal
    this.setupSettingsModal();
  }

  private setupGlobalEventListeners(): void {
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      // Ctrl/Cmd + K to focus chat input
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
        if (chatInput) {
          chatInput.focus();
        }
      }

      // Escape to close modals
      if (event.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Handle navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (event) => {
        const target = event.currentTarget as HTMLElement;
        const view = target.dataset.view;
        if (view) {
          this.switchView(view);
        }
      });
    });

    // Handle example queries
    document.querySelectorAll('.example-query').forEach(button => {
      button.addEventListener('click', (event) => {
        const target = event.currentTarget as HTMLElement;
        const query = target.textContent?.trim();
        if (query && this.chatApp) {
          this.chatApp.sendMessage(query);
        }
      });
    });
  }

  private setupThemeToggle(): void {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const settings = configService.getSettings();
        const currentTheme = settings.ui.theme;

        let newTheme: 'light' | 'dark' | 'auto';
        let icon: string;

        if (currentTheme === 'light') {
          newTheme = 'dark';
          icon = '☀️';
        } else if (currentTheme === 'dark') {
          newTheme = 'auto';
          icon = '🌓';
        } else {
          newTheme = 'light';
          icon = '🌙';
        }

        configService.updateSettings({
          ui: { ...settings.ui, theme: newTheme },
        });

        // Update icon
        const iconElement = themeToggle.querySelector('.theme-icon');
        if (iconElement) {
          iconElement.textContent = icon;
        }
      });
    }
  }

  private setupSettingsModal(): void {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    if (closeSettings && settingsModal) {
      closeSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
    }

    if (saveSettings) {
      saveSettings.addEventListener('click', () => {
        this.saveSettingsFromModal();
      });
    }

    // Close modal when clicking backdrop
    if (settingsModal) {
      settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
          settingsModal.classList.add('hidden');
        }
      });
    }
  }

  private openSettingsModal(): void {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // Populate current settings
    const settings = configService.getSettings();

    const aiEndpoint = document.getElementById('ai-endpoint') as HTMLInputElement;
    const aiModel = document.getElementById('ai-model') as HTMLInputElement;
    const mcpEndpoint = document.getElementById('mcp-endpoint') as HTMLInputElement;

    if (aiEndpoint) aiEndpoint.value = settings.ai.endpoint;
    if (aiModel) aiModel.value = settings.ai.model;
    if (mcpEndpoint) mcpEndpoint.value = settings.mcp.endpoint;

    modal.classList.remove('hidden');
  }

  private saveSettingsFromModal(): void {
    const aiEndpoint = document.getElementById('ai-endpoint') as HTMLInputElement;
    const aiModel = document.getElementById('ai-model') as HTMLInputElement;
    const mcpEndpoint = document.getElementById('mcp-endpoint') as HTMLInputElement;

    const currentSettings = configService.getSettings();
    const updates: Partial<typeof currentSettings> = {};

    if (aiEndpoint?.value) {
      updates.ai = { ...configService.getAIConfig(), endpoint: aiEndpoint.value };
    }

    if (aiModel?.value) {
      updates.ai = { ...updates.ai, ...configService.getAIConfig(), model: aiModel.value };
    }

    if (mcpEndpoint?.value) {
      updates.mcp = { ...configService.getMCPConfig(), endpoint: mcpEndpoint.value };
    }

    if (Object.keys(updates).length > 0) {
      configService.updateSettings(updates);

      // Reinitialize services with new config
      this.initializeServices().catch(console.error);
    }

    // Close modal
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  private switchView(viewName: string): void {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
    if (activeNavItem) {
      activeNavItem.classList.add('active');
    }

    // Update views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`${viewName}-view`);
    if (activeView) {
      activeView.classList.add('active');
    }
  }

  private closeAllModals(): void {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
    });
  }

  private showLoading(): void {
    const loading = document.getElementById('loading');
    const mainContainer = document.getElementById('main-container');

    if (loading) loading.classList.remove('hidden');
    if (mainContainer) mainContainer.classList.add('hidden');
  }

  private hideLoading(): void {
    const loading = document.getElementById('loading');
    const mainContainer = document.getElementById('main-container');

    if (loading) loading.classList.add('hidden');
    if (mainContainer) mainContainer.classList.remove('hidden');
  }

  private showError(message: string): void {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `
        <div class="loading-container">
          <div style="color: var(--color-danger); text-align: center;">
            <h2>❌ Error</h2>
            <p>${message}</p>
            <button onclick="location.reload()" style="
              margin-top: 1rem;
              padding: 0.5rem 1rem;
              background: var(--color-primary);
              color: white;
              border: none;
              border-radius: 0.5rem;
              cursor: pointer;
            ">Reload Page</button>
          </div>
        </div>
      `;
    }
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.initialize().catch(console.error);
});

// Handle unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
