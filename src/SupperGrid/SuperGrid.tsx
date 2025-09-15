import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { TableProps, RowProps, RowId, CellId, SpaceId, CellCommand, Cell, CellCommandHandeler, RowCommandHandler, SpaceCommandHandler } from './core/types';
import { TableCore } from './core/TableCore';
import type { BasePlugin } from './core/BasePlugin';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './core/utils';
import { TableContext, type TableContextValue, useTableContext } from './core/TableContext';
import { Space } from './components/Space';

interface SuperGridProps<TData> extends TableProps<TData> {
    plugins?: BasePlugin[];
}

export interface SuperGridRef {
    dispatchCellCommand: (command: CellCommand) => void;
    focusCell: (cellId: CellId) => void;
    blurCell: (cellId: CellId) => void;
    selectCell: (cellId: CellId) => void;
    editCell: (cellId: CellId) => void;
    updateCellValue: (cellId: CellId, value: any) => void;
    destroyRow: (rowId: RowId) => void;
    getTableCore: () => TableCore | null;
}

export const SuperGrid = forwardRef<SuperGridRef, SuperGridProps<any>>(function SuperGrid<TData>({ data, config, plugins = [] }: SuperGridProps<TData>, ref: React.Ref<SuperGridRef>) {
    const tableCoreRef = useRef<TableCore | null>(null);
    const [tableCoreReady, setTableCoreReady] = useState(false);

    // Expose TableCore methods through ref
    useImperativeHandle(ref, () => ({
        dispatchCellCommand: (command: CellCommand) => {
            tableCoreRef.current?.dispatchCellCommand(command);
        },
        focusCell: (cellId: CellId) => {
            tableCoreRef.current?.focusCell(cellId);
        },
        blurCell: (cellId: CellId) => {
            tableCoreRef.current?.blurCell(cellId);
        },
        selectCell: (cellId: CellId) => {
            tableCoreRef.current?.selectCell(cellId);
        },
        editCell: (cellId: CellId) => {
            tableCoreRef.current?.editCell(cellId);
        },
        updateCellValue: (cellId: CellId, value: any) => {
            tableCoreRef.current?.updateCellValue(cellId, value);
        },
        destroyRow: (rowId: RowId) => {
            tableCoreRef.current?.destroyRow(rowId);
        },
        getTableCore: () => tableCoreRef.current
    }), []);

    useEffect(() => {
        if (!tableCoreRef.current) {
            tableCoreRef.current = new TableCore();

            // Add plugins
            plugins.forEach(plugin => {
                tableCoreRef.current!.addPlugin(plugin);
            });

            // Initialize plugins with their context-aware APIs
            tableCoreRef.current.initializePlugins();
        }

        setTableCoreReady(true);

        // Document-level keyboard event listeners
        const handleKeyDown = (event: KeyboardEvent) => {
            if (tableCoreRef.current) {
                tableCoreRef.current.dispatchKeyboardCommand('keydown', event);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (tableCoreRef.current) {
                tableCoreRef.current.dispatchKeyboardCommand('keyup', event);
            }
        };

        // Add listeners to document
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            // Cleanup on unmount
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            tableCoreRef.current?.destroy();
        };
    }, [plugins]);

    // Cell linking is now handled by individual Space components

    // Create table context value
    const tableContextValue: TableContextValue = {
        sendMouseEvent: (cellId: CellId, eventName: string, event: MouseEvent) => {
            tableCoreRef.current?.convertMouseEventToCommand(cellId, eventName, event);
        },
        sendKeyboardEvent: (cellId: CellId, eventName: string, event: KeyboardEvent) => {
            // TODO: Implement keyboard event handling
            console.log('Keyboard event not yet implemented:', cellId, eventName, event);
        },
        registerCellCommands: (cellId: CellId, handler: CellCommandHandeler) => {
            tableCoreRef.current?.getCellCommandRegistry().register(cellId, handler);
        },
        registerCell: (cellId: CellId, cell: Cell) => {
            tableCoreRef.current?.getCellRegistry().register(cellId, cell);
        },
        addCellToRow: (rowId: RowId, cellId: CellId) => {
            const row = tableCoreRef.current?.getRowRegistry().get(rowId);
            if (row) {
                if (!row.cells.includes(cellId)) {
                    row.cells.push(cellId);
                    tableCoreRef.current?.getRowRegistry().register(rowId, row);
                }
            }
        },
        registerRowHandler: (rowId: RowId, handler: RowCommandHandler) => {
            tableCoreRef.current?.getRowCommandRegistry().register(rowId, handler);
        },
        unregisterRowHandler: (rowId: RowId) => {
            tableCoreRef.current?.getRowCommandRegistry().unregister(rowId);
        },
        registerSpaceHandler: (spaceId: SpaceId, handler: SpaceCommandHandler) => {
            tableCoreRef.current?.getSpaceCommandRegistry().register(spaceId, handler);
        },
        unregisterSpaceHandler: (spaceId: SpaceId) => {
            tableCoreRef.current?.getSpaceCommandRegistry().unregister(spaceId);
        },
        getCellCoordinator: () => {
            return tableCoreRef.current!.getCellCoordinator();
        }
    };

    // Render spaces in dependency order + table space at bottom
    const renderSpaces = () => {
        if (!tableCoreReady || !tableCoreRef.current) {
            return null;
        }

        const spaces = [];

        // Get plugins in dependency order (same order as initialization)
        const orderedPlugins = tableCoreRef.current.getPluginManager().getPluginsInOrder();

        // Render plugin spaces in dependency order
        orderedPlugins.forEach(plugin => {
            const spaceId = `space-${plugin.name}`;
            spaces.push(
                <Space
                    key={spaceId}
                    id={spaceId}
                    data={[]} // Plugin spaces start empty, plugins will populate them
                    tableCore={tableCoreRef.current!}
                    config={config}
                    GridRow={GridRow}
                />
            );
        });

        // Add table space at the very bottom (for main data)
        spaces.push(
            <Space
                key="table-space"
                id="table-space"
                data={data} // Main table data
                tableCore={tableCoreRef.current!}
                config={config}
                GridRow={GridRow}
            />
        );

        return spaces;
    };


    return (
        <TableContext.Provider value={tableContextValue}>
            <div className="w-fit">
                {/* Header row */}
                <div className="flex">
                    {config.map((col, index) => (
                        <div
                            key={index}
                            className={cn(
                                'border-neutral-200 border-[0.5px] h-10 inset-0 box-border',
                                'ring-[0.5px] ring-inset ring-transparent'
                            )}
                            style={{ width: `calc(${col.width} + 1px)` }}
                        >
                            <div className="h-full w-full flex justify-start items-center p-2 bg-stone-50 hover:bg-stone-100 hover:ring-stone-800 ring-transparent ring-[0.5px]">
                                {col.header}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Spaces (plugin spaces + table space) */}
                <div className="w-full">
                    {renderSpaces()}
                </div>
            </div>
        </TableContext.Provider>
    );
});

// Row component that uses the TableContext
function GridRow<TData>({ id, data, columns, rowIndex }: RowProps<TData>) {
    const tableContext = useTableContext();
    const [isDestroyed, setIsDestroyed] = useState(false);
    const renderCountRef = useRef(0);
    
    // Increment render counter and log
    renderCountRef.current += 1;
    console.log(`GridRow ${id.slice(0, 8)}... render #${renderCountRef.current} (rowIndex: ${rowIndex})`);
    
    // Generate stable cell IDs with spatial coordinates (only once per row instance)
    const cellIdsRef = useRef<CellId[]>([]);

    // Initialize cell IDs with spatial coordinates if not already done
    if (cellIdsRef.current.length !== columns.length) {
        cellIdsRef.current = columns.map((_, colIndex) =>
            `${colIndex.toString().padStart(2, '0')}-${rowIndex.toString().padStart(2, '0')}-${uuidv4()}`
            // Example: "01-02-a1b2c3d4-e5f6-7890-abcd-ef1234567890" (col=1, row=2)
        );
    }

    // Register row command handler
    useEffect(() => {
        const handleRowCommand: RowCommandHandler = (command) => {
            console.log(`GridRow ${id}: Received row command:`, command.name);
            switch (command.name) {
                case 'destroy':
                    console.log(`GridRow ${id}: Destroying row`);
                    setIsDestroyed(true);
                    break;
                default:
                    console.log(`GridRow ${id}: Unhandled row command:`, command.name);
                    break;
            }
        };

        tableContext.registerRowHandler(id, handleRowCommand);

        return () => {
            tableContext.unregisterRowHandler(id);
        };
    }, [id, tableContext]);

    // Row creates cell-specific registerCommands functions
    const createCellRegisterFunction = (cellId: string) => {
        return (handler: CellCommandHandeler) => {
            // Row uses TableContext to register the cell with the table
            tableContext.registerCellCommands(cellId, handler);
        };
    };

    // If row is destroyed, render nothing (React will unmount all child cells)
    if (isDestroyed) {
        console.log(`GridRow ${id.slice(0, 8)}... render #${renderCountRef.current} - DESTROYED, returning null`);
        return null;
    }

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
                tableContext.registerCell(cellId, cellObject);
                tableContext.addCellToRow(id, cellId);

                // Create cell-specific registerCommands function
                const cellRegisterCommands = createCellRegisterFunction(cellId);

                // Create cell props with the cell-aware registerCommands function
                const cellProps = {
                    id: cellId,
                    value: cellValue,
                    config: column, // This should have the proper cell config
                    registerCommands: cellRegisterCommands
                };

                // Render the actual cell component wrapped in event-capturing container
                const CellComponent = column.cell;
                return (
                    <div
                        key={cellId}
                        className={cn(
                            'border-[0.5px] border-neutral-200 inset-0 box-border'
                        )}
                        data-cell-id={cellId}
                        style={{ width: `calc(${column.width} + 1px)` }}
                        onClick={(e) => tableContext.sendMouseEvent(cellId, 'click', e.nativeEvent)}
                        onDoubleClick={(e) => tableContext.sendMouseEvent(cellId, 'dblclick', e.nativeEvent)}
                        onContextMenu={(e) => tableContext.sendMouseEvent(cellId, 'contextmenu', e.nativeEvent)}
                        onMouseDown={(e) => tableContext.sendMouseEvent(cellId, 'mousedown', e.nativeEvent)}
                        onMouseUp={(e) => tableContext.sendMouseEvent(cellId, 'mouseup', e.nativeEvent)}
                        onMouseEnter={(e) => tableContext.sendMouseEvent(cellId, 'mouseenter', e.nativeEvent)}
                        onMouseLeave={(e) => tableContext.sendMouseEvent(cellId, 'mouseleave', e.nativeEvent)}
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
