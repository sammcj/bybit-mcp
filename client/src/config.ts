import Conf from 'conf'
import { getEnvConfig, type EnvConfig } from './env.js';

interface ConfigSchema extends EnvConfig { }

export class Config {
  private conf: Conf<ConfigSchema>
  private envConfig: EnvConfig;

  constructor() {
    // Get environment configuration
    this.envConfig = getEnvConfig();

    this.conf = new Conf<ConfigSchema>({
      projectName: 'bybit-mcp-client',
      schema: {
        ollamaHost: {
          type: 'string',
          default: this.envConfig.ollamaHost
        },
        defaultModel: {
          type: 'string',
          default: this.envConfig.defaultModel
        },
        debug: {
          type: 'boolean',
          default: this.envConfig.debug
        }
      }
    })

    // Update stored config with any new environment values
    this.syncWithEnv()
  }

  private syncWithEnv(): void {
    // Environment variables take precedence over stored config
    if (this.envConfig.ollamaHost) {
      this.conf.set('ollamaHost', this.envConfig.ollamaHost)
    }
    if (this.envConfig.defaultModel) {
      this.conf.set('defaultModel', this.envConfig.defaultModel)
    }
    if (this.envConfig.debug !== undefined) {
      this.conf.set('debug', this.envConfig.debug)
    }
  }

  get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    return this.conf.get(key);
  }

  set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void {
    // Only update if not overridden by environment
    if (!(key in this.envConfig) || this.envConfig[key] === undefined) {
      this.conf.set(key, value)
    }
  }

  delete(key: keyof ConfigSchema): void {
    // Only delete if not overridden by environment
    if (!(key in this.envConfig) || this.envConfig[key] === undefined) {
      this.conf.delete(key)
    }
  }

  clear(): void {
    this.conf.clear()
    // Restore environment values
    this.syncWithEnv();
  }
}
