import { useEffect, useRef, useState } from 'react';
import type { RowId, SpaceId, TableConfig, RowProps, SpaceCommand, SpaceCommandHandler } from '../core/types';
import type { TableCore } from '../core/TableCore';
import { GridRow } from '../SuperGrid';
import { v4 as uuidv4 } from 'uuid';
import { StringPositionGenerator } from '../core/utils';

interface SpaceProps<TData> {
    spaceId: SpaceId;
    tableCore: TableCore;
    config: TableConfig<TData>;
    initialData?: TData[]; // Only for table space
}

// Get row string directly from row object
function getRowString(rowId: RowId, tableCore: TableCore): string {
    const row = tableCore.getRowRegistry().get(rowId);
    return row?.rowString || "20"; // Fallback
}

export function Space<TData>({ spaceId, tableCore, config, initialData }: SpaceProps<TData>) {
    const [rowIds, setRowIds] = useState<RowId[]>([]);
    const renderCountRef = useRef(0);
    const initializedRef = useRef(false);
    renderCountRef.current += 1;
    const previousRowRef = useRef<RowId | null>(null);

    // Register SpaceCommand handler
    useEffect(() => {
        const handleSpaceCommand: SpaceCommandHandler = (command: SpaceCommand) => {
            console.log(`Space ${spaceId}: Received SpaceCommand:`, command.name);

            switch (command.name) {
                case 'addRow':
                    handleAddRow(command.payload.rowData, command.payload.position || 'bottom');
                    break;
                default:
                    console.warn(`Space ${spaceId}: Unhandled SpaceCommand:`, command.name);
            }
        };

        // Register handler with SpaceCommandRegistry
        tableCore.getSpaceCommandRegistry().register(spaceId, handleSpaceCommand);

        return () => {
            // Unregister handler when component unmounts
            tableCore.getSpaceCommandRegistry().unregister(spaceId);
        };
    }, [spaceId, tableCore]);

    // Handle addRow command with cross-space linking
    const handleAddRow = (rowData: any, position: 'top' | 'bottom') => {
        console.log(`Space ${spaceId}: Adding row at ${position}`, rowData);

        const newRowId = uuidv4();
        const rowRegistry = tableCore.getRowRegistry();
        const spaceRegistry = tableCore.getSpaceRegistry();

        // Get current space
        const currentSpace = spaceRegistry.get(spaceId);
        if (!currentSpace) {
            console.error(`Space ${spaceId}: Space not found in registry`);
            return;
        }

        // Get existing row strings for position calculation
        const existingRowStrings = rowIds.map(rowId => getRowString(rowId, tableCore));

        // Generate new position string using utility
        const rowString = StringPositionGenerator.generatePositionString(existingRowStrings, position);
        console.log(`Space ${spaceId}: Generated position string: ${rowString} for ${position} insertion`);

        // Determine insert index based on position
        const insertIndex = position === 'top' ? 0 : rowIds.length;

        // Create new row object
        const newRow: import('../core/types').Row<TData> = {
            spaceId: spaceId,
            data: rowData,
            cells: [],
            top: null,
            bottom: null,
            rowString: rowString
        };

        // Register new row
        rowRegistry.register(newRowId, newRow);

        // Update rowIds state
        const newRowIds = [...rowIds];
        newRowIds.splice(insertIndex, 0, newRowId);
        setRowIds(newRowIds);

        // Update space.rowIds in registry
        currentSpace.rowIds = newRowIds;
        spaceRegistry.register(spaceId, currentSpace);

        // Handle cross-space linking after cells are created
        setTimeout(() => {
            handleCrossSpaceLinking(newRowId, position);
        }, 50);

        console.log(`Space ${spaceId}: Row ${newRowId} added at position ${position} with string ${rowString}`);
    };


    // Handle cross-space linking logic
    const handleCrossSpaceLinking = (newRowId: RowId, position: 'top' | 'bottom') => {
        const rowRegistry = tableCore.getRowRegistry();

        const newRow = rowRegistry.get(newRowId);
        if (!newRow || newRow.cells.length === 0) {
            console.log(`Space ${spaceId}: New row ${newRowId} not ready for linking yet`);
            return;
        }

        console.log(`Space ${spaceId}: Starting cross-space linking for row ${newRowId}`);

        // Find space above with rows
        const spaceAbove = findNearestSpaceWithRows('above');
        // Find space below with rows
        const spaceBelow = findNearestSpaceWithRows('below');

        console.log(`Space ${spaceId}: Found spaces - above: ${spaceAbove}, below: ${spaceBelow}`);

        // Link based on position and available spaces
        if (position === 'top' && rowIds.length === 1) {
            // First row in space - link to spaces above and below
            linkToSpaceAbove(newRowId, spaceAbove);
            linkToSpaceBelow(newRowId, spaceBelow);
        } else if (position === 'bottom' && rowIds.length === 1) {
            // First row in space - link to spaces above and below
            linkToSpaceAbove(newRowId, spaceAbove);
            linkToSpaceBelow(newRowId, spaceBelow);
        } else {
            // Multiple rows in space - link internally first, then handle cross-space
            linkInternallyAndCrossSpace(newRowId, position, spaceAbove, spaceBelow);
        }
    };

    // Find nearest space above or below that has rows
    const findNearestSpaceWithRows = (direction: 'above' | 'below'): SpaceId | null => {
        const spaceRegistry = tableCore.getSpaceRegistry();
        const currentSpace = spaceRegistry.get(spaceId);
        if (!currentSpace) return null;

        let searchSpaceId = direction === 'above' ? currentSpace.top : currentSpace.bottom;

        while (searchSpaceId) {
            const searchSpace = spaceRegistry.get(searchSpaceId);
            if (!searchSpace) break;

            if (searchSpace.rowIds.length > 0) {
                return searchSpaceId;
            }

            searchSpaceId = direction === 'above' ? searchSpace.top : searchSpace.bottom;
        }

        return null;
    };

    // Link new row to space above
    const linkToSpaceAbove = (newRowId: RowId, spaceAboveId: SpaceId | null) => {
        if (!spaceAboveId) return;

        const rowRegistry = tableCore.getRowRegistry();
        const spaceRegistry = tableCore.getSpaceRegistry();
        const coordinator = tableCore.getCellCoordinator();

        const spaceAbove = spaceRegistry.get(spaceAboveId);
        if (!spaceAbove || spaceAbove.rowIds.length === 0) return;

        // Get bottom row of space above
        const aboveBottomRowId = spaceAbove.rowIds[spaceAbove.rowIds.length - 1];
        const aboveBottomRow = rowRegistry.get(aboveBottomRowId);
        const newRow = rowRegistry.get(newRowId);

        if (aboveBottomRow && newRow &&
            aboveBottomRow.cells.length > 0 && newRow.cells.length > 0) {
            coordinator.linkRowsCells(aboveBottomRow.cells, newRow.cells);
            console.log(`Space ${spaceId}: Linked to space above ${spaceAboveId}`);
        }
    };

    // Link new row to space below
    const linkToSpaceBelow = (newRowId: RowId, spaceBelowId: SpaceId | null) => {
        if (!spaceBelowId) return;

        const rowRegistry = tableCore.getRowRegistry();
        const spaceRegistry = tableCore.getSpaceRegistry();
        const coordinator = tableCore.getCellCoordinator();

        const spaceBelow = spaceRegistry.get(spaceBelowId);
        if (!spaceBelow || spaceBelow.rowIds.length === 0) return;

        // Get top row of space below
        const belowTopRowId = spaceBelow.rowIds[0];
        const belowTopRow = rowRegistry.get(belowTopRowId);
        const newRow = rowRegistry.get(newRowId);

        if (newRow && belowTopRow &&
            newRow.cells.length > 0 && belowTopRow.cells.length > 0) {
            coordinator.linkRowsCells(newRow.cells, belowTopRow.cells);
            console.log(`Space ${spaceId}: Linked to space below ${spaceBelowId}`);
        }
    };

    // Handle internal linking + cross-space for multi-row spaces
    const linkInternallyAndCrossSpace = (newRowId: RowId, position: 'top' | 'bottom', spaceAbove: SpaceId | null, spaceBelow: SpaceId | null) => {
        const rowRegistry = tableCore.getRowRegistry();
        const coordinator = tableCore.getCellCoordinator();

        const newRowIndex = rowIds.indexOf(newRowId);

        if (position === 'top') {
            // Link new row to existing top row
            if (newRowIndex + 1 < rowIds.length) {
                const nextRowId = rowIds[newRowIndex + 1];
                const nextRow = rowRegistry.get(nextRowId);
                const newRow = rowRegistry.get(newRowId);

                if (newRow && nextRow && newRow.cells.length > 0 && nextRow.cells.length > 0) {
                    coordinator.linkRowsCells(newRow.cells, nextRow.cells);
                }
            }
            // Link to space above
            linkToSpaceAbove(newRowId, spaceAbove);
        } else {
            // Link existing bottom row to new row
            if (newRowIndex > 0) {
                const prevRowId = rowIds[newRowIndex - 1];
                const prevRow = rowRegistry.get(prevRowId);
                const newRow = rowRegistry.get(newRowId);

                if (prevRow && newRow && prevRow.cells.length > 0 && newRow.cells.length > 0) {
                    coordinator.linkRowsCells(prevRow.cells, newRow.cells);
                }
            }
            // Link to space below
            linkToSpaceBelow(newRowId, spaceBelow);
        }
    };

    // Initialize with table data if provided (only once)
    useEffect(() => {
        if (initialData && initialData.length > 0 && rowIds.length === 0 && !initializedRef.current) {
            initializedRef.current = true;

            previousRowRef.current = null;
            const newRowIds: RowId[] = [];

            // Create rows in visual order: top to bottom ("30", "20", "10")
            for (let i = initialData.length - 1; i >= 0; i--) {
                const rowId = uuidv4();

                // Generate Y position string - reverse order for descending positions
                const rowString = (30 - (i * 10)).toString();

                // Create Row object
                const rowObject: import('../core/types').Row<TData> = {
                    spaceId: spaceId,
                    data: initialData[i],
                    cells: [],
                    top: previousRowRef.current,
                    bottom: null,
                    rowString: rowString
                };

                // Link to previous row
                if (previousRowRef.current) {
                    const previousRow = tableCore.getRowRegistry().get(previousRowRef.current);
                    if (previousRow) {
                        previousRow.bottom = rowId;
                        tableCore.getRowRegistry().register(previousRowRef.current, previousRow);
                    }
                }

                tableCore.getRowRegistry().register(rowId, rowObject);
                newRowIds.push(rowId);
                previousRowRef.current = rowId;

            }

            setRowIds(newRowIds);
        }
    }, [spaceId, tableCore]);

    // Link cells when a new row gets its cells registered
    const linkRowCells = (currentRowId: RowId) => {
        const coordinator = tableCore.getCellCoordinator();
        const currentRow = tableCore.getRowRegistry().get(currentRowId);

        if (!currentRow || !currentRow.top) return;

        const topRow = tableCore.getRowRegistry().get(currentRow.top);
        if (!topRow) return;

        // Check if both rows have cells and same count
        if (topRow.cells.length > 0 && currentRow.cells.length > 0 &&
            topRow.cells.length === currentRow.cells.length) {

                coordinator.linkRowsCells(topRow.cells, currentRow.cells);
        }
    };

    // Always render space (even empty) for handler registration and zero UI footprint
    return (
        <>
            {rowIds.map((rowId, index) => {
                const row = tableCore.getRowRegistry().get(rowId);
                if (!row) return null;

                const tableApis = tableCore.createRowAPI(rowId);

                // Get string position from row object
                const stringPosition = getRowString(rowId, tableCore);

                const rowProps: RowProps<TData> = {
                    id: rowId,
                    data: row.data,
                    columns: config,
                    tableApis: tableApis,
                    rowIndex: index,
                    rowString: stringPosition,
                    isLastRow: index === rowIds.length - 1
                };

                return (
                    <GridRowWrapper
                        key={rowId}
                        rowProps={rowProps}
                        onCellsRegistered={() => linkRowCells(rowId)}
                    />
                );
            })}
        </>
    );
}

// Wrapper to detect when cells are registered
function GridRowWrapper<TData>({ rowProps, onCellsRegistered }: {
    rowProps: RowProps<TData>;
    onCellsRegistered: () => void;
}) {
    const cellsRegisteredRef = useRef(false);

    useEffect(() => {
        // Check if cells are registered after render
        const checkCells = () => {
            if (!cellsRegisteredRef.current) {
                // Simple way to detect cells are ready - we'll call the callback
                onCellsRegistered();
                cellsRegisteredRef.current = true;
            }
        };

        // Call immediately and also after a short delay
        checkCells();
        const timeout = setTimeout(checkCells, 10);
        return () => clearTimeout(timeout);
    });

    return <GridRow {...rowProps} />;
}
