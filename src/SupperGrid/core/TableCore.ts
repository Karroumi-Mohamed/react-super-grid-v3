import type {
  CellCommand,
  RowCommand,
  SpaceCommand,
  CellId,
  RowId,
  SpaceId,
  CellCommandHandeler,
  SpaceCommandHandler,
  RowCommandMap,
  SpaceCommandMap,
} from './types';
import type { TablePluginAPIs, RowPluginAPIs, RowTableAPIs } from './BasePlugin';
import { CellCommandRegistry, RowCommandRegistry, SpaceCommandRegistry } from './CommandRegistry';
import { PluginManager } from './PluginManager';
import type { BasePlugin } from './BasePlugin';
import { CellRegistry, RowRegistry, SpaceRegistry } from './Registries';
import { CellCoordinator } from './CellCordinator';
import { SpaceCoordinator } from './SpaceCoordinator';

export class TableCore {
  private cellCommandRegistry: CellCommandRegistry;
  private rowCommandRegistry: RowCommandRegistry;
  private spaceCommandRegistry: SpaceCommandRegistry;
  private pluginManager: PluginManager;
  private cellRegistry: CellRegistry;
  private rowRegistry: RowRegistry<any>;
  private spaceRegistry: SpaceRegistry;
  private cellCoordinator: CellCoordinator;
  private spaceCoordinator: SpaceCoordinator;

  constructor() {
    this.cellCommandRegistry = new CellCommandRegistry();
    this.rowCommandRegistry = new RowCommandRegistry();
    this.spaceCommandRegistry = new SpaceCommandRegistry();
    this.pluginManager = new PluginManager();
    this.cellRegistry = CellRegistry.getInstance();
    this.rowRegistry = RowRegistry.getInstance();
    this.spaceRegistry = SpaceRegistry.getInstance();
    this.cellCoordinator = CellCoordinator.getInstance(this.cellRegistry);
    this.spaceCoordinator = SpaceCoordinator.getInstance(this.spaceRegistry);
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
      },

      createRow: (rowData: any, position?: 'top' | 'bottom') => {
        // Smart detection: find space owned by this plugin
        const allSpaces = this.spaceRegistry.list();
        const pluginSpace = allSpaces.find(space => space.owner === pluginName);

        if (!pluginSpace) {
          console.error(`Plugin ${pluginName} tried to create row but has no space`);
          return;
        }

        const spaceCommand: SpaceCommand<'addRow'> = {
          name: 'addRow',
          payload: {
            rowData,
            position: position || 'bottom' // Default to bottom if not specified
          },
          targetId: pluginSpace.name, // Use space name as ID
          originPlugin: pluginName,
          timestamp: Date.now()
        };

        this.spaceCommandRegistry.dispatch(spaceCommand);
      },

      getCell: (cellId: CellId) => {
        // Access spatial coordinates of the cell
        return this.cellRegistry.get(cellId);
      },

      getRow: (rowId: RowId) => {
        // Access row object with cells array and spatial data
        return this.rowRegistry.get(rowId);
      },

      compareVertical: (cellId1: CellId, cellId2: CellId): import('./BasePlugin').VerticalComparison => {
        // Parse coordinates from cell UUIDs: "colIndex-rowString-uuid"
        const parseCoords = (cellId: CellId) => {
          const parts = cellId.split('-');
          return {
            col: parseInt(parts[0]),
            row: parts[1] // Keep as string for lexicographic comparison
          };
        };

        const coords1 = parseCoords(cellId1);
        const coords2 = parseCoords(cellId2);

        // Same row - no vertical relationship
        if (coords1.row === coords2.row) return null;

        // String comparison: higher string = higher visual position = "top"
        // Bottom-up indexing: "40" > "30" > "20" > "10"
        if (coords1.row > coords2.row) {
          return { top: cellId1, bottom: cellId2 };
        } else {
          return { top: cellId2, bottom: cellId1 };
        }
      },

      compareHorizontal: (cellId1: CellId, cellId2: CellId): import('./BasePlugin').HorizontalComparison => {
        // Parse coordinates from cell UUIDs: "colIndex-rowIndex-uuid"
        const parseCoords = (cellId: CellId) => {
          const parts = cellId.split('-');
          return {
            col: parseInt(parts[0]),
            row: parseInt(parts[1])
          };
        };

        const coords1 = parseCoords(cellId1);
        const coords2 = parseCoords(cellId2);

        // Different rows - no horizontal relationship
        if (coords1.row !== coords2.row) return null;

        // Return with left cell first, right cell second
        if (coords1.col < coords2.col) {
          return { left: cellId1, right: cellId2 };
        } else {
          return { left: cellId2, right: cellId1 };
        }
      },

      deleteRow: (rowId: RowId) => {
        // Direct access to destroyRow method - plugins can delete rows safely
        this.destroyRow(rowId);
      },

      getRowIds: (): RowId[] => {
        // Get all row IDs from registry
        return this.rowRegistry.list();
      },

      getSpaceAbove: (spaceId: SpaceId) => {
        return this.spaceCoordinator.getSpaceAbove(spaceId);
      },

      getSpaceBelow: (spaceId: SpaceId) => {
        return this.spaceCoordinator.getSpaceBelow(spaceId);
      },

      getSpace: (spaceId: SpaceId) => {
        return this.spaceRegistry.get(spaceId);
      },

      getMySpace: () => {
        // Return this plugin's space ID
        return `space-${pluginName}`;
      }
    };
  }

  // Factory for row-specific APIs with bound context
  createRowAPI(rowId: RowId): import('./types').TableRowAPI {
    return {
      registerCellCommands: (cellId: CellId, handler: CellCommandHandeler) => {
        // Context: this call is from rowId (captured in closure)
        this.cellCommandRegistry.register(cellId, handler);
      },

      registerCell: (cellId: CellId, cell: import('./types').Cell) => {
        // Register cell object in spatial registry
        this.cellRegistry.register(cellId, cell);
      },

      addCellToRow: (cellId: CellId) => {
        // Add cell to row's cells array in row registry
        const row = this.rowRegistry.get(rowId);
        if (row) {
          if (!row.cells.includes(cellId)) {
            row.cells.push(cellId);
            this.rowRegistry.register(rowId, row);
          }
        } else {
          console.warn(`Row ${rowId} not found in registry when trying to add cell ${cellId}`);
        }
      },

      sendMouseEvent: (cellId: CellId, eventName: string, event: MouseEvent) => {
        // Convert DOM event to command and dispatch
        this.convertMouseEventToCommand(cellId, eventName, event);
      },

      getCellCoordinator: () => {
        // Provide access to spatial coordination methods
        return this.cellCoordinator;
      },

      registerRowHandler: (handler: import('./types').RowCommandHandler) => {
        // Register row command handler for this specific row
        this.rowCommandRegistry.register(rowId, handler);
      },

      unregisterRowHandler: () => {
        // Unregister row command handler
        this.rowCommandRegistry.unregister(rowId);
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

    // FIRST: Resolve plugin dependencies to get proper order
    // We need to call this directly since pluginManager.initializePlugins()
    // does dependency resolution internally but we need the order first
    this.pluginManager.resolvePluginDependencies();

    // Get plugins in dependency order (now this will work)
    const orderedPlugins = this.pluginManager.getPluginsInOrder();

    // SECOND: Create spaces for all plugins and set APIs
    for (const plugin of orderedPlugins) {

      // Create a space for this plugin
      const spaceId = this.spaceCoordinator.createPluginSpace(plugin.name);

      // Create context-aware APIs for this specific plugin
      const tableAPI = this.createPluginAPI(plugin.name);

      // TODO: Implement these API factories later
      const rowAPI: RowPluginAPIs = {} as RowPluginAPIs;
      const rowTableAPI: RowTableAPIs = {} as RowTableAPIs;

      // Give the plugin its bound APIs
      plugin.setAPIs(tableAPI, rowAPI, rowTableAPI);
    }

    // THIRD: Connect plugins to command registries (now APIs are ready)
    const plugins = this.pluginManager.getPlugins();
    this.cellCommandRegistry.setPlugins(plugins);
    this.rowCommandRegistry.setPlugins(plugins);
    this.spaceCommandRegistry.setPlugins(plugins);

    // FINALLY: Initialize plugins after all APIs are set and registries connected
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

  // Dispatch keyboard commands without targetId (plugin-only)
  dispatchKeyboardCommand(eventName: string, event: KeyboardEvent): void {
    let keyboardCommand: CellCommand;

    switch (eventName) {
      case 'keydown':
        keyboardCommand = {
          name: 'keydown',
          // No targetId - this command won't reach any individual cells
          payload: { event },
          timestamp: Date.now()
        };
        break;
      case 'keyup':
        keyboardCommand = {
          name: 'keyup',
          // No targetId - this command won't reach any individual cells
          payload: { event },
          timestamp: Date.now()
        };
        break;
      default:
        console.warn(`Unknown keyboard event: ${eventName}`);
        return;
    }

    // Dispatch to cell command registry - plugins will see it, cells won't
    this.cellCommandRegistry.dispatch(keyboardCommand);
  }

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

  getSpaceCommandRegistry(): SpaceCommandRegistry {
    return this.spaceCommandRegistry;
  }

  getRowRegistry(): RowRegistry<any> {
    return this.rowRegistry;
  }

  getCellCoordinator(): CellCoordinator {
    return this.cellCoordinator;
  }

  getSpaceCoordinator(): SpaceCoordinator {
    return this.spaceCoordinator;
  }

  getSpaceRegistry(): SpaceRegistry {
    return this.spaceRegistry;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  // Row destruction with automatic cell cleanup
  destroyRow(rowId: RowId): void {

    const row = this.rowRegistry.get(rowId);
    if (!row) {
      console.warn(`TableCore: Row ${rowId} not found for destruction`);
      return;
    }

    // 1. Clean up cell registrations (React handles component unmounting)
    row.cells.forEach(cellId => {
      this.cellCommandRegistry.unregister(cellId);
      this.cellRegistry.unregister(cellId);
    });

    // 2. Fix spatial navigation - link neighboring rows
    const topRowId = row.top;
    const bottomRowId = row.bottom;

    if (topRowId && bottomRowId) {
      // Connect top row directly to bottom row
      this.cellCoordinator.linkRows(topRowId, bottomRowId);

      // Link cells between top and bottom rows (skip destroyed row)
      const topRow = this.rowRegistry.get(topRowId);
      const bottomRow = this.rowRegistry.get(bottomRowId);
      if (topRow && bottomRow) {
        this.cellCoordinator.linkRowsCells(topRow.cells, bottomRow.cells);
      }
    } else if (topRowId) {
      // This was the last row - clear bottom reference from top row
      const topRow = this.rowRegistry.get(topRowId);
      if (topRow) {
        topRow.bottom = null;
        this.rowRegistry.register(topRowId, topRow);
      }
    } else if (bottomRowId) {
      // This was the first row - clear top reference from bottom row
      const bottomRow = this.rowRegistry.get(bottomRowId);
      if (bottomRow) {
        bottomRow.top = null;
        this.rowRegistry.register(bottomRowId, bottomRow);
      }
    }

    // 3. Send destroy command to row component
    this.dispatchRowCommand({
      name: 'destroy',
      targetId: rowId,
      payload: {},
      timestamp: Date.now()
    });

    // 4. Clean up row registrations
    this.rowCommandRegistry.unregister(rowId);
    this.rowRegistry.unregister(rowId);

  }

}
