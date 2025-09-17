import { useEffect, useRef, useState } from 'react';
import type { RowId, SpaceId, TableConfig, RowProps } from '../core/types';
import type { TableCore } from '../core/TableCore';
import { GridRow } from '../SuperGrid';
import { v4 as uuidv4 } from 'uuid';

interface SpaceProps<TData> {
    spaceId: SpaceId;
    tableCore: TableCore;
    config: TableConfig<TData>;
    initialData?: TData[]; // Only for table space
}

export function Space<TData>({ spaceId, tableCore, config, initialData }: SpaceProps<TData>) {
    const [rowIds, setRowIds] = useState<RowId[]>([]);
    const previousRowRef = useRef<RowId | null>(null);

    // Initialize with table data if provided
    useEffect(() => {
        if (initialData && initialData.length > 0) {

            previousRowRef.current = null;
            const newRowIds: RowId[] = [];

            // Create rows in visual order: top to bottom ("30", "20", "10")
            for (let i = initialData.length - 1; i >= 0; i--) {
                const rowId = uuidv4();
                const stringPosition = ((i + 1) * 10).toString();

                // Create Row object
                const rowObject: import('../core/types').Row<TData> = {
                    spaceId: spaceId,
                    data: initialData[i],
                    cells: [],
                    top: previousRowRef.current,
                    bottom: null
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
    }, [spaceId, tableCore, initialData]);

    // Link cells when a new row gets its cells registered
    const linkRowCells = (currentRowId: RowId) => {
        const currentRow = tableCore.getRowRegistry().get(currentRowId);

        if (!currentRow || !currentRow.top) return;

        const topRow = tableCore.getRowRegistry().get(currentRow.top);
        if (!topRow) return;

        // Check if both rows have cells and same count
        if (topRow.cells.length > 0 && currentRow.cells.length > 0 &&
            topRow.cells.length === currentRow.cells.length) {

            const coordinator = tableCore.getCellCoordinator();
            coordinator.linkRowsCells(topRow.cells, currentRow.cells);
        }
    };

    // Render rows
    if (rowIds.length === 0) {
        return null;
    }

    return (
        <div className="space-container" data-space-id={spaceId}>
            {rowIds.map((rowId, index) => {
                const row = tableCore.getRowRegistry().get(rowId);
                if (!row) return null;

                const tableApis = tableCore.createRowAPI(rowId);

                // Calculate string position for cell IDs
                const stringPosition = ((rowIds.length - index) * 10).toString();

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
        </div>
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
