import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { Play, FileText, BarChart3, Clock } from 'lucide-react'

interface Document {
  id: number
  original_filename: string
  language: string
  status: string
}

interface Checklist {
  id: number
  name: string
  description: string
  language: string
  items: any[]
}

interface Analysis {
  id: number
  name: string
  status: string
  ai_model: string
  processing_time: number
  created_at: string
  completed_at: string
}

const Analysis: React.FC = () => {
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([])
  const [selectedChecklist, setSelectedChecklist] = useState<number | null>(null)
  const [analysisName, setAnalysisName] = useState('')
  const [aiModel, setAiModel] = useState('claude-3-haiku')
  const [previousAnalyses, setPreviousAnalyses] = useState<Analysis[]>([])
  
  const queryClient = useQueryClient()
  
  // WebSocket connection for real-time updates
  const { isConnected, lastMessage } = useWebSocket(1) // Using user ID 1 for bypass auth
  
  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'analysis_update') {
        // Refresh analyses when status updates
        queryClient.invalidateQueries('analyses')
        
        // Show notification for completed analyses
        if (lastMessage.status === 'completed' && Notification.permission === 'granted') {
          new Notification('Analysis Completed', {
            body: `Analysis ${lastMessage.analysis_id} has been completed!`,
            icon: '/favicon.ico'
          })
        }
      } else if (lastMessage.type === 'queue_update') {
        // Handle queue position updates
        console.log(`Queue position: ${lastMessage.queue_position}/${lastMessage.total_in_queue}`)
      }
    }
  }, [lastMessage, queryClient])

  const { data: documents } = useQuery<Document[]>('documents', async () => {
    const response = await api.get('/api/documents/')
    return response.data
  })

  const { data: checklists } = useQuery<Checklist[]>('checklists', async () => {
    const response = await api.get('/api/checklists/')
    return response.data
  })

  const { data: analyses, isLoading } = useQuery<Analysis[]>('analyses', async () => {
    const response = await api.get('/api/analysis/')
    // Sort analyses by creation time (newest first)
    return response.data.sort((a: Analysis, b: Analysis) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, {
    refetchInterval: 5000, // Poll every 5 seconds to check for status updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
    onSuccess: (data) => {
      // Check for newly completed analyses
      if (previousAnalyses.length > 0 && data) {
        data.forEach(currentAnalysis => {
          const previousAnalysis = previousAnalyses.find(prev => prev.id === currentAnalysis.id)
          if (previousAnalysis && 
              previousAnalysis.status === 'processing' && 
              currentAnalysis.status === 'completed') {
            // Show notification for completed analysis
            if (Notification.permission === 'granted') {
              new Notification('Analysis Completed!', {
                body: `Your analysis "${currentAnalysis.name}" has finished processing.`,
                icon: '/favicon.ico'
              })
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  new Notification('Analysis Completed!', {
                    body: `Your analysis "${currentAnalysis.name}" has finished processing.`,
                    icon: '/favicon.ico'
                  })
                }
              })
            }
          }
        })
      }
      setPreviousAnalyses(data || [])
    }
  })

  const createAnalysisMutation = useMutation(
    async (analysisData: any) => {
      const response = await api.post('/api/analysis/', analysisData)
      return response.data
    },
    {
      onSuccess: (data) => {
        // Refresh the analyses list to show the new analysis immediately
        queryClient.invalidateQueries('analyses')
        
        // Clear form immediately
        setSelectedDocuments([])
        setSelectedChecklist(null)
        setAnalysisName('')
        createAnalysisMutation.reset()
      },
      onError: (error) => {
        console.error('Analysis creation error:', error)
        // Reset mutation state on error
        createAnalysisMutation.reset()
      }
    }
  )

  const handleStartAnalysis = () => {
    if (selectedDocuments.length === 0 || !selectedChecklist || !analysisName.trim()) {
      return
    }

    createAnalysisMutation.mutate({
      name: analysisName,
      checklist_id: selectedChecklist,
      document_ids: selectedDocuments,
      ai_model: aiModel
    })
  }

  const toggleDocument = (docId: number) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800 animate-pulse'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'completed'
      case 'processing':
        return 'processing...'
      case 'pending':
        return 'queued'
      case 'failed':
        return 'failed'
      default:
        return 'pending'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅'
      case 'processing':
        return '🔄'
      case 'pending':
        return '⏳'
      case 'failed':
        return '❌'
      default:
        return '⏳'
    }
  }

  // Calculate queue status
  const pendingAnalyses = analyses?.filter(a => a.status === 'pending') || []
  const processingAnalyses = analyses?.filter(a => a.status === 'processing') || []
  const totalInQueue = pendingAnalyses.length + processingAnalyses.length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analysis</h1>
            <p className="mt-1 text-sm text-gray-600">
              Run AI-powered analysis on your documents
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Queue Status Banner */}
      {totalInQueue > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Analysis Queue Active
              </h3>
              <div className="mt-1 text-sm text-blue-700">
                {processingAnalyses.length > 0 && (
                  <span>{processingAnalyses.length} analysis{processingAnalyses.length > 1 ? 'es' : ''} currently processing</span>
                )}
                {pendingAnalyses.length > 0 && (
                  <span className={processingAnalyses.length > 0 ? 'ml-2' : ''}>
                    {pendingAnalyses.length} in queue
                  </span>
                )}
                <span className="ml-2 text-blue-600">
                  • You can start new analyses while others are running
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Analysis Form */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Start New Analysis</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Analysis Name
              </label>
              <input
                type="text"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                className="input"
                placeholder="Enter analysis name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Model
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="input w-full"
              >
                <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Documents ({selectedDocuments.length} selected)
            </label>
            {documents && documents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {documents.map((doc) => (
                  <label key={doc.id} className="flex items-center p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={() => toggleDocument(doc.id)}
                      className="mr-3"
                    />
                    <FileText className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-sm">{doc.original_filename}</span>
                    <span className="text-xs text-gray-500 ml-auto">{doc.language.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No documents available. Upload documents first.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Checklist
            </label>
            {checklists && checklists.length > 0 ? (
              <select
                value={selectedChecklist || ''}
                onChange={(e) => setSelectedChecklist(Number(e.target.value))}
                className="input"
              >
                <option value="">Choose a checklist</option>
                {checklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.name} ({checklist.items?.length || 0} items)
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500">No checklists available. Create a checklist first.</p>
            )}
          </div>

          <button
            onClick={handleStartAnalysis}
            disabled={selectedDocuments.length === 0 || !selectedChecklist || !analysisName.trim() || createAnalysisMutation.isLoading}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-white font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-105 disabled:transform-none"
          >
            {createAnalysisMutation.isLoading ? (
              <>
                <Clock className="h-5 w-5 mr-3 animate-spin flex-shrink-0" />
                <span className="whitespace-nowrap">Starting Analysis...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-3 flex-shrink-0" />
                <span className="whitespace-nowrap">Start Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Analysis History</h2>
          <span className="text-sm text-gray-500">{analyses?.length || 0} analyses</span>
        </div>

        {analyses && analyses.length > 0 ? (
          <div className="space-y-3">
            {analyses.map((analysis, index) => {
              // Calculate queue position for pending/processing analyses
              const queuePosition = analysis.status === 'pending' || analysis.status === 'processing' 
                ? analyses.filter(a => a.status === 'pending' || a.status === 'processing').indexOf(analysis) + 1
                : null
              
              // Check if this is a newly created analysis (within last 30 seconds)
              const isNew = new Date().getTime() - new Date(analysis.created_at).getTime() < 30000
              
              return (
              <div key={analysis.id} className={`flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group ${
                isNew ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
              }`}>
                {analysis.status === 'completed' ? (
                  <a
                    href={`/results?analysis=${analysis.id}`}
                    className="flex items-center flex-1 text-left"
                  >
                    <div className="flex-shrink-0">
                      <BarChart3 className="h-8 w-8 text-purple-500 group-hover:text-purple-600" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700">{analysis.name}</p>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        <span>{analysis.ai_model}</span>
                        <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                        {analysis.processing_time && (
                          <span>{analysis.processing_time.toFixed(1)}s</span>
                        )}
                        {queuePosition && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            #{queuePosition} in queue
                          </span>
                        )}
                        {isNew && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center flex-1">
                    <div className="flex-shrink-0">
                      <BarChart3 className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-900">{analysis.name}</p>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        <span>{analysis.ai_model}</span>
                        <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                        {analysis.processing_time && (
                          <span>{analysis.processing_time.toFixed(1)}s</span>
                        )}
                        {queuePosition && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            #{queuePosition} in queue
                          </span>
                        )}
                        {isNew && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                    {getStatusText(analysis.status)}
                  </span>
                  {analysis.status === 'completed' && (
                    <span className="text-primary-600 group-hover:text-primary-700 text-sm font-medium">
                      View Results →
                    </span>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No analyses yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start your first analysis to see results here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Analysis
