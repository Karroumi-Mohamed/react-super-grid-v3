import { useEffect, useRef, useState } from 'react';
import type { RowId, TableConfig, SpaceId, SpaceCommand } from '../core/types';
import type { TableCore } from '../core/TableCore';
import { useTableContext } from '../core/TableContext';
import { v4 as uuidv4 } from 'uuid';

interface SpaceProps<TData> {
    id: SpaceId;
    data?: TData[];
    tableCore: TableCore;
    config: TableConfig<TData>;
    GridRow: React.ComponentType<any>; // Reference to the existing GridRow component
}

export function Space<TData>({ id, data = [], tableCore, config, GridRow }: SpaceProps<TData>) {
    const tableContext = useTableContext();
    const [spaceRows, setSpaceRows] = useState<{ rowId: RowId; data: TData; fractionalIndex: string }[]>([]);
    const [registryVersion, setRegistryVersion] = useState(0); // Force re-render when registry changes

    console.log(`Space ${id}: Rendering with ${spaceRows.length} rows`);

    // Initialize space with initial data (for table space)
    useEffect(() => {
        // Check if this space already has rows in TableCore registry
        const existingRowsInSpace = tableCore.getRowRegistry()
            .list()
            .map(rowId => tableCore.getRowRegistry().get(rowId)!)
            .filter(row => row && row.spaceId === id);

        if (data.length > 0 && existingRowsInSpace.length === 0) {
            console.log(`Space ${id}: Initializing with ${data.length} initial rows (no existing rows found)`);

            // Generate fractional indices for initial data
            const fractionalIndices = tableCore.generateInitialFractionalIndices(data.length);

            // Create and register rows for initial data
            data.forEach((rowData, index) => {
                // Check if a row with this exact data already exists in this space
                const duplicateRow = existingRowsInSpace.find(row =>
                    JSON.stringify(row.data) === JSON.stringify(rowData)
                );

                if (duplicateRow) {
                    console.warn(`Space ${id}: Skipping duplicate row data at index ${index}`);
                    return;
                }

                const rowId = uuidv4();
                const fractionalIndex = fractionalIndices[index];

                // Create and register the Row object in the row registry
                const rowObject: import('../core/types').Row<TData> = {
                    spaceId: id,
                    data: rowData,
                    cells: [], // Will be populated by the GridRow component
                    top: null, // Will be set after all rows are created
                    bottom: null, // Will be set after all rows are created
                    fractionalIndex: fractionalIndex
                };

                // Register the row object
                tableCore.getRowRegistry().register(rowId, rowObject);
                console.log(`Space ${id}: Registered initial row ${rowId} with fractional index ${fractionalIndex}`);
            });

            // Force re-query after registration
            setRegistryVersion(v => v + 1);
        } else if (existingRowsInSpace.length > 0) {
            console.log(`Space ${id}: Found ${existingRowsInSpace.length} existing rows, skipping initialization`);

            // If we have data but also existing rows, check for mismatches
            if (data.length !== existingRowsInSpace.length) {
                console.warn(`Space ${id}: Data length (${data.length}) doesn't match existing rows (${existingRowsInSpace.length})`);
            }
        }
    }, [id, data, tableCore]);

    // Query TableCore for rows in this space
    useEffect(() => {
        console.log(`Space ${id}: Querying TableCore for rows (registryVersion: ${registryVersion})`);

        const rowsInSpace = tableCore.getRowRegistry()
            .list()
            .map(rowId => ({
                rowId,
                row: tableCore.getRowRegistry().get(rowId)!
            }))
            .filter(({ row }) => row && row.spaceId === id)
            .sort((a, b) => b.row.fractionalIndex.localeCompare(a.row.fractionalIndex)) // Top to bottom
            .map(({ rowId, row }) => ({
                rowId,
                data: row.data,
                fractionalIndex: row.fractionalIndex
            }));

        console.log(`Space ${id}: Found ${rowsInSpace.length} rows in registry`);
        setSpaceRows(rowsInSpace);
    }, [id, tableCore, registryVersion, data]);

    // Link cells vertically after all cells are created (delayed execution)
    useEffect(() => {
        if (spaceRows.length > 1) {
            // Delay cell linking to ensure all GridRow components have registered their cells
            const timer = setTimeout(() => {
                console.log(`Space ${id}: Attempting to link cells vertically across ${spaceRows.length} rows`);

                const rowRegistry = tableCore.getRowRegistry();
                const coordinator = tableCore.getCellCoordinator();

                // Use visual order from spaceRows (already sorted top to bottom)
                for (let i = 0; i < spaceRows.length - 1; i++) {
                    const currentRowId = spaceRows[i].rowId;
                    const nextRowId = spaceRows[i + 1].rowId;

                    const currentRow = rowRegistry.get(currentRowId);
                    const nextRow = rowRegistry.get(nextRowId);

                    console.log(`Space ${id}: Linking row ${i} (${currentRowId.slice(0, 8)}...) to row ${i + 1} (${nextRowId.slice(0, 8)}...)`);

                    if (currentRow && nextRow) {
                        console.log(`Space ${id}: Current row has ${currentRow.cells.length} cells, next row has ${nextRow.cells.length} cells`);

                        if (currentRow.cells.length === nextRow.cells.length && currentRow.cells.length > 0) {
                            // Link corresponding cells between visually adjacent rows
                            coordinator.linkRowsCells(currentRow.cells, nextRow.cells);
                            console.log(`Space ${id}: Linked ${currentRow.cells.length} cells between rows`);
                        } else {
                            console.warn(`Space ${id}: Cannot link rows ${i} and ${i + 1} - cell count mismatch or empty (${currentRow.cells.length} vs ${nextRow.cells.length})`);
                        }
                    }
                }
                console.log(`Space ${id}: Vertical cell linking completed`);
            }, 100); // Small delay to allow GridRow components to register cells

            return () => clearTimeout(timer);
        }
    }, [id, spaceRows, tableCore]); // Re-run when spaceRows change

    // Register space command handler
    useEffect(() => {
        const handleSpaceCommand = (command: SpaceCommand) => {
            console.log(`Space ${id}: Received space command:`, command.name);
            switch (command.name) {
                case 'createRow':
                    handleCreateRow(command.payload);
                    break;
                default:
                    console.log(`Space ${id}: Unhandled space command:`, command.name);
                    break;
            }
        };

        tableContext.registerSpaceHandler(id, handleSpaceCommand);

        return () => {
            tableContext.unregisterSpaceHandler(id);
        };
    }, [id, tableContext]);

    // Handle createRow command - now delegates to TableCore
    const handleCreateRow = (payload: { data: any; position?: 'top' | 'bottom' | { after: RowId } }) => {
        console.log(`Space ${id}: Creating new row with payload:`, payload);

        // Delegate to TableCore - it handles all the spatial logic
        const newRowId = tableCore.createRowInSpace(id, payload.data, payload.position);

        // Force re-query to pick up the new row
        setRegistryVersion(v => v + 1);

        console.log(`Space ${id}: Successfully created row ${newRowId} via TableCore`);
    };

    // Render rows using the existing GridRow component
    const renderRows = () => {
        console.log(`Space ${id}: renderRows called, spaceRows.length=${spaceRows.length}`);

        return spaceRows.map((spaceRow, index) => {
            console.log(`Space ${id}: Processing row ${index}, rowId=${spaceRow.rowId.slice(0, 8)}..., rowData:`, spaceRow.data);

            const isLastRow = index === spaceRows.length - 1;

            // Create row props for GridRow component
            const rowProps = {
                id: spaceRow.rowId,
                data: spaceRow.data,
                columns: config,
                rowIndex: spaceRow.fractionalIndex, // Fractional index for spatial coordinates
                isLastRow // Pass whether this is the last row
            };

            console.log(`Space ${id}: Rendering GridRow for row ${index}, props:`, rowProps);

            return <GridRow key={spaceRow.rowId} {...rowProps} />;
        });
    };

    // Space component is invisible - no UI wrapper, just renders its rows
    return <>{renderRows()}</>;
}