import type { 
  CellCommand, 
  RowCommand, 
  CellId, 
  RowId, 
  CellCommandHandeler,
  RowCommandMap 
} from './types';
import type { TablePluginAPIs, RowPluginAPIs, RowTableAPIs } from './BasePlugin';
import { CellCommandRegistry, RowCommandRegistry } from './CommandRegistry';
import { PluginManager } from './PluginManager';
import type { BasePlugin } from './BasePlugin';

export class TableCore {
  private cellCommandRegistry: CellCommandRegistry;
  private rowCommandRegistry: RowCommandRegistry;
  private pluginManager: PluginManager;

  constructor() {
    this.cellCommandRegistry = new CellCommandRegistry();
    this.rowCommandRegistry = new RowCommandRegistry();
    this.pluginManager = new PluginManager();
  }

  // Factory for plugin-specific APIs with bound context
  createPluginAPI(pluginName: string): TablePluginAPIs {
    return {
      createCellCommand: (targetId: CellId, command: CellCommand) => {
        // Context automatically injected via closure
        const contextCommand: CellCommand = {
          ...command,
          targetId,
          originPlugin: pluginName,
          timestamp: command.timestamp || Date.now()
        };
        this.cellCommandRegistry.dispatch(contextCommand);
      },

      createRowCommand: <K extends keyof RowCommandMap>(
        targetId: RowId, 
        command: RowCommand<K>
      ) => {
        const contextCommand: RowCommand<K> = {
          ...command,
          targetId,
          originPlugin: pluginName,
          timestamp: command.timestamp || Date.now()
        };
        this.rowCommandRegistry.dispatch(contextCommand);
      }
    };
  }

  // Factory for row-specific APIs with bound context
  createRowAPI(rowId: RowId): import('./types').TableRowAPI {
    return {
      registerCellCommands: (cellId: CellId, handler: CellCommandHandeler) => {
        // Context: this call is from rowId (captured in closure)
        this.cellCommandRegistry.register(cellId, handler);
        
        // Could track row->cell relationships here for cleanup/navigation
        // this.trackCellToRow(cellId, rowId);
        console.log(`Row ${rowId} registered cell ${cellId}`); // Use rowId to avoid unused warning
      },

      sendMouseEvent: (cellId: CellId, eventName: string, event: MouseEvent) => {
        // Convert DOM event to command and dispatch
        this.convertMouseEventToCommand(cellId, eventName, event);
      }
    };
  }

  // Plugin management
  addPlugin(plugin: BasePlugin): void {
    this.pluginManager.addPlugin(plugin);
  }

  removePlugin(pluginName: string): void {
    this.pluginManager.removePlugin(pluginName);
  }

  // Initialize all plugins with their context-aware APIs
  initializePlugins(): void {
    // Connect plugin manager to command registries
    const plugins = this.pluginManager.getPlugins();
    this.cellCommandRegistry.setPlugins(plugins);
    this.rowCommandRegistry.setPlugins(plugins);

    // Initialize plugins in dependency order
    const orderedPlugins = this.pluginManager.getPluginsInOrder();
    
    for (const plugin of orderedPlugins) {
      // Create context-aware APIs for this specific plugin
      const tableAPI = this.createPluginAPI(plugin.name);
      
      // TODO: Implement these API factories later
      const rowAPI: RowPluginAPIs = {} as RowPluginAPIs;
      const rowTableAPI: RowTableAPIs = {} as RowTableAPIs;
      
      // Give the plugin its bound APIs
      plugin.setAPIs(tableAPI, rowAPI, rowTableAPI);
    }

    // Initialize plugins after all APIs are set
    this.pluginManager.initializePlugins();
  }

  // Cleanup
  destroy(): void {
    this.pluginManager.destroy();
  }

  // Command dispatching methods
  dispatchCellCommand(command: CellCommand): void {
    this.cellCommandRegistry.dispatch(command);
  }

  dispatchRowCommand<K extends keyof RowCommandMap>(command: RowCommand<K>): void {
    this.rowCommandRegistry.dispatch(command);
  }

  // Convert DOM events to commands
  private convertMouseEventToCommand(cellId: CellId, eventName: string, event: MouseEvent): void {
    let command: CellCommand;

    switch (eventName) {
      case 'click':
        command = {
          name: 'click',
          targetId: cellId,
          payload: { event },
          timestamp: Date.now()
        };
        break;

      case 'dblclick':
        command = {
          name: 'dblclick',
          targetId: cellId,
          payload: { event },
          timestamp: Date.now()
        };
        break;

      case 'contextmenu':
        command = {
          name: 'contextmenu',
          targetId: cellId,
          payload: { event },
          timestamp: Date.now()
        };
        break;

      case 'mousedown':
        command = {
          name: 'mouseDown',
          targetId: cellId,
          payload: { event },
          timestamp: Date.now()
        };
        break;

      case 'mouseup':
        command = {
          name: 'mouseUp',
          targetId: cellId,
          payload: { event },
          timestamp: Date.now()
        };
        break;

      case 'mouseenter':
        command = {
          name: 'mouseEnter',
          targetId: cellId,
          payload: { event },
          timestamp: Date.now()
        };
        break;

      case 'mouseleave':
        command = {
          name: 'mouseLeave',
          targetId: cellId,
          payload: { event },
          timestamp: Date.now()
        };
        break;

      default:
        console.warn(`Unknown mouse event: ${eventName}`);
        return;
    }

    this.dispatchCellCommand(command);
  }

  // Convenience methods for common commands
  focusCell(cellId: CellId): void {
    this.dispatchCellCommand({
      name: 'focus',
      targetId: cellId,
      timestamp: Date.now()
    });
  }

  blurCell(cellId: CellId): void {
    this.dispatchCellCommand({
      name: 'blur',
      targetId: cellId,
      timestamp: Date.now()
    });
  }

  selectCell(cellId: CellId): void {
    this.dispatchCellCommand({
      name: 'select',
      targetId: cellId,
      timestamp: Date.now()
    });
  }

  editCell(cellId: CellId): void {
    this.dispatchCellCommand({
      name: 'edit',
      targetId: cellId,
      timestamp: Date.now()
    });
  }

  updateCellValue(cellId: CellId, value: any): void {
    this.dispatchCellCommand({
      name: 'updateValue',
      targetId: cellId,
      payload: { value },
      timestamp: Date.now()
    });
  }

  // Access to registries for advanced use cases
  getCellCommandRegistry(): CellCommandRegistry {
    return this.cellCommandRegistry;
  }

  getRowCommandRegistry(): RowCommandRegistry {
    return this.rowCommandRegistry;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }
}