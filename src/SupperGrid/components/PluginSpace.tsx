import { useEffect, useRef, useState } from 'react';
import type { RowId, CellId, Cell, CellCommandHandeler, RowCommandHandler, TableConfig } from '../core/types';
import type { TableCore } from '../core/TableCore';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../core/utils';

interface PluginSpaceProps<TData> {
    spaceId: string;
    tableCore: TableCore;
    config: TableConfig<TData>;
}

export function PluginSpace<TData>({ spaceId, tableCore, config }: PluginSpaceProps<TData>) {
    const [rowIds, setRowIds] = useState<RowId[]>([]);
    const renderCountRef = useRef(0);
    
    // Increment render counter and log
    renderCountRef.current += 1;
    console.log(`PluginSpace ${spaceId.slice(0, 12)}... render #${renderCountRef.current}`);
    
    // Subscribe to space changes - only load once for now
    useEffect(() => {
        const space = tableCore.getSpaceRegistry().get(spaceId);
        if (space) {
            setRowIds([...space.rowIds]);
            console.log(`PluginSpace ${spaceId}: Initial load with ${space.rowIds.length} rows`);
        }
    }, [spaceId, tableCore]);
    
    // Render rows in this space
    const renderRows = () => {
        return rowIds.map((rowId, index) => {
            const row = tableCore.getRowRegistry().get(rowId);
            if (!row) return null;
            
            const tableApis = tableCore.createRowAPI(rowId);
            
            return (
                <PluginRow
                    key={rowId}
                    id={rowId}
                    data={row.data}
                    columns={config}
                    tableApis={tableApis}
                    rowIndex={index}
                />
            );
        });
    };
    
    if (rowIds.length === 0) {
        return null; // Don't render empty spaces
    }
    
    return (
        <div className="plugin-space" data-space-id={spaceId}>
            {renderRows()}
        </div>
    );
}

// Plugin Row component (similar to GridRow but for plugin spaces)
function PluginRow<TData>({ id, data, columns, tableApis, rowIndex }: {
    id: RowId;
    data: TData;
    columns: TableConfig<TData>;
    tableApis: import('../core/types').TableRowAPI;
    rowIndex: number;
}) {
    const [isDestroyed, setIsDestroyed] = useState(false);
    const renderCountRef = useRef(0);
    const cellIdsRef = useRef<CellId[]>([]);
    
    // Increment render counter and log
    renderCountRef.current += 1;
    console.log(`PluginRow ${id.slice(0, 8)}... render #${renderCountRef.current} (rowIndex: ${rowIndex})`);
    
    // Initialize cell IDs with spatial coordinates if not already done
    if (cellIdsRef.current.length !== columns.length) {
        cellIdsRef.current = columns.map((_, colIndex) =>
            `${colIndex.toString().padStart(2, '0')}-${rowIndex.toString().padStart(2, '0')}-${uuidv4()}`
        );
    }
    
    // Register row command handler
    useEffect(() => {
        const handleRowCommand: RowCommandHandler = (command) => {
            console.log(`PluginRow ${id}: Received row command:`, command.name);
            switch (command.name) {
                case 'destroy':
                    console.log(`PluginRow ${id}: Destroying row`);
                    setIsDestroyed(true);
                    break;
                default:
                    console.log(`PluginRow ${id}: Unhandled row command:`, command.name);
                    break;
            }
        };
        
        tableApis.registerRowHandler(handleRowCommand);
        
        return () => {
            tableApis.unregisterRowHandler();
        };
    }, [id, tableApis]);
    
    // If row is destroyed, render nothing
    if (isDestroyed) {
        console.log(`PluginRow ${id.slice(0, 8)}... render #${renderCountRef.current} - DESTROYED, returning null`);
        return null;
    }
    
    // Row creates cell-specific registerCommands functions
    const createCellRegisterFunction = (cellId: string) => {
        return (handler: CellCommandHandeler) => {
            tableApis.registerCellCommands(cellId, handler);
        };
    };
    
    return (
        <div className="w-full flex" data-row-id={id}>
            {columns.map((column, index) => {
                const cellId = cellIdsRef.current[index];
                const cellValue = data[column.key];
                const previousCellId = index > 0 ? cellIdsRef.current[index - 1] : null;
                const nextCellId = index < columns.length - 1 ? cellIdsRef.current[index + 1] : null;
                
                // Create Cell object with spatial coordinates
                const cellObject: Cell = {
                    rowId: id,
                    top: null,        // Will be linked after all rows are created
                    bottom: null,     // Will be linked after all rows are created
                    left: previousCellId,   // Link to the previous cell in this row
                    right: nextCellId       // Link to the next cell in this row
                };
                
                // Register the cell object and add to row
                tableApis.registerCell(cellId, cellObject);
                tableApis.addCellToRow(cellId);
                
                // Create cell-specific registerCommands function
                const cellRegisterCommands = createCellRegisterFunction(cellId);
                
                // Create cell props
                const cellProps = {
                    id: cellId,
                    value: cellValue,
                    config: column,
                    registerCommands: cellRegisterCommands
                };
                
                // Render the actual cell component
                const CellComponent = column.cell;
                return (
                    <div
                        key={cellId}
                        className={cn(
                            'border-[0.5px] border-neutral-200 inset-0 box-border'
                        )}
                        data-cell-id={cellId}
                        style={{ width: `calc(${column.width} + 1px)` }}
                        onClick={(e) => tableApis.sendMouseEvent(cellId, 'click', e.nativeEvent)}
                        onDoubleClick={(e) => tableApis.sendMouseEvent(cellId, 'dblclick', e.nativeEvent)}
                        onContextMenu={(e) => tableApis.sendMouseEvent(cellId, 'contextmenu', e.nativeEvent)}
                        onMouseDown={(e) => tableApis.sendMouseEvent(cellId, 'mousedown', e.nativeEvent)}
                        onMouseUp={(e) => tableApis.sendMouseEvent(cellId, 'mouseup', e.nativeEvent)}
                        onMouseEnter={(e) => tableApis.sendMouseEvent(cellId, 'mouseenter', e.nativeEvent)}
                        onMouseLeave={(e) => tableApis.sendMouseEvent(cellId, 'mouseleave', e.nativeEvent)}
                    >
                        <div className="h-full w-full">
                            <CellComponent {...cellProps} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}