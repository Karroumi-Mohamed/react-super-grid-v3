import type { BasePlugin, PluginManager as IPluginManager } from './BasePlugin';

export class PluginManager implements IPluginManager {
    private plugins = new Map<string, BasePlugin>();
    private initializationOrder: string[] = [];

    addPlugin(plugin: BasePlugin): void {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin ${plugin.name} is already registered`);
        }

        this.plugins.set(plugin.name, plugin);
        plugin.setPluginManager(this);
    }

    removePlugin(pluginName: string): void {
        const plugin = this.plugins.get(pluginName);
        if (plugin && plugin.onDestroy) {
            plugin.onDestroy();
        }
        this.plugins.delete(pluginName);
        
        // Remove from initialization order
        const index = this.initializationOrder.indexOf(pluginName);
        if (index !== -1) {
            this.initializationOrder.splice(index, 1);
        }
    }

    getPlugin<T extends BasePlugin>(pluginName: string): T | null {
        return (this.plugins.get(pluginName) as T) || null;
    }

    getPlugins(): BasePlugin[] {
        return Array.from(this.plugins.values());
    }

    getPluginsInOrder(): BasePlugin[] {
        return this.initializationOrder
            .map(name => this.plugins.get(name))
            .filter(plugin => plugin !== undefined) as BasePlugin[];
    }

    initializePlugins(): void {
        this.resolveAndOrderPlugins();
        
        for (const pluginName of this.initializationOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin && plugin.onInit) {
                try {
                    plugin.onInit();
                } catch (error) {
                    console.error(`Error initializing plugin ${pluginName}:`, error);
                }
            }
        }
    }

    private resolveAndOrderPlugins(): void {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const order: string[] = [];

        const visit = (pluginName: string) => {
            if (visiting.has(pluginName)) {
                throw new Error(`Circular dependency detected involving plugin: ${pluginName}`);
            }
            
            if (visited.has(pluginName)) {
                return;
            }

            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error(`Plugin ${pluginName} is required as a dependency but not found`);
            }

            visiting.add(pluginName);

            // Visit all dependencies first
            for (const dependency of plugin.dependencies) {
                visit(dependency);
            }

            visiting.delete(pluginName);
            visited.add(pluginName);
            order.push(pluginName);
        };

        // Visit all plugins to build dependency order
        for (const pluginName of this.plugins.keys()) {
            if (!visited.has(pluginName)) {
                visit(pluginName);
            }
        }

        this.initializationOrder = order;
    }

    destroy(): void {
        // Destroy in reverse order
        for (let i = this.initializationOrder.length - 1; i >= 0; i--) {
            const pluginName = this.initializationOrder[i];
            const plugin = this.plugins.get(pluginName);
            if (plugin && plugin.onDestroy) {
                try {
                    plugin.onDestroy();
                } catch (error) {
                    console.error(`Error destroying plugin ${pluginName}:`, error);
                }
            }
        }

        this.plugins.clear();
        this.initializationOrder = [];
    }
}