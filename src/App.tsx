import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { Rack } from './components/Rack';

export default function App() {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#0f0f0f' }}>
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Rack />
      </div>
    </div>
  );
}
