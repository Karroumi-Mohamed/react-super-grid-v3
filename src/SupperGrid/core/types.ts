type SpaceId = string;
type RowId = string;
type CellId = string;

type Space = {
    name: string;
    owner?: string; // plugin name or table if no owner
    top: SpaceId | null;
    bottom: SpaceId | null;
    rowIds: RowId[]; // Track rows in this space
};

type Row<T> = {
    spaceId: SpaceId;
    data: T;
    cells: CellId[];
    top: RowId | null;
    bottom: RowId | null;
    rowString: string; // String position for Y indexing
};

type Cell = {
    rowId: RowId;
    top: CellId | null;
    bottom: CellId | null;
    left: CellId | null;
    right: CellId | null;
};

interface RegistryI<T_ID, T_Obj> {
    register(id: T_ID, obj: T_Obj): boolean; // true = new, false = overwritten
    unregister(id: T_ID): boolean; // true = existed and removed
    get(id: T_ID): T_Obj | undefined;
    has(id: T_ID): boolean;
    list(): T_ID[];
    clear(): void;
}

type CellCoordinate = "Top" | "Bottom" | "Left" | "Right";

interface CellCoordinatorI {
    linkVertical(topId: CellId, bottomId: CellId): void;
    linkHorizontal(leftId: CellId, rightId: CellId): void;
    linkRows(top: RowId, bottom: RowId): void;
    linkRowsCells(top: CellId[], bottom: CellId[]): void;
    clearCoordinate(cellId: CellId, coord: CellCoordinate): void;
}

export type {
    CellId,
    SpaceId,
    RowId,
    Cell,
    Row,
    Space,
    RegistryI,
    CellCoordinate,
    CellCoordinatorI,
};

// APIs and Commands
type CellCommandNoPayload =
  | { name: "focus" }
  | { name: "blur" }
  | { name: "edit" }
  | { name: "exitEdit" }
  | { name: "select" }
  | { name: "unselect" };

type CellCommandWithPayload =
  | { name: "updateValue"; payload: { value: any } }
  | { name: "click"; payload: { event: MouseEvent } }
  | { name: "dblclick"; payload: { event: MouseEvent } }
  | { name: "contextmenu"; payload: { event: MouseEvent } }
  | { name: "keydown"; payload: { event: KeyboardEvent } }
  | { name: "keyup"; payload: { event: KeyboardEvent } }
  | { name: "mouseDown"; payload: { event: MouseEvent } }
  | { name: "mouseUp"; payload: { event: MouseEvent } }
  | { name: "mouseEnter"; payload: { event: MouseEvent } }
  | { name: "mouseLeave"; payload: { event: MouseEvent } }
  | { name: "error"; payload: { error: any } };


type CellCommand =
  | (CellCommandNoPayload & {
      targetId?: CellId; // Optional - commands without targetId are plugin-only
      originPlugin?: string;
      timestamp?: number;
    })
  | (CellCommandWithPayload & {
      targetId?: CellId; // Optional - commands without targetId are plugin-only
      originPlugin?: string;
      timestamp?: number;
    });

type RowCommandMap = {
  delete: {};
  destroy: {};
  linkToTop: { targetRowId: RowId };
  linkToBottom: { targetRowId: RowId };
  error: { error: any };
};

type RowCommand<K extends keyof RowCommandMap = keyof RowCommandMap> = {
  name: K;
  payload: RowCommandMap[K];
  targetId: RowId;
  originPlugin?: string;
  timestamp?: number;
};

type SpaceCommandMap = {
  addRow: { rowData: any; position?: 'top' | 'bottom' };
  // Note: deleteRow is handled by RowCommand system, not SpaceCommand
};

type SpaceCommand<K extends keyof SpaceCommandMap = keyof SpaceCommandMap> = {
  name: K;
  payload: SpaceCommandMap[K];
  targetId: SpaceId;
  originPlugin?: string;
  timestamp?: number;
};

export type { CellCommand, RowCommand, RowCommandMap, SpaceCommand, SpaceCommandMap, SpaceCommandHandler };


type CellCommandHandeler = (command: CellCommand) => void;
type RowCommandHandler = (command: RowCommand<any>) => void;
type SpaceCommandHandler = (command: SpaceCommand<any>) => void;

interface TableRowAPI {
    registerCellCommands: (cellId: CellId, handler: CellCommandHandeler) => void;
    registerCell: (cellId: CellId, cell: Cell) => void;
    addCellToRow: (cellId: CellId) => void;
    sendMouseEvent: (cellId: CellId, eventName: string, event: MouseEvent) => void;
    getCellCoordinator: () => CellCoordinatorI;
    registerRowHandler: (handler: RowCommandHandler) => void;
    unregisterRowHandler: () => void;
}

export type { CellCommandHandeler, RowCommandHandler, TableRowAPI };

/// components
interface BaseCellConfig {
    header: string;
    width?: number | string;
    sortable?: boolean;
    filterable?: boolean;
    foldable?: boolean;
    foldedColor?: string;
    editable?: boolean;
    focusable?: boolean;
    selectable?: boolean;
    className?: string;
}

type CellProps<T, C extends BaseCellConfig> = {
    id: CellId;
    value: T | null; // Force cells to handle null values
    config: C;
    registerCommands: (handler: CellCommandHandeler) => void;
    // registerCommands, registerActions, executeAction for later
};

type CellComponent<T, C extends BaseCellConfig> = React.FC<CellProps<T, C>>;

type ExtractCellConfig<T> = T extends CellComponent<any, infer C> ? C : never;
export type { BaseCellConfig, CellProps, CellComponent, ExtractCellConfig };

type RowProps<T> = {
    id: RowId;
    data: T;
    columns: TableConfig<T>;
    tableApis: TableRowAPI;
    rowIndex: number;
    rowString: string; // String-based row position for cell ID generation
    isLastRow?: boolean;
};

export type { RowProps };

type TableConfig<TData> = Array<
    {
        key: keyof TData;
        cell: CellComponent<any, any>;
    } & Record<string, any>
>;

type TableProps<TData> = {
    data: TData[];
    config: TableConfig<TData>;
    // plugins
};

export type { TableProps, TableConfig };
