# SuperGrid v3 - Architecture Documentation

## Philosophy & Core Principles

### Cell-Centric State Management
The fundamental philosophy of SuperGrid is that **cells own their state**. Unlike traditional React patterns where parent components manage child state, SuperGrid adopts a decentralized approach where each cell is responsible for its own state management including focus, selection, editing mode, and values.

**Why this matters:**
- **Performance**: Changing one cell's state doesn't trigger full table rerenders
- **Scalability**: Works efficiently with thousands of cells
- **Isolation**: Cells operate independently without complex state coordination

```typescript
// Cell manages its own state internally
const [isFocused, setIsFocused] = useState(false);
const [internalValue, setInternalValue] = useState(() => value || '');
// Props are ONLY used for initialization, never for updates
```

### Command-Driven Architecture
All interactions with cells happen through a **command system** rather than direct props or function calls. This creates a uniform interface for cell manipulation and enables powerful plugin interception capabilities.

**Command Flow:**
1. Events (mouse clicks, keyboard) are captured by the table
2. Events are converted to typed commands
3. Commands flow through plugin interception chain
4. Commands reach target cells via registered handlers

```typescript
// Example command
{
  name: 'focus',
  targetId: 'row-0-cell-1',
  timestamp: Date.now(),
  originPlugin?: 'keyboard-navigation'
}
```

### Event Isolation
Cells are completely **isolated from DOM events**. They cannot directly listen to clicks, keyboard events, or mouse interactions. Instead:

- **Row containers** capture all DOM events
- **Table Core** converts events to commands
- **Cells** only receive commands, never raw DOM events

This isolation ensures all interactions go through the command system and can be intercepted by plugins.

## Architecture Overview

### Core Components

#### TableCore - The Orchestrator
TableCore is the central nervous system that lives inside the SuperGrid component. It manages:

- **Command Registries**: Routes commands to appropriate handlers
- **Plugin Manager**: Handles plugin lifecycle and dependency resolution
- **API Factories**: Creates context-aware APIs for plugins and rows

```typescript
class TableCore {
  private cellCommandRegistry: CellCommandRegistry;
  private rowCommandRegistry: RowCommandRegistry;
  private pluginManager: PluginManager;
}
```

#### Context-Aware API System
Instead of passing context repeatedly, SuperGrid creates **bound API instances** that capture context in closures:

**TablePluginAPI** - Each plugin gets its own API instance:
```typescript
// Plugin calls this...
pluginAPI.createCellCommand(cellId, { name: 'focus' });
// TableCore automatically knows originPlugin = "plugin-name"
```

**TableRowAPI** - Each row gets its own API instance:
```typescript
// Row calls this...
rowAPI.registerCellCommands(cellId, handler);
// TableCore automatically knows this came from rowId = "row-123"
```

**Memory Efficiency**: Uses lightweight closures instead of full object instances per context.

### Command System Architecture

#### Command Types
Commands are strongly typed with automatic payload validation:

```typescript
// Commands without payload
type CellCommandNoPayload = 
  | { name: "focus" }
  | { name: "blur" }
  | { name: "select" }
  | { name: "edit" };

// Commands with payload  
type CellCommandWithPayload =
  | { name: "updateValue"; payload: { value: any } }
  | { name: "click"; payload: { event: MouseEvent } }
  | { name: "keydown"; payload: { event: KeyboardEvent } };
```

#### Command Registration & Dispatch
Cells register command handlers when they mount:

```typescript
// In TextCell component
useEffect(() => {
  registerCommands((command: CellCommand) => {
    switch (command.name) {
      case 'focus':
        setIsFocused(true);
        break;
      case 'updateValue':
        setInternalValue(command.payload.value);
        break;
    }
  });
}, [registerCommands]);
```

#### Plugin Interception
Every command flows through the plugin chain before reaching cells:

```typescript
class MyPlugin extends BasePlugin {
  onBeforeCellCommand(command: CellCommand): boolean | void {
    if (command.name === 'edit' && this.isReadOnlyMode) {
      return false; // Block the command
    }
    // Allow command to continue
  }
}
```

### Event → Command Flow

#### Mouse Events
1. **Cell Container** captures DOM mouse events
2. **Row** sends events to table via `tableApis.sendMouseEvent(cellId, eventName, event)`
3. **TableCore** converts events to commands via `convertMouseEventToCommand`
4. **Commands** dispatched through plugin chain
5. **Target Cell** receives command via registered handler

```typescript
// Row container captures click
<div onClick={(e) => tableApis.sendMouseEvent(cellId, 'click', e.nativeEvent)}>
  <CellComponent />
</div>

// TableCore converts to command
{
  name: 'click',
  targetId: cellId,
  payload: { event },
  timestamp: Date.now()
}
```

#### Keyboard Events (Planned)
Keyboard events will be captured at the table level and broadcast to ALL cells as commands, since keyboard navigation affects the entire grid state.

### Plugin System

#### BasePlugin Architecture
Plugins extend `BasePlugin` and must implement command interception methods:

```typescript
abstract class BasePlugin {
  abstract readonly name: string;
  abstract readonly version: string;
  readonly dependencies: string[] = [];

  // Mandatory command interception
  abstract onBeforeCellCommand(command: CellCommand): boolean | void;
  abstract onBeforeRowCommand(command: RowCommand): boolean | void;

  // Optional lifecycle
  onInit?(): void;
  onDestroy?(): void;
}
```

#### Plugin Capabilities
Plugins can:
- **Block commands** by returning `false`
- **Modify commands** by changing command object properties
- **Create new commands** via context-aware APIs
- **Access other plugins** via dependency system

#### Plugin Context Awareness
Plugins receive pre-bound APIs that automatically inject their plugin name:

```typescript
// Plugin doesn't need to pass its name
tableAPI.createCellCommand(cellId, { name: 'focus' });
// TableCore automatically adds: originPlugin = 'my-plugin'
```

### Spatial Navigation System

#### Cell Coordination
The `CellCoordinator` manages spatial relationships between cells and rows:

```typescript
// Cell relationships
type Cell = {
  rowId: RowId;
  top: CellId | null;
  bottom: CellId | null; 
  left: CellId | null;
  right: CellId | null;
};

// Row relationships (NEW)
type Row<T> = {
  spaceId: SpaceId;
  data: T;
  cells: CellId[];
  top: RowId | null;    // Added for row navigation
  bottom: RowId | null; // Added for row navigation
};
```

#### Navigation Methods
- `linkVertical(topId, bottomId)` - Connect cells vertically
- `linkHorizontal(leftId, rightId)` - Connect cells horizontally  
- `linkRows(topRowId, bottomRowId)` - Connect entire rows
- `linkRowsCells(topCells[], bottomCells[])` - Connect corresponding cells between rows

### Data Flow Philosophy

#### Props vs Commands
**Props are initialization-only**. After first render, cells ignore prop changes:

```typescript
// ✅ Correct: Initialize state once from props
const [internalValue, setInternalValue] = useState(() => value || '');

// ❌ Wrong: Would cause rerenders on data changes  
const [internalValue, setInternalValue] = useState(value || '');

// ✅ Correct: Updates come via commands
case 'updateValue':
  setInternalValue(command.payload.value);
```

**Why this matters:**
- Prevents cascade rerenders when table data changes
- Enables surgical updates to specific cells
- Maintains performance with large datasets

#### State Ownership
- **Table**: Knows layout, coordinates events, manages plugins
- **Rows**: Manage cell registration and event routing  
- **Cells**: Own all their state (focus, value, selection, editing)

## Current Implementation Status

### ✅ Completed Systems

1. **Core Architecture**
   - TableCore orchestrator
   - Context-aware API factories
   - Command registries with plugin support

2. **Command System**
   - Typed command definitions
   - Cell command registration
   - Mouse event → command conversion
   - Plugin interception chain

3. **Plugin Framework**
   - BasePlugin abstract class
   - PluginManager with dependency resolution
   - Mandatory command interception

4. **Spatial Navigation**
   - CellCoordinator with cell linking
   - Row-level navigation support
   - Bidirectional relationships

5. **Cell Implementation**
   - TextCell with visual states
   - State initialization from props
   - Command-driven state updates

### 🚧 In Progress

1. **Layout System**
   - Basic flex layout implemented
   - Column width support
   - Row rendering issues (timing problems)

### 📋 Planned Features

1. **Keyboard Navigation**
   - Table-level keyboard capture
   - Arrow key navigation between cells
   - Tab navigation
   - Keyboard shortcuts

2. **Cell Types**
   - NumberCell, DateCell, SelectCell
   - Custom cell component system
   - Cell validation framework

3. **Advanced Plugins**
   - Selection manager
   - Clipboard operations
   - Undo/redo system
   - Data validation

4. **Performance Optimizations**
   - Virtualization for large datasets
   - Lazy cell rendering
   - Command batching

## Technical Decisions & Rationale

### Why Context-Aware APIs?
Alternative approaches considered:
- **Passing context every time**: `api.createCommand(pluginName, cellId, command)` - Repetitive
- **Global singleton with context**: Hard to test, not type-safe
- **Bound closures**: ✅ Clean API, type-safe, minimal memory overhead

### Why Mandatory Plugin Interception?
Forces plugin developers to handle all command types, preventing silent failures when new commands are added.

### Why Cell State Isolation?
Enables the grid to scale to thousands of cells without performance degradation. Each cell operates independently without complex coordination.

### Why Command System vs Direct Function Calls?
- **Uniformity**: All interactions use same interface
- **Interception**: Plugins can modify any interaction
- **Debugging**: All actions are traceable commands
- **Extension**: Easy to add new interaction types

## Future Architecture Considerations

### Cell Action APIs (Complex)
The most complex API system will be CellActionAPIs for plugin actions within cells:
- **Context**: `pluginName + cellId + actionId`
- **Space Complexity**: `O(plugins × cells × actions)`
- **Optimization needed**: Lazy creation, pooling, or proxy patterns

### Performance Scaling
Current architecture is designed for 10,000+ cells:
- Command system adds minimal overhead per interaction
- Cell state isolation prevents rerender cascades
- Plugin system allows feature additions without core changes

### Extension Points
The architecture provides multiple extension points:
- **New cell types**: Implement `CellComponent` interface
- **New commands**: Add to command type unions
- **New plugins**: Extend `BasePlugin`
- **New navigation**: Extend `CellCoordinator`

This architecture balances performance, extensibility, and developer experience while maintaining clear separation of concerns.