import type { SpaceCommand, SpaceId, SpaceCommandMap, SpaceCommandHandler } from './types';
import type { BasePlugin } from './BasePlugin';

export class SpaceCommandRegistry {
    private handlers = new Map<SpaceId, SpaceCommandHandler>();
    private plugins: BasePlugin[] = [];

    setPlugins(plugins: BasePlugin[]): void {
        this.plugins = plugins;
    }

    register<K extends keyof SpaceCommandMap>(spaceId: SpaceId, handler: (command: SpaceCommand<K>) => void): void {
        this.handlers.set(spaceId, handler);
    }

    unregister(spaceId: SpaceId): void {
        this.handlers.delete(spaceId);
    }

    dispatch<K extends keyof SpaceCommandMap>(command: SpaceCommand<K>): void {
        // Set timestamp if not provided
        if (!command.timestamp) {
            (command as any).timestamp = Date.now();
        }

        // Run command through plugin chain first
        const shouldContinue = this.runPluginChain(command);
        if (!shouldContinue) {
            return; // Command was blocked by a plugin
        }

        // Deliver to space if command passed plugin chain
        this.deliverToSpace(command);
    }

    private runPluginChain<K extends keyof SpaceCommandMap>(command: SpaceCommand<K>): boolean {
        for (const plugin of this.plugins) {
            // Skip plugin that created this command (bypass system)
            if (command.originPlugin === plugin.name) {
                continue;
            }

            try {
                const result = plugin.onBeforeSpaceCommand(command);
                if (result === false) {
                    return false; // Plugin blocked the command
                }
            } catch (error) {
                console.error(`Error in plugin ${plugin.name} onBeforeSpaceCommand:`, error);
                // Continue to next plugin on error
            }
        }
        return true; // Command passed all plugins
    }

    private deliverToSpace<K extends keyof SpaceCommandMap>(command: SpaceCommand<K>): void {
        const handler = this.handlers.get(command.targetSpaceId);
        if (handler) {
            try {
                handler(command);
            } catch (error) {
                console.error(`Error handling command "${command.name}" for space ${command.targetSpaceId}:`, error);

                // Send error command back to the space (if we had error space commands)
                // For now, just log the error
            }
        }
    }
}