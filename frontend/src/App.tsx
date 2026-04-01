import { useState } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed md:static inset-y-0 left-0 w-52 bg-white border-r border-gray-200
          flex flex-col shadow-sm shrink-0 z-30
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
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
                onClick={() => setSidebarOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-200 text-xs text-gray-400">ver 1.0.0</div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-gray-50 flex flex-col">
          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10 shrink-0">
            <button
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="メニューを開く"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-blue-700">工数管理システム</h1>
          </div>

          <div className="flex-1 p-6">
            <Routes>
              <Route path="/"        element={<Dashboard />} />
              <Route path="/report"  element={<ReportPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/import"  element={<ImportPage />} />
              <Route path="/config"  element={<ConfigPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
