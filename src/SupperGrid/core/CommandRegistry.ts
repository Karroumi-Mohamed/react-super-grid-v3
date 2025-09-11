import type { CellCommand, RowCommand, CellId, RowId, CellCommandHandeler, RowCommandMap } from './types';
import type { BasePlugin } from './BasePlugin';

export class CellCommandRegistry {
    private handlers = new Map<CellId, CellCommandHandeler>();
    private plugins: BasePlugin[] = [];

    setPlugins(plugins: BasePlugin[]): void {
        this.plugins = plugins;
    }

    register(cellId: CellId, handler: CellCommandHandeler): void {
        this.handlers.set(cellId, handler);
    }

    unregister(cellId: CellId): void {
        this.handlers.delete(cellId);
    }

    dispatch(command: CellCommand): void {
        // Set timestamp if not provided
        if (!command.timestamp) {
            (command as any).timestamp = Date.now();
        }

        // Run command through plugin chain first
        const shouldContinue = this.runPluginChain(command);
        if (!shouldContinue) {
            return; // Command was blocked by a plugin
        }

        // Deliver to cell if command passed plugin chain
        this.deliverToCell(command);
    }

    private runPluginChain(command: CellCommand): boolean {
        for (const plugin of this.plugins) {
            // Skip plugin that created this command (bypass system)
            if (command.originPlugin === plugin.name) {
                continue;
            }

            try {
                const result = plugin.onBeforeCellCommand(command);
                if (result === false) {
                    return false; // Plugin blocked the command
                }
            } catch (error) {
                console.error(`Error in plugin ${plugin.name} onBeforeCellCommand:`, error);
                // Continue to next plugin on error
            }
        }
        return true; // Command passed all plugins
    }

    private deliverToCell(command: CellCommand): void {
        const handler = this.handlers.get(command.targetId);
        if (handler) {
            try {
                handler(command);
            } catch (error) {
                console.error(`Error handling command "${command.name}" for cell ${command.targetId}:`, error);

                // Send error command back to the cell
                const errorCommand: CellCommand = {
                    name: 'error',
                    targetId: command.targetId,
                    timestamp: Date.now(),
                    payload: { error },
                    originPlugin: 'system'
                };

                // Attempt to deliver error command (no plugin interception for error commands from system)
                try {
                    handler(errorCommand);
                } catch (nestedError) {
                    console.error(`Failed to deliver error command to cell ${command.targetId}:`, nestedError);
                }
            }
        }
    }
}

export class RowCommandRegistry {
    private handlers = new Map<RowId, (command: RowCommand<any>) => void>();
    private plugins: BasePlugin[] = [];

    setPlugins(plugins: BasePlugin[]): void {
        this.plugins = plugins;
    }

    register<K extends keyof RowCommandMap>(rowId: RowId, handler: (command: RowCommand<K>) => void): void {
        this.handlers.set(rowId, handler);
    }

    unregister(rowId: RowId): void {
        this.handlers.delete(rowId);
    }

    dispatch<K extends keyof RowCommandMap>(command: RowCommand<K>): void {
        // Set timestamp if not provided
        if (!command.timestamp) {
            (command as any).timestamp = Date.now();
        }

        // Run command through plugin chain first
        const shouldContinue = this.runPluginChain(command);
        if (!shouldContinue) {
            return; // Command was blocked by a plugin
        }

        // Deliver to row if command passed plugin chain
        this.deliverToRow(command);
    }

    private runPluginChain<K extends keyof RowCommandMap>(command: RowCommand<K>): boolean {
        for (const plugin of this.plugins) {
            // Skip plugin that created this command (bypass system)
            if (command.originPlugin === plugin.name) {
                continue;
            }

            try {
                const result = plugin.onBeforeRowCommand(command);
                if (result === false) {
                    return false; // Plugin blocked the command
                }
            } catch (error) {
                console.error(`Error in plugin ${plugin.name} onBeforeRowCommand:`, error);
                // Continue to next plugin on error
            }
        }
        return true; // Command passed all plugins
    }

    private deliverToRow<K extends keyof RowCommandMap>(command: RowCommand<K>): void {
        const handler = this.handlers.get(command.targetId);
        if (handler) {
            try {
                handler(command);
            } catch (error) {
                console.error(`Error handling command "${command.name}" for row ${command.targetId}:`, error);

                // Send error command back to the row
                const errorCommand: RowCommand<'error'> = {
                    name: 'error',
                    targetId: command.targetId,
                    timestamp: Date.now(),
                    payload: { error },
                    originPlugin: 'system'
                };

                // Attempt to deliver error command (no plugin interception for error commands from system)
                try {
                    handler(errorCommand);
                } catch (nestedError) {
                    console.error(`Failed to deliver error command to row ${command.targetId}:`, nestedError);
                }
            }
        }
    }
}