import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  FileText, 
  CheckSquare, 
  BarChart3, 
  Home, 
  LogOut,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Checklists', href: '/checklists', icon: CheckSquare },
    { name: 'Analysis', href: '/analysis', icon: BarChart3 },
    { name: 'Results', href: '/results', icon: Settings },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md bg-white shadow-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>


      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transform transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0 w-56' : '-translate-x-full md:translate-x-0'
      } ${sidebarCollapsed && !sidebarOpen ? 'md:w-16 md:translate-x-0' : 'md:w-56'}`}>
        {/* Header - show logo and hide button when expanded, show button when collapsed */}
        <div className="flex h-16 items-center justify-between px-6 border-b">
          {!sidebarCollapsed || sidebarOpen ? (
            <>
              <a href="/" className="flex items-center">
                <svg 
                  className="h-6 w-auto"
                  viewBox="0 0 101.546 23.893" 
                  overflow="visible"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                >
                  <path 
                    d="M 8.547 8.666 C 9.413 8.666 10.214 8.201 10.647 7.446 L 14.921 0 C 16.088 0.678 17.255 1.355 18.422 2.033 L 14.148 9.48 C 13.715 10.235 13.715 11.163 14.148 11.919 L 18.422 19.365 L 16.673 20.38 L 14.922 21.397 L 10.647 13.951 C 10.216 13.197 9.415 12.732 8.547 12.731 L 0 12.731 L 0 8.666 L 8.548 8.666 Z M 33.52 7.325 L 36.736 7.325 L 36.736 9.457 L 33.52 9.457 L 33.52 18.82 L 30.962 18.82 L 30.962 9.457 L 28.745 9.457 L 28.745 7.325 L 30.962 7.325 L 30.962 6.222 C 30.962 3.453 32.618 1.981 34.836 1.981 C 35.275 1.981 35.762 2.031 36.274 2.153 L 36.274 4.261 C 35.933 4.211 35.737 4.211 35.567 4.211 C 34.227 4.211 33.52 4.824 33.52 6.197 Z M 42.797 19.065 C 39.361 19.065 36.827 16.466 36.827 13.085 C 36.827 9.703 39.361 7.079 42.797 7.079 C 46.257 7.079 48.791 9.703 48.791 13.085 C 48.791 16.466 46.257 19.065 42.797 19.065 Z M 42.797 16.761 C 44.77 16.761 46.233 15.217 46.233 13.085 C 46.233 10.928 44.77 9.384 42.797 9.384 C 40.823 9.384 39.385 10.927 39.385 13.085 C 39.385 15.217 40.823 16.761 42.797 16.761 Z M 52.735 18.82 L 50.176 18.82 L 50.176 11.761 C 50.176 8.918 51.881 7.079 54.635 7.079 C 55.147 7.079 55.561 7.153 55.999 7.252 L 55.999 9.604 C 55.561 9.554 55.292 9.58 55.123 9.58 C 53.612 9.58 52.734 10.266 52.734 12.203 L 52.734 18.82 Z M 65.97 9.114 L 66.19 7.325 L 68.432 7.325 L 68.432 18.232 C 68.432 22.3 65.532 23.893 62.779 23.893 C 59.562 23.893 57.443 22.324 57.004 19.604 L 59.611 19.604 C 59.952 20.854 61.097 21.614 62.779 21.614 C 64.411 21.614 65.898 20.634 65.898 18.232 L 65.898 17.08 C 65.069 18.304 63.656 18.991 62.072 18.991 C 59.294 18.991 56.662 16.884 56.662 13.036 C 56.662 9.188 59.294 7.079 62.072 7.079 C 63.705 7.079 65.166 7.79 65.97 9.114 Z M 62.608 16.688 C 64.289 16.688 65.947 15.363 65.947 13.036 C 65.947 10.707 64.289 9.384 62.608 9.384 C 60.781 9.384 59.197 10.756 59.197 13.036 C 59.197 15.316 60.78 16.688 62.608 16.688 Z M 81.136 13.085 C 81.136 13.453 81.136 13.648 81.111 14.015 L 72.34 14.015 C 72.681 15.781 73.923 16.81 75.581 16.81 C 76.969 16.81 77.846 16.32 78.333 15.364 L 80.843 15.364 C 80.136 17.692 78.042 19.065 75.604 19.065 C 72.193 19.065 69.78 16.614 69.78 13.085 C 69.78 9.58 72.169 7.079 75.581 7.079 C 78.699 7.079 81.136 9.653 81.136 13.085 Z M 75.581 9.334 C 73.898 9.334 72.681 10.414 72.339 12.055 L 78.601 12.055 C 78.442 10.507 77.137 9.331 75.581 9.334 Z M 85.093 18.82 L 82.535 18.82 L 82.535 12.129 C 82.535 9.188 84.436 7.079 87.628 7.079 C 90.82 7.079 92.72 9.188 92.72 12.129 L 92.72 18.819 L 90.162 18.819 L 90.162 12.325 C 90.162 10.511 89.309 9.408 87.628 9.408 C 85.945 9.408 85.093 10.511 85.093 12.325 Z M 101.546 7.325 L 101.546 9.457 L 98.208 9.457 L 98.208 14.555 C 98.208 16.124 98.89 16.663 100.425 16.663 C 100.571 16.663 100.839 16.663 101.327 16.639 L 101.327 18.771 C 100.802 18.915 100.261 18.989 99.718 18.991 C 97.378 18.991 95.649 17.521 95.649 14.874 L 95.649 9.458 L 93.578 9.458 L 93.578 7.324 L 95.624 7.324 L 95.624 3.476 L 98.208 3.476 L 98.208 7.325 Z" 
                    fill="rgb(0,0,0)"
                  />
                </svg>
              </a>
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  setSidebarCollapsed(true)
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Hide sidebar"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </>
          ) : (
            <div className="flex justify-center w-full">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Show sidebar"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    // Navigate using React Router
                    navigate(item.href)
                    // Only close mobile sidebar, keep desktop sidebar state unchanged
                    setSidebarOpen(false)
                    // sidebarCollapsed state remains unchanged for desktop
                  }}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors w-full text-left ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={sidebarCollapsed && !sidebarOpen ? item.name : undefined}
                >
                  <item.icon className={`h-5 w-5 ${sidebarCollapsed && !sidebarOpen ? 'mx-auto' : 'mr-3'}`} />
                  {(!sidebarCollapsed || sidebarOpen) && item.name}
                </button>
              )
            })}
          </div>
        </nav>

        {/* User section - different layout for expanded vs collapsed */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t">
          {!sidebarCollapsed || sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className={`${sidebarCollapsed ? 'md:pl-16' : 'md:pl-56'}`}>
        <main className="py-6 pt-16 md:pt-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
