import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { TableProps, RowProps, RowId, CellId, CellCommand, Cell, CellCommandHandeler } from './core/types';
import { TableCore } from './core/TableCore';
import type { BasePlugin } from './core/BasePlugin';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './core/utils';

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

    // Store row IDs to maintain stable UUIDs and proper linking
    const rowIdsRef = useRef<RowId[]>([]);

    // Link cells vertically across rows after all rows are rendered
    useEffect(() => {
        if (tableCoreReady && tableCoreRef.current && rowIdsRef.current.length > 1) {
            console.log('SuperGrid: Linking cells vertically across rows');

            const rowRegistry = tableCoreRef.current.getRowRegistry();
            const coordinator = tableCoreRef.current.getCellCoordinator();

            // Use visual order from rowIdsRef (which matches data array order)
            for (let i = 0; i < rowIdsRef.current.length - 1; i++) {
                const currentRowId = rowIdsRef.current[i];     // Visual position i
                const nextRowId = rowIdsRef.current[i + 1];    // Visual position i+1

                const currentRow = rowRegistry.get(currentRowId);
                const nextRow = rowRegistry.get(nextRowId);

                console.log(`SuperGrid: Linking row ${i} (${currentRowId.slice(0, 8)}...) to row ${i + 1} (${nextRowId.slice(0, 8)}...)`);

                if (currentRow && nextRow &&
                    currentRow.cells.length === nextRow.cells.length) {
                    // Link corresponding cells between visually adjacent rows
                    coordinator.linkRowsCells(currentRow.cells, nextRow.cells);
                    console.log(`SuperGrid: Linked ${currentRow.cells.length} cells between rows`);
                } else {
                    console.warn(`SuperGrid: Cannot link rows ${i} and ${i + 1} - missing data or cell count mismatch`);
                }
            }
            console.log('SuperGrid: Vertical cell linking completed');
        }
    }, [data, tableCoreReady]); // Re-run when data changes or table becomes ready

    // Create row components with context-aware APIs
    const renderRows = () => {
        // Ensure we have stable UUIDs for each row
        if (rowIdsRef.current.length !== data.length) {
            // Generate UUIDs for new rows or adjust for removed rows
            const newRowIds: RowId[] = [];
            for (let i = 0; i < data.length; i++) {
                if (i < rowIdsRef.current.length) {
                    newRowIds[i] = rowIdsRef.current[i]; // Keep existing UUID
                } else {
                    newRowIds[i] = uuidv4(); // Generate new UUID
                }
            }
            rowIdsRef.current = newRowIds;
        }

        return data.map((rowData, index) => {
            const rowId: RowId = rowIdsRef.current[index];
            const isLastRow = index === data.length - 1;

            // Create context-aware API for this specific row
            if (!tableCoreRef.current || !tableCoreReady) {
                console.log('not created yet');
                return null
            }

            console.log('created');

            // Create and register the Row object in the row registry
            const rowObject: import('./core/types').Row<TData> = {
                spaceId: 'default-space', // For now use default space
                data: rowData,
                cells: [], // Will be populated by the row component
                top: index > 0 ? rowIdsRef.current[index - 1] : null,
                bottom: index < data.length - 1 ? rowIdsRef.current[index + 1] : null
            };

            // Register the row object
            const tableCore = tableCoreRef.current;
            tableCore.getRowRegistry().register(rowId, rowObject);

            const tableApis = tableCoreRef.current.createRowAPI(rowId);

            // Create row props with the bound API
            const rowProps: RowProps<TData> = {
                id: rowId,
                data: rowData,
                columns: config,
                tableApis, // This is the context-aware API bound to this row's ID
                rowIndex: index, // Pass the row index for spatial coordinates
                isLastRow // Pass whether this is the last row
            };

            return <GridRow key={rowId} {...rowProps} />;
        });
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
            {/* Data rows */}
            <div className="w-full">
                {renderRows()}
            </div>
        </div>
    );
});

// Row component that uses the context-aware TableRowAPI
function GridRow<TData>({ id, data, columns, tableApis, rowIndex }: RowProps<TData>) {
    // Generate stable cell IDs with spatial coordinates (only once per row instance)
    const cellIdsRef = useRef<CellId[]>([]);

    // Initialize cell IDs with spatial coordinates if not already done
    if (cellIdsRef.current.length !== columns.length) {
        cellIdsRef.current = columns.map((_, colIndex) =>
            `${colIndex.toString().padStart(2, '0')}-${rowIndex.toString().padStart(2, '0')}-${uuidv4()}`
            // Example: "01-02-a1b2c3d4-e5f6-7890-abcd-ef1234567890" (col=1, row=2)
        );
    }

    // Row creates cell-specific registerCommands functions
    const createCellRegisterFunction = (cellId: string) => {
        return (handler: CellCommandHandeler) => {
            // Row uses TableRowAPI to register the cell with the table
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
