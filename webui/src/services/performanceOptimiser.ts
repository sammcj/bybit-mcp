/**
 * Performance Optimiser Service - Handles parallel tool execution and workflow optimisation
 */

import type { ToolCall } from '@/types/ai';
import { mcpClient } from './mcpClient';

export interface ToolExecutionPlan {
  parallel: ToolCall[][];  // Groups of tools that can run in parallel
  sequential: ToolCall[];  // Tools that must run sequentially
  dependencies: Map<string, string[]>;  // Tool dependencies
}

export interface ToolExecutionResult {
  toolCall: ToolCall;
  result?: any;
  error?: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface ExecutionMetrics {
  totalDuration: number;
  parallelSavings: number;  // Time saved by parallel execution
  toolCount: number;
  successRate: number;
  averageToolTime: number;
}

export class PerformanceOptimiserService {
  private static readonly TOOL_TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_PARALLEL_TOOLS = 5;

  private toolDependencies: Map<string, string[]> = new Map();
  private toolPerformanceCache: Map<string, number> = new Map(); // Average execution times
  private executionHistory: ToolExecutionResult[] = [];

  constructor() {
    this.initializeToolDependencies();
  }

  /**
   * Execute tools with optimal parallelisation
   */
  async executeToolsOptimised(toolCalls: ToolCall[]): Promise<ToolExecutionResult[]> {
    if (toolCalls.length === 0) return [];

    const startTime = Date.now();
    console.log(`🚀 Optimising execution of ${toolCalls.length} tools...`);

    // Create execution plan
    const plan = this.createExecutionPlan(toolCalls);
    console.log(`📋 Execution plan: ${plan.parallel.length} parallel groups, ${plan.sequential.length} sequential tools`);

    const results: ToolExecutionResult[] = [];

    try {
      // Execute parallel groups first
      for (let i = 0; i < plan.parallel.length; i++) {
        const group = plan.parallel[i];
        console.log(`⚡ Executing parallel group ${i + 1}/${plan.parallel.length} with ${group.length} tools`);

        const groupResults = await this.executeToolsInParallel(group);
        results.push(...groupResults);
      }

      // Execute sequential tools
      if (plan.sequential.length > 0) {
        console.log(`🔄 Executing ${plan.sequential.length} sequential tools`);
        for (const toolCall of plan.sequential) {
          const result = await this.executeSingleTool(toolCall);
          results.push(result);
        }
      }

      // Update performance metrics
      this.updatePerformanceMetrics(results);

      const totalDuration = Date.now() - startTime;
      console.log(`✅ Optimised execution completed in ${totalDuration}ms`);

      return results;

    } catch (error) {
      console.error('❌ Optimised execution failed:', error);
      throw error;
    }
  }

  /**
   * Create execution plan based on tool dependencies and characteristics
   */
  private createExecutionPlan(toolCalls: ToolCall[]): ToolExecutionPlan {
    const plan: ToolExecutionPlan = {
      parallel: [],
      sequential: [],
      dependencies: new Map()
    };

    // Analyse tool dependencies
    const dependencyGraph = this.buildDependencyGraph(toolCalls);

    // Group tools by dependency levels
    const processed = new Set<string>();
    const remaining = [...toolCalls];

    while (remaining.length > 0) {
      // Find tools with no unprocessed dependencies
      const readyTools = remaining.filter(tool => {
        const deps = dependencyGraph.get(tool.function.name) || [];
        return deps.every(dep => processed.has(dep));
      });

      if (readyTools.length === 0) {
        // No tools ready - add remaining to sequential (fallback)
        plan.sequential.push(...remaining);
        break;
      }

      // Group ready tools for parallel execution
      const parallelGroup = this.groupForParallelExecution(readyTools);

      if (parallelGroup.length > 1) {
        plan.parallel.push(parallelGroup);
      } else {
        plan.sequential.push(...parallelGroup);
      }

      // Mark tools as processed
      parallelGroup.forEach(tool => {
        processed.add(tool.function.name);
        const index = remaining.findIndex(t => t.id === tool.id);
        if (index >= 0) remaining.splice(index, 1);
      });
    }

    return plan;
  }

  /**
   * Build dependency graph for tools
   */
  private buildDependencyGraph(toolCalls: ToolCall[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const dependencies = this.toolDependencies.get(toolName) || [];

      // Filter dependencies to only include tools in current execution
      const relevantDeps = dependencies.filter(dep =>
        toolCalls.some(tc => tc.function.name === dep)
      );

      graph.set(toolName, relevantDeps);
    }

    return graph;
  }

  /**
   * Group tools for optimal parallel execution
   */
  private groupForParallelExecution(tools: ToolCall[]): ToolCall[] {
    // Prioritise by estimated execution time (faster tools first)
    const sortedTools = tools.sort((a, b) => {
      const timeA = this.getEstimatedExecutionTime(a.function.name);
      const timeB = this.getEstimatedExecutionTime(b.function.name);
      return timeA - timeB;
    });

    // Limit parallel execution to avoid overwhelming the system
    return sortedTools.slice(0, PerformanceOptimiserService.MAX_PARALLEL_TOOLS);
  }

  /**
   * Execute multiple tools in parallel
   */
  private async executeToolsInParallel(toolCalls: ToolCall[]): Promise<ToolExecutionResult[]> {
    const promises = toolCalls.map(toolCall => this.executeSingleTool(toolCall));

    try {
      const results = await Promise.allSettled(promises);

      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          // Handle rejected promise
          const toolCall = toolCalls[index];
          return {
            toolCall,
            error: result.reason?.message || 'Unknown error',
            duration: 0,
            startTime: Date.now(),
            endTime: Date.now()
          };
        }
      });

    } catch (error) {
      console.error('Parallel execution error:', error);
      throw error;
    }
  }

  /**
   * Execute a single tool with timing
   */
  private async executeSingleTool(toolCall: ToolCall): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      console.log(`🔧 Executing tool: ${toolCall.function.name}`);

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), PerformanceOptimiserService.TOOL_TIMEOUT);
      });

      // Execute tool with timeout
      const resultPromise = mcpClient.callTool(toolCall.function.name as any, toolCall.function.arguments as any);
      const result = await Promise.race([resultPromise, timeoutPromise]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ Tool ${toolCall.function.name} completed in ${duration}ms`);

      const executionResult: ToolExecutionResult = {
        toolCall,
        result,
        duration,
        startTime,
        endTime
      };

      // Cache performance data
      this.updateToolPerformanceCache(toolCall.function.name, duration);
      this.executionHistory.push(executionResult);

      return executionResult;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`❌ Tool ${toolCall.function.name} failed after ${duration}ms:`, error);

      const executionResult: ToolExecutionResult = {
        toolCall,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        startTime,
        endTime
      };

      this.executionHistory.push(executionResult);

      return executionResult;
    }
  }

  /**
   * Get estimated execution time for a tool
   */
  private getEstimatedExecutionTime(toolName: string): number {
    // Return cached average or default estimate
    return this.toolPerformanceCache.get(toolName) || 5000; // Default 5 seconds
  }

  /**
   * Update tool performance cache
   */
  private updateToolPerformanceCache(toolName: string, duration: number): void {
    const existing = this.toolPerformanceCache.get(toolName);
    if (existing) {
      // Calculate moving average (weight recent executions more)
      const newAverage = (existing * 0.7) + (duration * 0.3);
      this.toolPerformanceCache.set(toolName, newAverage);
    } else {
      this.toolPerformanceCache.set(toolName, duration);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(results: ToolExecutionResult[]): void {
    // Keep only recent history (last 100 executions)
    this.executionHistory = this.executionHistory.slice(-100);

    // Log performance summary
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successCount = results.filter(r => !r.error).length;
    const successRate = results.length > 0 ? successCount / results.length : 0;

    console.log(`📊 Execution metrics: ${totalDuration}ms total, ${(successRate * 100).toFixed(1)}% success rate`);
  }

  /**
   * Initialize tool dependencies based on domain knowledge
   */
  private initializeToolDependencies(): void {
    // Define tool dependencies for Bybit tools
    this.toolDependencies.set('get_kline', []); // Independent
    this.toolDependencies.set('get_ticker', []); // Independent
    this.toolDependencies.set('get_orderbook', []); // Independent
    this.toolDependencies.set('get_recent_trades', []); // Independent
    this.toolDependencies.set('get_funding_rate', []); // Independent
    this.toolDependencies.set('get_open_interest', []); // Independent

    // Technical analysis tools might depend on price data
    this.toolDependencies.set('calculate_rsi', ['get_kline']); // Needs price data
    this.toolDependencies.set('calculate_macd', ['get_kline']); // Needs price data
    this.toolDependencies.set('detect_order_blocks', ['get_kline']); // Needs price data

    // Risk analysis might depend on multiple data sources
    this.toolDependencies.set('calculate_position_size', ['get_ticker', 'get_funding_rate']);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): ExecutionMetrics {
    if (this.executionHistory.length === 0) {
      return {
        totalDuration: 0,
        parallelSavings: 0,
        toolCount: 0,
        successRate: 0,
        averageToolTime: 0
      };
    }

    const recentResults = this.executionHistory.slice(-50); // Last 50 executions
    const totalDuration = recentResults.reduce((sum, r) => sum + r.duration, 0);
    const successCount = recentResults.filter(r => !r.error).length;
    const successRate = successCount / recentResults.length;
    const averageToolTime = totalDuration / recentResults.length;

    // Estimate parallel savings (rough calculation)
    const sequentialTime = recentResults.reduce((sum, r) => sum + r.duration, 0);
    const actualTime = Math.max(...recentResults.map(r => r.endTime)) - Math.min(...recentResults.map(r => r.startTime));
    const parallelSavings = Math.max(0, sequentialTime - actualTime);

    return {
      totalDuration,
      parallelSavings,
      toolCount: recentResults.length,
      successRate,
      averageToolTime
    };
  }

  /**
   * Clear performance cache and history
   */
  clearPerformanceData(): void {
    this.toolPerformanceCache.clear();
    this.executionHistory = [];
    console.log('🧹 Performance data cleared');
  }

  /**
   * Get tool performance summary
   */
  getToolPerformanceSummary(): Array<{tool: string, avgTime: number, executions: number}> {
    const toolStats = new Map<string, {totalTime: number, count: number}>();

    for (const result of this.executionHistory) {
      const toolName = result.toolCall.function.name;
      const existing = toolStats.get(toolName) || {totalTime: 0, count: 0};

      toolStats.set(toolName, {
        totalTime: existing.totalTime + result.duration,
        count: existing.count + 1
      });
    }

    return Array.from(toolStats.entries()).map(([tool, stats]) => ({
      tool,
      avgTime: stats.totalTime / stats.count,
      executions: stats.count
    })).sort((a, b) => b.executions - a.executions);
  }
}

// Singleton instance
export const performanceOptimiser = new PerformanceOptimiserService();
