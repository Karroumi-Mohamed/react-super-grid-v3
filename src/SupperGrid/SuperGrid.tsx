import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type JSX } from 'react';
import type { TableProps, RowProps, RowId, CellId, CellCommand, Cell, CellCommandHandeler, RowCommandHandler, SpaceId } from './core/types';
import { TableCore } from './core/TableCore';
import type { BasePlugin } from './core/BasePlugin';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './core/utils';
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
    }, []); // Remove plugins dependency to prevent recreation

    // TODO: Implement cross-space cell linking
    // This will link cells between spaces (e.g., bottom cells of Space A to top cells of Table Space)
    useEffect(() => {
        if (tableCoreReady && tableCoreRef.current) {
            // For now, each space handles its internal cell linking
        }
    }, [data, tableCoreReady]);

    // Render spaces in plugin dependency order + table space at bottom
    const renderSpaces = () => {
        if (!tableCoreRef.current || !tableCoreReady) {
            return null;
        }

        const spaces: JSX.Element[] = [];

        // Get plugin spaces in dependency order (first processed = top)
        const orderedPlugins = tableCoreRef.current.getPluginManager().getPluginsInOrder();

        // Render plugin spaces (empty for now, will be populated by SpaceCommands later)
        orderedPlugins.forEach(plugin => {
            const spaceId: SpaceId = `space-${plugin.name}`;
            spaces.push(
                <Space
                    key={spaceId}
                    spaceId={spaceId}
                    tableCore={tableCoreRef.current!}
                    config={config}
                />
            );
        });

        // Create and render table space at the bottom with initial data
        const tableSpaceId: SpaceId = 'table-space';

        // Create table space in registry if it doesn't exist
        const spaceRegistry = tableCoreRef.current.getSpaceRegistry();
        if (!spaceRegistry.has(tableSpaceId)) {
            const tableSpace: import('./core/types').Space = {
                name: 'Table Space',
                owner: 'table',
                top: null,
                bottom: null,
                rowIds: []
            };
            spaceRegistry.register(tableSpaceId, tableSpace);
        }

        spaces.push(
            <Space
                key={tableSpaceId}
                spaceId={tableSpaceId}
                tableCore={tableCoreRef.current!}
                config={config}
                initialData={data} // Pass initial data to table space
            />
        );

        return spaces;
    };

    return (
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
            {/* Spaces: Plugin spaces (top) + Table space (bottom) */}
            <div className="w-full">
                {renderSpaces()}
            </div>
        </div>
    );
});

// Row component that uses the context-aware TableRowAPI
export function GridRow<TData>({ id, data, columns, tableApis, rowString }: RowProps<TData>) {
    const [isDestroyed, setIsDestroyed] = useState(false);
    const renderCountRef = useRef(0);

    // Increment render counter and log
    renderCountRef.current += 1;

    // Generate stable cell IDs with spatial coordinates (only once per row instance)
    const cellIdsRef = useRef<CellId[]>([]);

    // Initialize cell IDs with spatial coordinates if not already done
    if (cellIdsRef.current.length !== columns.length) {
        cellIdsRef.current = columns.map((_, colIndex) =>
            `${colIndex.toString().padStart(2, '0')}-${rowString}-${uuidv4()}`
            // New format: "01-30-a1b2c3d4-e5f6-7890-abcd-ef1234567890" (col=1, row="30")
        );
    }

    // Register row command handler
    useEffect(() => {
        const handleRowCommand: RowCommandHandler = (command) => {
            switch (command.name) {
                case 'destroy':
                    setIsDestroyed(true);
                    break;
                default:
                    break;
            }
        };

        tableApis.registerRowHandler(handleRowCommand);

        return () => {
            tableApis.unregisterRowHandler();
        };
    }, [id, tableApis]);

    // Row creates cell-specific registerCommands functions
    const createCellRegisterFunction = (cellId: string) => {
        return (handler: CellCommandHandeler) => {
            // Row uses TableRowAPI to register the cell with the table
            tableApis.registerCellCommands(cellId, handler);
        };
    };

    // If row is destroyed, render nothing (React will unmount all child cells)
    if (isDestroyed) {
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
                tableApis.registerCell(cellId, cellObject);
                tableApis.addCellToRow(cellId);

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
