/**
 * Main application entry point
 */

console.log('🚀 Main.ts loading...');

import './styles/main.css';

import { ChatApp } from './components/ChatApp';
import { DebugConsole } from './components/DebugConsole';
import { chartManager } from './components/ChartManager';
import { toolsManager } from './components/ToolsManager';
import { analysisManager } from './components/AnalysisManager';
import { configService } from './services/configService';
import { agentConfigService } from './services/agentConfig';
import { mcpClient } from './services/mcpClient';
import { aiClient } from './services/aiClient';
import { llamaIndexAgent } from './services/llamaIndexAgent';
// Import logService to initialize console interception
import './services/logService';

class App {
  private chatApp?: ChatApp;
  private debugConsole?: DebugConsole;
  private isInitialized = false;
  private chartsInitialized = false;
  private toolsInitialized = false;
  private analysisInitialized = false;

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

    // Initialize LlamaIndex agent
    try {
      console.log('🤖 Initializing LlamaIndex agent...');
      await llamaIndexAgent.initialize();
      console.log('✅ LlamaIndex agent initialized');
    } catch (error) {
      console.warn('⚠️ LlamaIndex agent initialization failed:', error);
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
    if (viewName === 'charts' && !this.chartsInitialized) {
      this.initializeCharts();
    } else if (viewName === 'tools' && !this.toolsInitialized) {
      this.initializeTools();
    } else if (viewName === 'analysis' && !this.analysisInitialized) {
      this.initializeAnalysis();
    }
  }

  /**
   * Initialize charts when charts tab is first accessed
   */
  private async initializeCharts(): Promise<void> {
    if (this.chartsInitialized) return;

    try {
      console.log('📈 Initializing charts...');
      await chartManager.initialize();
      this.chartsInitialized = true;
      console.log('✅ Charts initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize charts:', error);
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
   * Initialize analysis when analysis tab is first accessed
   */
  private async initializeAnalysis(): Promise<void> {
    if (this.analysisInitialized) return;

    try {
      console.log('🧠 Initializing analysis...');
      await analysisManager.initialize();
      this.analysisInitialized = true;
      console.log('✅ Analysis initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize analysis:', error);
    }
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
