import { useRef } from 'react'
import { SuperGrid } from './SupperGrid/SuperGrid'
import type { SuperGridRef } from './SupperGrid/SuperGrid'
import { TextCell } from './SupperGrid/cells/TextCell'
import { FocusPlugin } from './SupperGrid/plugins/FocusPlugin'
import './App.css'
import { SelectPlugin } from './SupperGrid/plugins/SelectionPlugin';
import { CreateRowTesterFirst } from './SupperGrid/plugins/CreateRowTesterFirst';
import { CreateRowTesterLast } from './SupperGrid/plugins/CreateRowTesterLast';

function App() {
  const gridRef = useRef<SuperGridRef>(null);
  
  // Create plugin instances
  const focusPlugin = new FocusPlugin();
  const selectPlugin = new SelectPlugin();
  const rowTesterFirst = new CreateRowTesterFirst();
  const rowTesterLast = new CreateRowTesterLast();

  // Sample data
  const data = [
    { name: 'John', age: 30, email: 'john@example.com' },
    { name: 'Jane', age: 25, email: 'jane@example.com' },
    { name: 'Bob', age: 35, email: 'bob@example.com' }
  ];

  // Table configuration
  const config = [
    {
      key: 'name' as keyof typeof data[0],
      cell: TextCell,
      header: 'Name',
      placeholder: 'Enter name',
      width: '200px'
    },
    {
      key: 'age' as keyof typeof data[0],
      cell: TextCell,
      header: 'Age',
      placeholder: 'Enter age',
      width: '100px'
    },
    {
      key: 'email' as keyof typeof data[0],
      cell: TextCell,
      header: 'Email',
      placeholder: 'Enter email',
      width: '250px'
    }
  ];

  const deleteFirstRow = () => {
    const tableCore = gridRef.current?.getTableCore();
    if (tableCore) {
      const rowIds = tableCore.getRowRegistry().list();
      if (rowIds.length > 0) {
        console.log('App: Deleting first row:', rowIds[0]);
        gridRef.current?.destroyRow(rowIds[0]);
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">SuperGrid Test</h1>
      
      <div className="mb-4">
        <button 
          onClick={deleteFirstRow}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Delete First Row
        </button>
      </div>

      <SuperGrid
        ref={gridRef}
        data={data}
        config={config}
        plugins={[focusPlugin, selectPlugin, rowTesterFirst, rowTesterLast]}
      />
    </div>
  )
}

export default App
