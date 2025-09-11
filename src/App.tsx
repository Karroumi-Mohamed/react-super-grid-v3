import { SuperGrid } from './SupperGrid/SuperGrid'
import { TextCell } from './SupperGrid/cells/TextCell'
import { FocusPlugin } from './SupperGrid/plugins/FocusPlugin'
import './App.css'

function App() {
  // Create plugin instances
  const focusPlugin = new FocusPlugin();

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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">SuperGrid Test</h1>

      <SuperGrid
        data={data}
        config={config}
        plugins={[focusPlugin]}
      />
    </div>
  )
}

export default App
