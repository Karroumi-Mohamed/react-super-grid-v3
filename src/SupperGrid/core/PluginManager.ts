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

    // Expose dependency resolution for external use
    resolvePluginDependencies(): void {
        this.resolveAndOrderPlugins();
    }

    initializePlugins(): void {
        this.resolveAndOrderPlugins();

        for (const pluginName of this.initializationOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin && plugin.onInit) {
                try {
                    plugin.onInit();
                } catch (error) {
                }
            }
        }
    }

    private resolveAndOrderPlugins(): void {

        // Step 1: Separate plugins by their initial processLast flag
        const initialProcessLastPlugins = new Set<string>();
        const allPlugins = new Map<string, BasePlugin>();

        for (const [pluginName, plugin] of this.plugins.entries()) {
            allPlugins.set(pluginName, plugin);
            if (plugin.processLast) {
                initialProcessLastPlugins.add(pluginName);
            }
        }

        // Step 2: Find normal plugins that depend on processLast plugins
        // These must be moved to processLast phase
        const finalProcessLastPlugins = new Set(initialProcessLastPlugins);
        let changed = true;

        while (changed) {
            changed = false;
            for (const [pluginName, plugin] of allPlugins.entries()) {
                if (!finalProcessLastPlugins.has(pluginName)) {
                    // Check if this normal plugin depends on any processLast plugin
                    for (const dependency of plugin.dependencies) {
                        if (finalProcessLastPlugins.has(dependency)) {
                            finalProcessLastPlugins.add(pluginName);
                            changed = true;
                            break;
                        }
                    }
                }
            }
        }

        // Step 3: Separate into final phases
        const normalPlugins = new Set<string>();
        for (const pluginName of allPlugins.keys()) {
            if (!finalProcessLastPlugins.has(pluginName)) {
                normalPlugins.add(pluginName);
            }
        }


        // Step 4: Resolve dependencies in each phase
        const normalOrder = this.resolveDependencies(normalPlugins, allPlugins, 'normal');
        const processLastOrder = this.resolveDependencies(finalProcessLastPlugins, allPlugins, 'processLast');

        // Step 5: Combine the orders
        const finalOrder = [...normalOrder, ...processLastOrder];

        this.initializationOrder = finalOrder;
    }

    private resolveDependencies(pluginSet: Set<string>, allPlugins: Map<string, BasePlugin>, phase: string): string[] {
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

            const plugin = allPlugins.get(pluginName);
            if (!plugin) {
                throw new Error(`Plugin ${pluginName} is required as a dependency but not found`);
            }

            visiting.add(pluginName);

            // Visit all dependencies first (they should all be in current set now after phase adjustment)
            for (const dependency of plugin.dependencies) {
                if (pluginSet.has(dependency)) {
                    visit(dependency);
                } else {
                    // This should not happen after proper phase adjustment
                    throw new Error(`Plugin ${pluginName} depends on ${dependency} which is not in the same phase`);
                }
            }

            visiting.delete(pluginName);
            visited.add(pluginName);
            order.push(pluginName);
        };

        // Visit all plugins in the current set
        for (const pluginName of pluginSet) {
            if (!visited.has(pluginName)) {
                visit(pluginName);
            }
        }

        return order;
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
                }
            }
        }

        this.plugins.clear();
        this.initializationOrder = [];
    }
}
