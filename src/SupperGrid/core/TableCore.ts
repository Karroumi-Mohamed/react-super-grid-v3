import type {
  CellCommand,
  RowCommand,
  SpaceCommand,
  CellId,
  RowId,
  SpaceId,
  CellCommandHandeler,
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
import { v4 as uuidv4 } from 'uuid';

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

      createSpaceCommand: <K extends keyof SpaceCommandMap>(
        targetSpaceId: SpaceId,
        command: Omit<SpaceCommand<K>, 'targetSpaceId' | 'originPlugin' | 'timestamp'>
      ) => {
        const contextCommand: SpaceCommand<K> = {
          ...command,
          targetSpaceId,
          originPlugin: pluginName,
          timestamp: command.timestamp || Date.now()
        };
        this.spaceCommandRegistry.dispatch(contextCommand);
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
        // Parse coordinates from cell UUIDs: "colIndex-rowIndex-uuid"
        const parseCoords = (cellId: CellId) => {
          const parts = cellId.split('-');
          return {
            col: parseInt(parts[0]),
            row: parts[1] // Keep as string for fractional indices
          };
        };

        const coords1 = parseCoords(cellId1);
        const coords2 = parseCoords(cellId2);

        // Same row - no vertical relationship
        if (coords1.row === coords2.row) return null;

        // Bottom-up indexing with fractional indices: higher string value = higher position (top)
        // String comparison works correctly with padded fractional indices
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
        console.log(`Row ${rowId} registered cell commands for ${cellId}`);
      },

      registerCell: (cellId: CellId, cell: import('./types').Cell) => {
        // Register cell object in spatial registry
        this.cellRegistry.register(cellId, cell);
        console.log(`Row ${rowId} registered cell object ${cellId} with spatial data`);
      },

      addCellToRow: (cellId: CellId) => {
        // Add cell to row's cells array in row registry
        const row = this.rowRegistry.get(rowId);
        if (row) {
          if (!row.cells.includes(cellId)) {
            row.cells.push(cellId);
            this.rowRegistry.register(rowId, row);
            console.log(`Row ${rowId} added cell ${cellId} to its cells array`);
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
        console.log(`Row ${rowId} registered row command handler`);
      },

      unregisterRowHandler: () => {
        // Unregister row command handler
        this.rowCommandRegistry.unregister(rowId);
        console.log(`Row ${rowId} unregistered row command handler`);
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
    console.log('TableCore: Starting plugin initialization');
    
    // FIRST: Resolve plugin dependencies to get proper order
    // We need to call this directly since pluginManager.initializePlugins() 
    // does dependency resolution internally but we need the order first
    this.pluginManager.resolvePluginDependencies();
    
    // Get plugins in dependency order (now this will work)
    const orderedPlugins = this.pluginManager.getPluginsInOrder();
    console.log('TableCore: Found plugins in order:', orderedPlugins.map(p => p.name));
    
    // SECOND: Create spaces for all plugins and set APIs
    for (const plugin of orderedPlugins) {
      console.log(`TableCore: Creating space and setting APIs for plugin ${plugin.name}`);
      
      // Create a space for this plugin
      const spaceId = this.spaceCoordinator.createPluginSpace(plugin.name);
      console.log(`TableCore: Created space ${spaceId} for plugin ${plugin.name}`);
      
      // Create context-aware APIs for this specific plugin
      const tableAPI = this.createPluginAPI(plugin.name);
      
      // TODO: Implement these API factories later
      const rowAPI: RowPluginAPIs = {} as RowPluginAPIs;
      const rowTableAPI: RowTableAPIs = {} as RowTableAPIs;
      
      // Give the plugin its bound APIs
      plugin.setAPIs(tableAPI, rowAPI, rowTableAPI);
      console.log(`TableCore: APIs set for plugin ${plugin.name} with space ${spaceId}`);
    }

    // THIRD: Connect plugins to command registries (now APIs are ready)
    // Use the same ordered plugins for consistent processing order
    console.log('TableCore: Connecting plugins to registries:', orderedPlugins.map(p => p.name));
    this.cellCommandRegistry.setPlugins(orderedPlugins);
    this.rowCommandRegistry.setPlugins(orderedPlugins);
    this.spaceCommandRegistry.setPlugins(orderedPlugins);

    // FINALLY: Initialize plugins after all APIs are set and registries connected
    console.log('TableCore: Calling plugin manager initializePlugins');
    this.pluginManager.initializePlugins();
    console.log('TableCore: Plugin initialization complete');
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

  dispatchSpaceCommand<K extends keyof SpaceCommandMap>(command: SpaceCommand<K>): void {
    this.spaceCommandRegistry.dispatch(command);
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

  convertMouseEventToCommand(cellId: CellId, eventName: string, event: MouseEvent): void {
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

  getCellRegistry(): CellRegistry {
    return this.cellRegistry;
  }

  // Fractional row indexing system
  generateFractionalIndex(belowIndex?: string, aboveIndex?: string): string {
    const PADDING_LENGTH = 5;
    const BASE_INCREMENT = 10000;

    if (!belowIndex && !aboveIndex) {
      // First row in empty space
      return "50000";
    }

    if (!belowIndex) {
      // Insert below the bottom-most row
      const above = parseInt(aboveIndex!);
      const newIndex = Math.max(above - BASE_INCREMENT, 1000);
      return newIndex.toString().padStart(PADDING_LENGTH, '0');
    }

    if (!aboveIndex) {
      // Insert above the top-most row
      const below = parseInt(belowIndex!);
      const newIndex = below + BASE_INCREMENT;
      return newIndex.toString().padStart(PADDING_LENGTH, '0');
    }

    // Insert between two existing rows
    const below = parseInt(belowIndex);
    const above = parseInt(aboveIndex);

    if (above - below <= 1) {
      // No space left, need to use larger numbers or decimals
      // For now, just add to the above index
      console.warn('Fractional index space exhausted, using incremental approach');
      return (above + 1000).toString().padStart(PADDING_LENGTH, '0');
    }

    const middle = Math.floor((below + above) / 2);
    return middle.toString().padStart(PADDING_LENGTH, '0');
  }

  // Generate initial fractional indices for table space rows
  generateInitialFractionalIndices(count: number): string[] {
    const indices: string[] = [];
    const BASE_INCREMENT = 10000;

    for (let i = 0; i < count; i++) {
      // Bottom-up: first item (i=0) gets highest visual position
      const visualPosition = count - 1 - i; // Reverse for bottom-up
      const baseIndex = (visualPosition + 1) * BASE_INCREMENT;
      indices.push(baseIndex.toString().padStart(5, '0'));
    }

    return indices;
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

  // Create a new row in a specific space
  createRowInSpace<TData>(
    spaceId: SpaceId,
    rowData: TData,
    position: 'top' | 'bottom' | { after: RowId } = 'bottom'
  ): RowId {
    console.log(`TableCore: Creating row in space ${spaceId} at position:`, position);

    // 1. Generate new row ID and calculate fractional index
    const newRowId = uuidv4();
    const newFractionalIndex = this.calculateFractionalIndexForSpace(spaceId, position);

    console.log(`TableCore: Generated rowId ${newRowId} with fractional index ${newFractionalIndex}`);

    // 2. Create new row object
    const newRow: import('./types').Row<TData> = {
      spaceId,
      data: rowData,
      cells: [], // Will be populated when GridRow renders
      top: null,
      bottom: null,
      fractionalIndex: newFractionalIndex
    };

    // 3. Update spatial links with neighbors
    this.updateSpatialLinks(newRowId, newRow);

    // 4. Register the new row (this will trigger Space component re-render)
    this.rowRegistry.register(newRowId, newRow);

    console.log(`TableCore: Successfully created row ${newRowId} in space ${spaceId}`);
    return newRowId;
  }

  // Helper methods for spatial neighbor finding
  private getAllRowsSortedByIndex(): import('./types').Row<any>[] {
    return this.rowRegistry.list()
      .map(rowId => this.rowRegistry.get(rowId)!)
      .filter(row => row !== undefined)
      .sort((a, b) => b.fractionalIndex.localeCompare(a.fractionalIndex)); // Descending (top to bottom)
  }

  private findVisualNeighbors(spaceId: SpaceId, newFractionalIndex: string): { aboveRow: import('./types').Row<any> | null, belowRow: import('./types').Row<any> | null } {
    const allRows = this.getAllRowsSortedByIndex();

    let aboveRow: import('./types').Row<any> | null = null;
    let belowRow: import('./types').Row<any> | null = null;

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];

      if (row.fractionalIndex > newFractionalIndex) {
        // This row is above our new row
        aboveRow = row;
        belowRow = i > 0 ? allRows[i - 1] : null;
        break;
      }
    }

    // If we didn't find any row above, new row goes at the very top
    if (!aboveRow && allRows.length > 0) {
      belowRow = allRows[allRows.length - 1]; // Last row becomes below
    }

    return { aboveRow, belowRow };
  }

  private calculateFractionalIndexForSpace(spaceId: SpaceId, position: 'top' | 'bottom' | { after: RowId }): string {
    const rowsInSpace = this.rowRegistry.list()
      .map(rowId => this.rowRegistry.get(rowId)!)
      .filter(row => row && row.spaceId === spaceId)
      .sort((a, b) => b.fractionalIndex.localeCompare(a.fractionalIndex)); // Top to bottom

    if (rowsInSpace.length === 0) {
      // Empty space - generate initial index
      return this.generateFractionalIndex();
    }

    if (position === 'top') {
      // Insert above the highest row in this space
      const highestRow = rowsInSpace[0];
      return this.generateFractionalIndex(highestRow.fractionalIndex, undefined);
    } else if (position === 'bottom') {
      // Insert below the lowest row in this space
      const lowestRow = rowsInSpace[rowsInSpace.length - 1];
      return this.generateFractionalIndex(undefined, lowestRow.fractionalIndex);
    } else {
      // Insert after specific row
      const targetRowId = position.after;
      const targetRow = this.rowRegistry.get(targetRowId);

      if (!targetRow) {
        console.warn(`TableCore: Target row ${targetRowId} not found for insertion`);
        return this.generateFractionalIndex();
      }

      // Find the row below the target row (if any)
      const allRows = this.getAllRowsSortedByIndex();
      const targetIndex = allRows.findIndex(row => row === targetRow);
      const belowRow = targetIndex < allRows.length - 1 ? allRows[targetIndex + 1] : null;

      return this.generateFractionalIndex(targetRow.fractionalIndex, belowRow?.fractionalIndex);
    }
  }

  private updateSpatialLinks(newRowId: RowId, newRow: import('./types').Row<any>): void {
    const { aboveRow, belowRow } = this.findVisualNeighbors(newRow.spaceId, newRow.fractionalIndex);

    // Update new row's links
    newRow.top = aboveRow?.top || null;  // Get the ID from the row object
    newRow.bottom = belowRow?.bottom || null;  // Get the ID from the row object

    // Update neighbor links
    if (aboveRow) {
      // Find the actual row ID for aboveRow
      const aboveRowId = this.rowRegistry.list().find(id => this.rowRegistry.get(id) === aboveRow);
      if (aboveRowId) {
        aboveRow.bottom = newRowId;
        this.rowRegistry.register(aboveRowId, aboveRow);
        newRow.top = aboveRowId;
      }
    }

    if (belowRow) {
      // Find the actual row ID for belowRow
      const belowRowId = this.rowRegistry.list().find(id => this.rowRegistry.get(id) === belowRow);
      if (belowRowId) {
        belowRow.top = newRowId;
        this.rowRegistry.register(belowRowId, belowRow);
        newRow.bottom = belowRowId;
      }
    }
  }

  // Row destruction with automatic cell cleanup
  destroyRow(rowId: RowId): void {
    console.log(`TableCore: Destroying row ${rowId}`);
    
    const row = this.rowRegistry.get(rowId);
    if (!row) {
      console.warn(`TableCore: Row ${rowId} not found for destruction`);
      return;
    }
    
    // 1. Clean up cell registrations (React handles component unmounting)
    row.cells.forEach(cellId => {
      this.cellCommandRegistry.unregister(cellId);
      this.cellRegistry.unregister(cellId);
      console.log(`TableCore: Cleaned up cell ${cellId} from destroyed row`);
    });
    
    // 2. Fix spatial navigation - link neighboring rows
    const topRowId = row.top;
    const bottomRowId = row.bottom;
    
    if (topRowId && bottomRowId) {
      console.log(`TableCore: Connecting top row ${topRowId} to bottom row ${bottomRowId}`);
      // Connect top row directly to bottom row
      this.cellCoordinator.linkRows(topRowId, bottomRowId);
      
      // Link cells between top and bottom rows (skip destroyed row)
      const topRow = this.rowRegistry.get(topRowId);
      const bottomRow = this.rowRegistry.get(bottomRowId);
      if (topRow && bottomRow) {
        this.cellCoordinator.linkRowsCells(topRow.cells, bottomRow.cells);
        console.log(`TableCore: Linked ${topRow.cells.length} cells between neighboring rows`);
      }
    } else if (topRowId) {
      // This was the last row - clear bottom reference from top row
      const topRow = this.rowRegistry.get(topRowId);
      if (topRow) {
        topRow.bottom = null;
        this.rowRegistry.register(topRowId, topRow);
        console.log(`TableCore: Cleared bottom reference from top row ${topRowId}`);
      }
    } else if (bottomRowId) {
      // This was the first row - clear top reference from bottom row
      const bottomRow = this.rowRegistry.get(bottomRowId);
      if (bottomRow) {
        bottomRow.top = null;
        this.rowRegistry.register(bottomRowId, bottomRow);
        console.log(`TableCore: Cleared top reference from bottom row ${bottomRowId}`);
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
    
    console.log(`TableCore: Row ${rowId} destruction completed`);
  }

}