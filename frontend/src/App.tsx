import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard   from './pages/Dashboard';
import ReportPage  from './pages/ReportPage';
import MembersPage from './pages/MembersPage';
import ImportPage  from './pages/ImportPage';
import ConfigPage  from './pages/ConfigPage';

const navItems = [
  { to: '/',        end: true,  label: 'ダッシュボード' },
  { to: '/report',  end: false, label: '工数レポート' },
  { to: '/members', end: false, label: 'メンバー管理' },
  { to: '/import',  end: false, label: 'CSV取込' },
  { to: '/config',  end: false, label: 'システム設定' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-r border-gray-200 flex flex-col shadow-sm shrink-0">
          <div className="px-4 py-5 border-b border-gray-200">
            <h1 className="text-base font-bold text-blue-700 leading-tight">工数管理<br />システム</h1>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-200 text-xs text-gray-400">ver 1.0.0</div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/report"  element={<ReportPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/import"  element={<ImportPage />} />
            <Route path="/config"  element={<ConfigPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
