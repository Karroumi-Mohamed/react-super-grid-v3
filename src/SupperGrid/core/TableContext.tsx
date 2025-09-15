import { createContext, useContext } from 'react';
import type { CellId, RowId, SpaceId, CellCommandHandeler, RowCommandHandler, SpaceCommandHandler, Cell } from './types';

export interface TableContextValue {
    // Event reporting
    sendMouseEvent: (cellId: CellId, eventName: string, event: MouseEvent) => void;
    sendKeyboardEvent: (cellId: CellId, eventName: string, event: KeyboardEvent) => void;

    // Cell registration
    registerCellCommands: (cellId: CellId, handler: CellCommandHandeler) => void;
    registerCell: (cellId: CellId, cell: Cell) => void;
    addCellToRow: (rowId: RowId, cellId: CellId) => void;

    // Row registration
    registerRowHandler: (rowId: RowId, handler: RowCommandHandler) => void;
    unregisterRowHandler: (rowId: RowId) => void;

    // Space registration
    registerSpaceHandler: (spaceId: SpaceId, handler: SpaceCommandHandler) => void;
    unregisterSpaceHandler: (spaceId: SpaceId) => void;

    // Spatial coordination
    getCellCoordinator: () => import('./CellCordinator').CellCoordinator;
}

export const TableContext = createContext<TableContextValue | null>(null);

export function useTableContext(): TableContextValue {
    const context = useContext(TableContext);
    if (!context) {
        throw new Error('useTableContext must be used within a TableContext.Provider');
    }
    return context;
}