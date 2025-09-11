import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { TableProps, RowProps, RowId, CellId, CellCommand } from './core/types';
import { TableCore } from './core/TableCore';
import type { BasePlugin } from './core/BasePlugin';

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

  // Initialize TableCore and plugins once
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

    return () => {
      // Cleanup on unmount
      tableCoreRef.current?.destroy();
    };
  }, [plugins]);

  // Create row components with context-aware APIs
  const renderRows = () => {
    if (!tableCoreRef.current) {
      return null; // Don't render rows until TableCore is initialized
    }

    return data.map((rowData, index) => {
      const rowId: RowId = `row-${index}`; // Generate row ID

      // Create context-aware API for this specific row
      const tableApis = tableCoreRef.current!.createRowAPI(rowId);

      // Create row props with the bound API
      const rowProps: RowProps<TData> = {
        id: rowId,
        data: rowData,
        columns: config,
        tableApis // This is the context-aware API bound to this row's ID
      };

      return <GridRow key={rowId} {...rowProps} />;
    });
  };

  return (
    <div className="w-fit">
      <div className="w-full flex ">
        {/* Header rendering logic */}
        {config.map((col, index) => (
          <div
            key={index}
            className="header-cell p-2 font-semibold bg-gray-100 ring"
            style={{ width: col.width }}
          >
            {col.header}
          </div>
        ))}
      </div>
      <div className="w-full">
        {renderRows()}
      </div>
    </div>
  );
});

// Row component that uses the context-aware TableRowAPI
function GridRow<TData>({ id, data, columns, tableApis }: RowProps<TData>) {

  // Row creates cell-specific registerCommands functions
  const createCellRegisterFunction = (cellId: string) => {
    return (handler: import('./core/types').CellCommandHandeler) => {
      // Row uses TableRowAPI to register the cell with the table
      tableApis.registerCellCommands(cellId, handler);
    };
  };

  return (
    <div className="w-full flex" data-row-id={id}>
      {columns.map((column, index) => {
        const cellId = `${id}-cell-${index}`;
        const cellValue = data[column.key];

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
            className="ring"
            data-cell-id={cellId}
            style={{ width: column.width }}
            onClick={(e) => tableApis.sendMouseEvent(cellId, 'click', e.nativeEvent)}
            onDoubleClick={(e) => tableApis.sendMouseEvent(cellId, 'dblclick', e.nativeEvent)}
            onContextMenu={(e) => tableApis.sendMouseEvent(cellId, 'contextmenu', e.nativeEvent)}
            onMouseDown={(e) => tableApis.sendMouseEvent(cellId, 'mousedown', e.nativeEvent)}
            onMouseUp={(e) => tableApis.sendMouseEvent(cellId, 'mouseup', e.nativeEvent)}
            onMouseEnter={(e) => tableApis.sendMouseEvent(cellId, 'mouseenter', e.nativeEvent)}
            onMouseLeave={(e) => tableApis.sendMouseEvent(cellId, 'mouseleave', e.nativeEvent)}
          >
            <CellComponent {...cellProps} />
          </div>
        );
      })}
    </div>
  );
}
