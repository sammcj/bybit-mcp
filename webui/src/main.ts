/**
 * Main application entry point
 */

console.log('🚀 Main.ts loading...');

import './styles/main.css';

import { ChatApp } from './components/ChatApp';
import { DebugConsole } from './components/DebugConsole';
import { DataVerificationPanel } from './components/DataVerificationPanel';
import { AgentDashboard } from './components/AgentDashboard';
import { toolsManager } from './components/ToolsManager';
import { configService } from './services/configService';
import { agentConfigService } from './services/agentConfig';
import { mcpClient } from './services/mcpClient';
import { aiClient } from './services/aiClient';
import { multiStepAgent } from './services/multiStepAgent';
// Import logService to initialize console interception
import './services/logService';

class App {
  private chatApp?: ChatApp;
  private debugConsole?: DebugConsole;
  private verificationPanel?: DataVerificationPanel;
  private agentDashboard?: AgentDashboard;
  private isInitialized = false;
  private toolsInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Show loading state
      this.showLoading();

      // Initialize services
      await this.initializeServices();

      // Initialize UI components
      this.initializeUI();

      // Initialize debug console
      this.initializeDebugConsole();

      // Initialize data verification panel
      this.initializeVerificationPanel();

      // Initialize agent dashboard
      this.initializeAgentDashboard();

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

    // Initialize multi-step agent
    try {
      console.log('🤖 Initializing multi-step agent...');
      await multiStepAgent.initialize();
      console.log('✅ Multi-step agent initialized');
    } catch (error) {
      console.warn('⚠️ Multi-step agent initialization failed:', error);
      console.log('💡 Falling back to legacy AI client');
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

    // Agent settings button removed - now integrated into main settings modal

    // Handle agent mode toggle
    const agentToggleBtn = document.getElementById('agent-toggle-btn');
    if (agentToggleBtn && this.chatApp) {
      agentToggleBtn.addEventListener('click', () => {
        const isUsingAgent = this.chatApp!.isUsingAgent();
        this.chatApp!.toggleAgentMode(!isUsingAgent);
        agentToggleBtn.textContent = !isUsingAgent ? '🤖 Agent Mode' : '🔄 Legacy Mode';
      });
    }
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

  private setupAgentDashboardButton(): void {
    const agentDashboardBtn = document.getElementById('agent-dashboard-btn');
    if (agentDashboardBtn && this.agentDashboard) {
      agentDashboardBtn.addEventListener('click', () => {
        this.agentDashboard!.toggleVisibility();

        // Update button appearance based on dashboard visibility
        const isVisible = this.agentDashboard!.visible;
        if (isVisible) {
          agentDashboardBtn.classList.add('active');
        } else {
          agentDashboardBtn.classList.remove('active');
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
        settingsModal.classList.remove('active');
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
          settingsModal.classList.remove('active');
        }
      });
    }
  }

  private initializeDebugConsole(): void {
    // Create debug console container
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debug-console-container';
    document.body.appendChild(debugContainer);

    // Initialize debug console
    this.debugConsole = new DebugConsole(debugContainer);

    // Add keyboard shortcut to toggle debug console (Ctrl+` or Cmd+`)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        this.debugConsole?.toggle();
      }
    });

    console.log('🔍 Debug console initialized (Ctrl+` to toggle)');
  }

  private initializeVerificationPanel(): void {
    try {
      // Initialize data verification panel
      this.verificationPanel = new DataVerificationPanel('verification-panel-container');
      console.log('📊 Data verification panel initialized (Ctrl+D to toggle)');

      // Make panel accessible for debugging
      (window as any).verificationPanel = this.verificationPanel;
    } catch (error) {
      console.warn('⚠️ Failed to initialize verification panel:', error);
    }
  }

  private initializeAgentDashboard(): void {
    try {
      // Initialize agent dashboard with ChatApp reference
      this.agentDashboard = new AgentDashboard('agent-dashboard-container', this.chatApp);
      console.log('🤖 Agent dashboard initialized (Ctrl+M to toggle)');

      // Set up agent dashboard button now that dashboard is initialized
      this.setupAgentDashboardButton();

      // Make dashboard accessible for debugging
      (window as any).agentDashboard = this.agentDashboard;
    } catch (error) {
      console.warn('⚠️ Failed to initialize agent dashboard:', error);
    }
  }

  private openSettingsModal(): void {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // Populate current settings
    const settings = configService.getSettings();
    const agentConfig = agentConfigService.getConfig();
    console.log('🔧 Opening settings modal with current settings:', settings, agentConfig);

    // AI Configuration
    const aiEndpoint = document.getElementById('ai-endpoint') as HTMLInputElement;
    const aiModel = document.getElementById('ai-model') as HTMLInputElement;
    const mcpEndpoint = document.getElementById('mcp-endpoint') as HTMLInputElement;

    if (aiEndpoint) {
      aiEndpoint.value = settings.ai.endpoint;
      console.log('📝 Set AI endpoint field to:', settings.ai.endpoint);
    }
    if (aiModel) {
      aiModel.value = settings.ai.model;
      console.log('📝 Set AI model field to:', settings.ai.model);
    }
    if (mcpEndpoint) {
      mcpEndpoint.value = settings.mcp.endpoint;
      console.log('📝 Set MCP endpoint field to:', settings.mcp.endpoint);
    }

    // Agent Configuration
    const agentModeEnabled = document.getElementById('agent-mode-enabled') as HTMLInputElement;
    const maxIterations = document.getElementById('max-iterations') as HTMLInputElement;
    const toolTimeout = document.getElementById('tool-timeout') as HTMLInputElement;
    const showWorkflowSteps = document.getElementById('show-workflow-steps') as HTMLInputElement;
    const showToolCalls = document.getElementById('show-tool-calls') as HTMLInputElement;
    const enableDebugMode = document.getElementById('enable-debug-mode') as HTMLInputElement;

    if (agentModeEnabled) {
      agentModeEnabled.checked = this.chatApp?.isAgentModeEnabled() || false;
    }
    if (maxIterations) {
      maxIterations.value = agentConfig.maxIterations.toString();
    }
    if (toolTimeout) {
      toolTimeout.value = agentConfig.toolTimeout.toString();
    }
    if (showWorkflowSteps) {
      showWorkflowSteps.checked = agentConfig.showWorkflowSteps;
    }
    if (showToolCalls) {
      showToolCalls.checked = agentConfig.showToolCalls;
    }
    if (enableDebugMode) {
      enableDebugMode.checked = agentConfig.enableDebugMode;
    }

    modal.classList.remove('hidden');
    modal.classList.add('active');
  }

  private saveSettingsFromModal(): void {
    const aiEndpoint = document.getElementById('ai-endpoint') as HTMLInputElement;
    const aiModel = document.getElementById('ai-model') as HTMLInputElement;
    const mcpEndpoint = document.getElementById('mcp-endpoint') as HTMLInputElement;

    // Agent Configuration elements
    const agentModeEnabled = document.getElementById('agent-mode-enabled') as HTMLInputElement;
    const maxIterations = document.getElementById('max-iterations') as HTMLInputElement;
    const toolTimeout = document.getElementById('tool-timeout') as HTMLInputElement;
    const showWorkflowSteps = document.getElementById('show-workflow-steps') as HTMLInputElement;
    const showToolCalls = document.getElementById('show-tool-calls') as HTMLInputElement;
    const enableDebugMode = document.getElementById('enable-debug-mode') as HTMLInputElement;

    console.log('💾 Saving settings from modal...');
    console.log('AI Endpoint:', aiEndpoint?.value);
    console.log('AI Model:', aiModel?.value);
    console.log('MCP Endpoint:', mcpEndpoint?.value);
    console.log('Agent Mode:', agentModeEnabled?.checked);

    const currentSettings = configService.getSettings();
    const updates: Partial<typeof currentSettings> = {};

    // Build AI config updates
    const aiUpdates: Partial<typeof currentSettings.ai> = {};
    let hasAIUpdates = false;

    if (aiEndpoint?.value && aiEndpoint.value.trim() !== '') {
      aiUpdates.endpoint = aiEndpoint.value.trim();
      hasAIUpdates = true;
    }

    if (aiModel?.value && aiModel.value.trim() !== '') {
      aiUpdates.model = aiModel.value.trim();
      hasAIUpdates = true;
    }

    if (hasAIUpdates) {
      updates.ai = { ...currentSettings.ai, ...aiUpdates };
    }

    // Build MCP config updates
    if (mcpEndpoint?.value && mcpEndpoint.value.trim() !== '') {
      updates.mcp = { ...currentSettings.mcp, endpoint: mcpEndpoint.value.trim() };
    }

    console.log('📝 Settings updates:', updates);

    if (Object.keys(updates).length > 0) {
      configService.updateSettings(updates);
      console.log('✅ Settings saved successfully');

      // Reinitialize services with new config
      this.initializeServices().catch(console.error);
    } else {
      console.log('ℹ️ No settings changes to save');
    }

    // Save agent configuration
    const agentConfig = {
      maxIterations: parseInt(maxIterations?.value || '5'),
      toolTimeout: parseInt(toolTimeout?.value || '30000'),
      showWorkflowSteps: showWorkflowSteps?.checked || false,
      showToolCalls: showToolCalls?.checked || false,
      enableDebugMode: enableDebugMode?.checked || false,
      streamingEnabled: true // Always enabled
    };

    console.log('🤖 Saving agent config:', agentConfig);
    agentConfigService.updateConfig(agentConfig);

    // Update agent mode in chat app
    if (this.chatApp && agentModeEnabled) {
      this.chatApp.toggleAgentMode(agentModeEnabled.checked);
    }

    // Close modal
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('active');
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

    // Initialize components when their views are accessed
    if (viewName === 'tools' && !this.toolsInitialized) {
      this.initializeTools();
    }

    // Handle dashboard view - embed agent dashboard into the tab
    if (viewName === 'dashboard' && this.agentDashboard) {
      this.embedDashboardInTab();
    }
  }

  /**
   * Initialize tools when tools tab is first accessed
   */
  private async initializeTools(): Promise<void> {
    if (this.toolsInitialized) return;

    try {
      console.log('🔧 Initializing tools...');
      await toolsManager.initialize();
      this.toolsInitialized = true;
      console.log('✅ Tools initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize tools:', error);
    }
  }

  /**
   * Embed agent dashboard into the dashboard tab view
   */
  private embedDashboardInTab(): void {
    if (!this.agentDashboard) return;

    const dashboardWrapper = document.getElementById('dashboard-content-wrapper');
    const agentDashboardContainer = document.getElementById('agent-dashboard-container');

    if (dashboardWrapper && agentDashboardContainer) {
      // Check if dashboard content already exists in the tab
      if (dashboardWrapper.querySelector('.agent-dashboard')) {
        return; // Already embedded
      }

      // Get the dashboard content from the original container
      const dashboardContent = agentDashboardContainer.querySelector('.agent-dashboard');

      if (dashboardContent) {
        // Clone the dashboard content for the tab view
        const clonedContent = dashboardContent.cloneNode(true) as HTMLElement;

        // Remove overlay-specific classes and styles
        clonedContent.classList.remove('hidden');
        clonedContent.classList.add('visible');
        clonedContent.style.position = 'static';
        clonedContent.style.zIndex = 'auto';
        clonedContent.style.background = 'transparent';
        clonedContent.style.boxShadow = 'none';
        clonedContent.style.border = 'none';
        clonedContent.style.borderRadius = '0';
        clonedContent.style.width = '100%';
        clonedContent.style.height = '100%';
        clonedContent.style.maxWidth = 'none';
        clonedContent.style.maxHeight = 'none';
        clonedContent.style.transform = 'none';
        clonedContent.style.top = 'auto';
        clonedContent.style.left = 'auto';
        clonedContent.style.right = 'auto';
        clonedContent.style.bottom = 'auto';

        // Add the cloned content to the tab view
        dashboardWrapper.innerHTML = '';
        dashboardWrapper.appendChild(clonedContent);

        // Set up event listeners for the cloned content
        this.setupTabDashboardEventListeners(clonedContent);

        // Debug: Check what data is available
        console.log('🔍 Dashboard data check:');
        console.log('Memory stats:', multiStepAgent.getMemoryStats());
        console.log('Performance stats:', multiStepAgent.getPerformanceStats());
        console.log('Analysis history:', multiStepAgent.getAnalysisHistory(undefined, 5));

        // Refresh the dashboard data
        this.agentDashboard.show(); // This will trigger a refresh
        this.agentDashboard.hide(); // Hide the overlay version
      }
    }
  }

  /**
   * Set up event listeners for the dashboard in tab view
   */
  private setupTabDashboardEventListeners(dashboardElement: HTMLElement): void {
    // Refresh button
    const refreshBtn = dashboardElement.querySelector('#dashboard-refresh') as HTMLButtonElement;
    refreshBtn?.addEventListener('click', () => {
      if (this.agentDashboard) {
        // Trigger refresh and then update the tab view
        this.agentDashboard.show();
        this.agentDashboard.hide();
        setTimeout(() => this.embedDashboardInTab(), 100);
      }
    });

    // Clear memory button
    const clearMemoryBtn = dashboardElement.querySelector('#clear-memory') as HTMLButtonElement;
    clearMemoryBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all agent memory? This action cannot be undone.')) {
        multiStepAgent.clearMemory();
        // Refresh the tab view
        setTimeout(() => this.embedDashboardInTab(), 100);
        this.showToast('Memory cleared successfully!');
      }
    });

    // New conversation button
    const newConversationBtn = dashboardElement.querySelector('#new-conversation') as HTMLButtonElement;
    newConversationBtn?.addEventListener('click', () => {
      // Clear agent memory
      multiStepAgent.startNewConversation();

      // Clear chat UI if available
      if (this.chatApp) {
        this.chatApp.clearMessages();
      }

      this.showToast('New conversation started!');
    });

    // Export data button
    const exportDataBtn = dashboardElement.querySelector('#export-data') as HTMLButtonElement;
    exportDataBtn?.addEventListener('click', () => {
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
    });
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

  private closeAllModals(): void {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
      modal.classList.remove('active');
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
