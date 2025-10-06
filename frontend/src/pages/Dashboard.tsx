import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { FileText, CheckSquare, BarChart3, Trash2, Clock, X, CheckCircle } from 'lucide-react'

interface Stats {
  documents: number
  checklists: number
  analyses: number
  recent_analyses: any[]
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [analysisToDelete, setAnalysisToDelete] = useState<any>(null)
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showDeleteModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showDeleteModal])

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }))
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [notification.show])
  
  const { data: stats, isLoading } = useQuery<Stats>('dashboard-stats', async () => {
    const [documentsRes, checklistsRes, analysesRes] = await Promise.all([
      api.get('/api/documents/'),
      api.get('/api/checklists/'),
      api.get('/api/analysis/')
    ])
    
    return {
      documents: documentsRes.data.length,
      checklists: checklistsRes.data.length,
      analyses: analysesRes.data.length,
      recent_analyses: analysesRes.data
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
    }
  })

  const deleteMutation = useMutation(
    async (id: number) => {
      await api.delete(`/api/analysis/${id}`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('dashboard-stats')
        setNotification({
          show: true,
          message: 'Analysis deleted successfully!',
          type: 'success'
        })
      },
      onError: (error: any) => {
        console.error('Delete error:', error)
        setNotification({
          show: true,
          message: `Failed to delete analysis: ${error.response?.data?.detail || error.message}`,
          type: 'error'
        })
      }
    }
  )

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  const handleDeleteAnalysis = (analysis: any) => {
    setAnalysisToDelete(analysis)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (analysisToDelete) {
      deleteMutation.mutate(analysisToDelete.id)
      setShowDeleteModal(false)
      setAnalysisToDelete(null)
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setAnalysisToDelete(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      name: 'Documents',
      value: stats?.documents || 0,
      icon: FileText,
      color: 'bg-blue-500',
      description: 'Uploaded PDF files',
      href: '/documents'
    },
    {
      name: 'Checklists',
      value: stats?.checklists || 0,
      icon: CheckSquare,
      color: 'bg-green-500',
      description: 'Created checklists',
      href: '/checklists'
    },
    {
      name: 'Analyses',
      value: stats?.analyses || 0,
      icon: BarChart3,
      color: 'bg-purple-500',
      description: 'Completed analyses',
      href: '/results'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome to your Tender Assistant dashboard
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <button
            key={stat.name}
            onClick={() => navigate(stat.href)}
            className="card hover:shadow-md transition-all duration-200 hover:scale-105 cursor-pointer text-left w-full"
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Recent Analyses */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Analyses</h2>
          <button 
            onClick={() => navigate('/results')}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            View all
          </button>
        </div>
        
        {stats?.recent_analyses && stats.recent_analyses.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_analyses.map((analysis: any) => (
              <div key={analysis.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group gap-3">
                <button
                  onClick={() => navigate(`/results?analysis=${analysis.id}`)}
                  className="flex items-start sm:items-center flex-1 text-left min-w-0"
                >
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700 truncate">{analysis.name}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mt-1">
                      <p className="text-xs text-gray-500 truncate">{analysis.ai_model}</p>
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{formatDateTime(analysis.created_at).date} at {formatDateTime(analysis.created_at).time}</span>
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-end sm:justify-start space-x-2 flex-shrink-0">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    analysis.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : analysis.status === 'processing'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {analysis.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAnalysis(analysis)
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    title="Delete analysis"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No analyses yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by uploading documents and creating your first analysis.
            </p>
            <div className="mt-6">
              <button 
                onClick={() => navigate('/documents')}
                className="btn-primary"
              >
                Upload Documents
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{ 
            zIndex: 9999,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            margin: 0,
            padding: 0
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Delete Analysis</h3>
              <button
                onClick={cancelDelete}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 mb-2">
                    Are you sure you want to delete this analysis?
                  </p>
                  {analysisToDelete && (
                    <div className="bg-gray-50 rounded-md p-3 mb-4">
                      <p className="text-sm font-medium text-gray-900">{analysisToDelete.name}</p>
                      <p className="text-xs text-gray-500">{analysisToDelete.ai_model}</p>
                      <p className="text-xs text-gray-500">
                        Created: {formatDateTime(analysisToDelete.created_at).date} at {formatDateTime(analysisToDelete.created_at).time}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-red-600 font-medium">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 transition-colors"
              >
                Delete Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className={`rounded-lg shadow-lg border-l-4 p-4 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-400' 
              : 'bg-red-50 border-red-400'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <X className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                  className={`inline-flex rounded-md p-1.5 ${
                    notification.type === 'success' 
                      ? 'text-green-500 hover:text-green-700 hover:bg-green-100' 
                      : 'text-red-500 hover:text-red-700 hover:bg-red-100'
                  } transition-colors`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard
