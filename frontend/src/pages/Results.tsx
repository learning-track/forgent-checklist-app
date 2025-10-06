import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import { CheckCircle, XCircle, Download, FileText, Trash2, Eye, BookOpen, Clock, ArrowLeft, ExternalLink, ChevronDown, ChevronRight, Search, Filter } from 'lucide-react'

interface AnalysisResult {
  id: number
  checklist_item_id: number
  document_id: number | null // Which document this result came from
  document_name: string | null // Document filename
  document_url: string | null // Document URL for viewing
  question_text: string | null // The original checklist question
  answer: string
  condition_result: boolean | null // Changed to allow null for pending
  confidence_score: number | null // Changed to allow null
  evidence: string | null // Changed to allow null
  page_references: number[]
}

interface AnalysisDetail {
  id: number
  name: string
  status: string
  ai_model: string
  processing_time: number
  created_at: string
  completed_at: string
  results: AnalysisResult[]
}

// Custom PDF Viewer Component with highlighting capability
const PDFViewer: React.FC<{ 
  src: string; 
  highlightText?: string; 
  onTextFound?: (found: boolean) => void;
}> = ({ src, highlightText, onTextFound }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (isLoaded && highlightText && iframeRef.current) {
      try {
        const iframe = iframeRef.current
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        
        if (iframeDoc) {
          // Remove previous highlights
          const existingHighlights = iframeDoc.querySelectorAll('.pdf-highlight')
          existingHighlights.forEach(el => {
            const parent = el.parentNode
            if (parent) {
              parent.replaceChild(document.createTextNode(el.textContent || ''), el)
              parent.normalize()
            }
          })

          // Add new highlights
          if (highlightText.trim()) {
            const walker = iframeDoc.createTreeWalker(
              iframeDoc.body,
              NodeFilter.SHOW_TEXT,
              null
            )

            let node
            let found = false
            while (node = walker.nextNode()) {
              const text = node.textContent || ''
              if (text.toLowerCase().includes(highlightText.toLowerCase())) {
                found = true
                const regex = new RegExp(`(${highlightText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
                const highlightedHTML = text.replace(regex, '<span class="pdf-highlight" style="background-color: yellow; padding: 2px 4px; border-radius: 3px;">$1</span>')
                
                if (highlightedHTML !== text) {
                  const wrapper = iframeDoc.createElement('div')
                  wrapper.innerHTML = highlightedHTML
                  const parent = node.parentNode
                  if (parent) {
                    parent.replaceChild(wrapper, node)
                  }
                }
              }
            }
            
            onTextFound?.(found)
          }
        }
      } catch (error) {
        console.warn('Could not highlight text in PDF:', error)
        onTextFound?.(false)
      }
    }
  }, [isLoaded, highlightText, onTextFound])

  return (
    <iframe
      ref={iframeRef}
      src={src}
      className="w-full h-full border-0"
      title="Document Viewer"
      onLoad={() => setIsLoaded(true)}
      style={{ minHeight: '500px' }}
    />
  )
}

const Results: React.FC = () => {
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null)
  const [highlightedText, setHighlightedText] = useState<string>('')
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<number>>(new Set()) // Track which analyses are expanded
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set()) // Track which documents are expanded (format: "analysisId-documentId")
  const [searchParams] = useSearchParams()
  const specificAnalysisId = searchParams.get('analysis')
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterType, setFilterType] = useState<'all' | 'questions' | 'conditions'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'true' | 'false'>('all')
  
  const queryClient = useQueryClient()

  // Auto-expand the specific analysis when accessed via URL parameter
  useEffect(() => {
    if (specificAnalysisId) {
      const analysisId = parseInt(specificAnalysisId)
      if (analysisId && !expandedAnalyses.has(analysisId)) {
        setExpandedAnalyses(prev => new Set([...prev, analysisId]))
      }
    }
  }, [specificAnalysisId, expandedAnalyses])

  const { data: analyses, isLoading } = useQuery<AnalysisDetail[]>('analyses', async () => {
    const response = await api.get('/api/analysis/')
    return response.data
  })

  const deleteMutation = useMutation(
    async (id: number) => {
      await api.delete(`/api/analysis/${id}`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('analyses')
        alert('Analysis deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete error:', error)
        alert(`Failed to delete analysis: ${error.response?.data?.detail || error.message}`)
      }
    }
  )

  const getStatusColor = (result: AnalysisResult) => {
    if (result.condition_result === true) return 'bg-green-100 text-green-800'
    if (result.condition_result === false) return 'bg-red-100 text-red-800'
    return 'bg-yellow-100 text-yellow-800'
  }

  const getStatusText = (result: AnalysisResult) => {
    if (result.condition_result === true) return 'True'
    if (result.condition_result === false) return 'False'
    return 'Under Review'
  }

  const getItemTypeColor = (result: AnalysisResult) => {
    if (result.condition_result === null || result.condition_result === undefined) {
      return 'bg-blue-100 text-blue-800'
    }
    return 'bg-purple-100 text-purple-800'
  }

  const getItemTypeText = (result: AnalysisResult) => {
    if (result.condition_result === null || result.condition_result === undefined) {
      return 'Question'
    }
    return 'Condition'
  }

  // Filter and sort results
  const filterAndSortResults = (results: AnalysisResult[]) => {
    let filtered = results

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(result => 
        (result.question_text || '').toLowerCase().includes(searchLower) ||
        (result.answer || '').toLowerCase().includes(searchLower) ||
        (result.evidence || '').toLowerCase().includes(searchLower)
      )
    }

    // Apply type filter
    if (filterType === 'questions') {
      filtered = filtered.filter(result => 
        result.condition_result === null || result.condition_result === undefined
      )
    } else if (filterType === 'conditions') {
      filtered = filtered.filter(result => 
        result.condition_result !== null && result.condition_result !== undefined
      )
    }

    // Apply status filter
    if (filterStatus === 'true') {
      filtered = filtered.filter(result => result.condition_result === true)
    } else if (filterStatus === 'false') {
      filtered = filtered.filter(result => result.condition_result === false)
    }


    return filtered
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  const handleDeleteAnalysis = (analysis: AnalysisDetail) => {
    const analysisInfo = `${analysis.name} (${analysis.ai_model})`
    if (window.confirm(`Are you sure you want to delete "${analysisInfo}"?\n\nThis action cannot be undone.`)) {
      deleteMutation.mutate(analysis.id)
    }
  }

  const handleResultClick = (result: AnalysisResult) => {
    setSelectedResult(result)
    // Use the evidence text for highlighting in the PDF
    setHighlightedText(result.evidence || result.answer || '')
  }

  const toggleAnalysis = (analysisId: number) => {
    setExpandedAnalyses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(analysisId)) {
        newSet.delete(analysisId)
      } else {
        newSet.add(analysisId)
      }
      return newSet
    })
  }

  const isAnalysisExpanded = (analysisId: number) => {
    return expandedAnalyses.has(analysisId)
  }

  const toggleDocument = (analysisId: number, documentId: string | number) => {
    const documentKey = `${analysisId}-${documentId}`
    setExpandedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(documentKey)) {
        newSet.delete(documentKey)
      } else {
        newSet.add(documentKey)
      }
      return newSet
    })
  }

  const isDocumentExpanded = (analysisId: number, documentId: string | number) => {
    const documentKey = `${analysisId}-${documentId}`
    return expandedDocuments.has(documentKey)
  }

  const getDocumentUrl = (documentGroup: { document_id: string | number, document_name: string, results: AnalysisResult[] }) => {
    // Get the document URL from the first result in the group
    if (documentGroup.results && documentGroup.results.length > 0) {
      const firstResult = documentGroup.results[0]
      if (firstResult.document_url) {
        return firstResult.document_url
      }
    }
    
    // Fallback to hardcoded mapping if no URL is available
    const documentMap: Record<string, string> = {
      '1': 'http://localhost:8000/uploads/1_Bewerbungsbedingungen.pdf',
      '2': 'http://localhost:8000/uploads/1_Fragebogen zur Eignungspruefung.pdf', 
      '3': 'http://localhost:8000/uploads/1_KAT5.pdf',
    }
    
    return documentMap[String(documentGroup.document_id)] || 'http://localhost:8000/uploads/1_Bewerbungsbedingungen.pdf'
  }

  // Filter results based on search and status for a specific analysis
  const filteredResults = (analysis: AnalysisDetail) => {
    if (!analysis.results) return []
    
    // For now, return all results without filtering
    // In the future, we can add search and filter functionality back
    return analysis.results
  }

  // Group results by document
  const groupResultsByDocument = (results: AnalysisResult[]) => {
    const grouped = results.reduce((acc, result) => {
      const docId = result.document_id || 'unknown'
      const docName = result.document_name || 'Unknown Document'
      
      if (!acc[docId]) {
        acc[docId] = {
          document_id: docId,
          document_name: docName,
          results: []
        }
      }
      acc[docId].results.push(result)
      return acc
    }, {} as Record<string, { document_id: string | number, document_name: string, results: AnalysisResult[] }>)
    
    return Object.values(grouped)
  }


  // Export functions
  const exportToPDF = (analysis: AnalysisDetail) => {
    // Create a simple PDF export using browser's print functionality
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Analysis Report - ${analysis.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .analysis-info { margin-bottom: 20px; }
            .result-item { margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
            .status { font-weight: bold; }
            .status.fulfilled { color: green; }
            .status.not-fulfilled { color: red; }
            .status.pending { color: orange; }
            .evidence { background-color: #f5f5f5; padding: 8px; margin-top: 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Analysis Report: ${analysis.name}</h1>
            <p><strong>AI Model:</strong> ${analysis.ai_model}</p>
            <p><strong>Status:</strong> ${analysis.status}</p>
            <p><strong>Created:</strong> ${new Date(analysis.created_at).toLocaleString()}</p>
            <p><strong>Completed:</strong> ${analysis.completed_at ? new Date(analysis.completed_at).toLocaleString() : 'N/A'}</p>
          </div>
          
          <div class="analysis-info">
            <h2>Analysis Results</h2>
            ${analysis.results.map(result => `
              <div class="result-item">
                <h3>${result.question_text || 'Question'}</h3>
                <p><strong>Answer:</strong> ${result.answer}</p>
                <p><strong>Status:</strong> <span class="status ${result.condition_result === true ? 'fulfilled' : result.condition_result === false ? 'not-fulfilled' : 'pending'}">
                  ${result.condition_result === true ? 'Requirement Met' : result.condition_result === false ? 'Requirement Not Met' : 'Under Review'}
                </span></p>
                <p><strong>Confidence:</strong> ${result.confidence_score ? (result.confidence_score * 100).toFixed(1) + '%' : 'N/A'}</p>
                ${result.evidence ? `<div class="evidence"><strong>Evidence:</strong> ${result.evidence}</div>` : ''}
                <p><strong>Page References:</strong> ${result.page_references.join(', ')}</p>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.print()
  }


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const completedAnalyses = (analyses && Array.isArray(analyses)) ? analyses.filter(a => a.status === 'completed') : []
  
  // Filter for specific analysis if ID is provided
  const filteredAnalyses = specificAnalysisId 
    ? completedAnalyses.filter(a => a.id === parseInt(specificAnalysisId))
    : completedAnalyses

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            {specificAnalysisId && (
              <button
                onClick={() => window.history.back()}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {specificAnalysisId ? 'Analysis Details' : 'Analysis Results'}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {specificAnalysisId 
                  ? 'View detailed results for this analysis'
                  : 'View and export your analysis results'
                }
              </p>
            </div>
          </div>
        </div>

               {filteredAnalyses && filteredAnalyses.length > 0 ? (
                 <div className="space-y-4">
                   {filteredAnalyses.map((analysis) => (
                     <div key={analysis.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                       {/* Collapsible Analysis Header */}
                       <div 
                         className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => toggleAnalysis(analysis.id)}
                       >
                         <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                             {isAnalysisExpanded(analysis.id) ? (
                               <ChevronDown className="h-5 w-5 text-gray-500" />
                             ) : (
                               <ChevronRight className="h-5 w-5 text-gray-500" />
                             )}
                             <div>
                               <h2 className="text-lg font-semibold text-gray-900">{analysis.name}</h2>
                               <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                                 <span>{analysis.ai_model}</span>
                                 <div className="flex items-center space-x-1">
                                   <Clock className="h-3 w-3" />
                                   <span>{formatDateTime(analysis.created_at).date} at {formatDateTime(analysis.created_at).time}</span>
                                 </div>
                                 {analysis.processing_time && (
                                   <span>{analysis.processing_time.toFixed(1)}s processing time</span>
                                 )}
                                 <span className="text-blue-600 font-medium">
                                   {groupResultsByDocument(analysis.results || []).length} files, {groupResultsByDocument(analysis.results || []).length > 0 ? groupResultsByDocument(analysis.results || [])[0].results.length : 0} checklist items per file
                                 </span>
                               </div>
                             </div>
                           </div>
                           <div className="flex space-x-2">
                             <button 
                               className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                               onClick={(e) => {
                                 e.stopPropagation()
                                 exportToPDF(analysis)
                               }}
                             >
                               <Download className="h-4 w-4 mr-2 inline" />
                               Export PDF
                             </button>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 handleDeleteAnalysis(analysis)
                               }}
                               className="px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
                               title="Delete analysis"
                             >
                               <Trash2 className="h-4 w-4 mr-2 inline" />
                               Delete
                             </button>
                           </div>
                         </div>
                       </div>

                       {/* Document Toggle Elements */}
                       {isAnalysisExpanded(analysis.id) && (
                         <div className="border-t border-gray-200 p-6">
                           {groupResultsByDocument(filteredResults(analysis)).map((documentGroup) => (
                             <div key={documentGroup.document_id} className="mb-4 border border-gray-200 rounded-lg">
                               {/* Document Toggle Header */}
                               <div 
                                 className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
                                 onClick={() => toggleDocument(analysis.id, documentGroup.document_id)}
                               >
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center space-x-3">
                                     <div className="flex items-center space-x-2">
                                       {isDocumentExpanded(analysis.id, documentGroup.document_id) ? (
                                         <ChevronDown className="h-5 w-5 text-gray-400" />
                                       ) : (
                                         <ChevronRight className="h-5 w-5 text-gray-400" />
                                       )}
                                       <FileText className="h-5 w-5 text-blue-600" />
                                       <h4 className="text-lg font-medium text-gray-900">{documentGroup.document_name}</h4>
                                     </div>
                                   </div>
                                   <div className="flex items-center space-x-4">
                                     {/* Document Metrics */}
                                     <div className="flex items-center space-x-3 text-sm">
                                       <div className="flex items-center space-x-1">
                                         <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                         <span className="text-gray-600">
                                           {documentGroup.results.filter(result => 
                                             result.condition_result === null || result.condition_result === undefined
                                           ).length} questions
                                         </span>
                                       </div>
                                       <div className="flex items-center space-x-1">
                                         <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                         <span className="text-gray-600">
                                           {documentGroup.results.filter(result => 
                                             result.condition_result !== null && result.condition_result !== undefined
                                           ).length} conditions
                                         </span>
                                       </div>
                                       <div className="flex items-center space-x-1">
                                         {(() => {
                                           const conditions = documentGroup.results.filter(result => 
                                             result.condition_result !== null && result.condition_result !== undefined
                                           )
                                           const metConditions = conditions.filter(result => result.condition_result === true)
                                           const percentage = conditions.length > 0 ? Math.round((metConditions.length / conditions.length) * 100) : 0
                                           
                                           // Traffic light logic
                                           let dotColor = 'bg-gray-500' // Default gray
                                           if (percentage >= 70) {
                                             dotColor = 'bg-green-500' // Green for 70-100%
                                           } else if (percentage >= 50) {
                                             dotColor = 'bg-yellow-500' // Yellow for 50-69%
                                           } else if (percentage >= 30) {
                                             dotColor = 'bg-orange-500' // Orange for 30-49%
                                           } else if (percentage > 0) {
                                             dotColor = 'bg-red-500' // Red for 1-29%
                                           }
                                           
                                           return (
                                             <>
                                               <div className={`w-2 h-2 ${dotColor} rounded-full`}></div>
                                               <span className="text-gray-600">
                                                 {percentage}% met
                                               </span>
                                             </>
                                           )
                                         })()}
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                               </div>

                               {/* Document Content - PDF Viewer and Checklist */}
                               {isDocumentExpanded(analysis.id, documentGroup.document_id) && (
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[600px]">
                                   {/* Left Side - PDF Viewer */}
                                   <div className="bg-gray-50">
                                     <div className="h-full flex flex-col">
                                       {/* PDF Header */}
                                       <div className="border-b border-gray-200 px-4 py-3">
                                         <div className="flex items-center justify-between">
                                           <h5 className="text-sm font-medium text-gray-900">Document Viewer</h5>
                                           {getDocumentUrl(documentGroup) && (
                                             <button
                                               onClick={(e) => {
                                                 e.stopPropagation()
                                                 const url = getDocumentUrl(documentGroup)
                                                 if (url) window.open(url, '_blank')
                                               }}
                                               className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                             >
                                               <ExternalLink className="h-4 w-4 mr-1" />
                                               Open in New Tab
                                             </button>
                                           )}
                                         </div>
                                       </div>

                                       {/* PDF Content */}
                                       <div className="flex-1 bg-gray-100">
                                         {getDocumentUrl(documentGroup) ? (
                                           <PDFViewer
                                             src={getDocumentUrl(documentGroup)!}
                                             highlightText={highlightedText}
                                           />
                                         ) : (
                                           <div className="flex items-center justify-center h-full">
                                             <div className="text-center">
                                               <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                               <h3 className="text-lg font-medium text-gray-900 mb-2">No Document Available</h3>
                                               <p className="text-sm text-gray-500">
                                                 The document for this analysis is not available.
                                               </p>
                                             </div>
                                           </div>
                                         )}
                                       </div>
                                     </div>
                                   </div>

                                   {/* Right Side - Checklist Items for this Document */}
                                   <div className="bg-white">
                                     <div className="h-full flex flex-col">
                                       {/* Checklist Header */}
                                       <div className="border-b border-gray-200 px-4 py-3">
                                         <div className="flex items-center justify-between mb-3">
                                           <div>
                                             <h5 className="text-sm font-medium text-gray-900">Checklist Items</h5>
                                             <div className="text-xs text-gray-500 mt-1">
                                               {filterAndSortResults(documentGroup.results).length} of {documentGroup.results.length} items
                                             </div>
                                           </div>
                                           <div className="flex items-center space-x-3">
                                             <div className="flex items-center space-x-2">
                                               <Filter className="h-4 w-4 text-gray-500" />
                                               <select
                                                 value={filterType}
                                                 onChange={(e) => setFilterType(e.target.value as 'all' | 'questions' | 'conditions')}
                                                 className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                               >
                                                 <option value="all">All Types</option>
                                                 <option value="questions">Questions</option>
                                                 <option value="conditions">Conditions</option>
                                               </select>
                                               <select
                                                 value={filterStatus}
                                                 onChange={(e) => setFilterStatus(e.target.value as 'all' | 'true' | 'false')}
                                                 className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                               >
                                                 <option value="all">All Status</option>
                                                 <option value="true">True</option>
                                                 <option value="false">False</option>
                                               </select>
                                             </div>
                                           </div>
                                         </div>
                                         
                                         {/* Search Bar */}
                                         <div className="relative">
                                           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                           <input
                                             type="text"
                                             placeholder="Search questions, answers, or evidence..."
                                             value={searchTerm}
                                             onChange={(e) => setSearchTerm(e.target.value)}
                                             className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                           />
                                         </div>
                                       </div>

                                       {/* Checklist Items */}
                                       <div className="flex-1 p-4 overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                                         <div className="space-y-3">
                                           {filterAndSortResults(documentGroup.results).map((result, index) => (
                                             <div 
                                               key={result.id} 
                                               onClick={() => handleResultClick(result)}
                                               className={`cursor-pointer border rounded-lg p-4 transition-all duration-200 ${
                                                 selectedResult?.id === result.id 
                                                   ? 'border-blue-500 bg-blue-50 shadow-md' 
                                                   : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                               }`}
                                             >
                                               {/* Checklist Item Header */}
                                               <div className="flex items-start justify-between mb-2">
                                                 <div className="flex items-center space-x-2">
                                                   <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                                                   <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getItemTypeColor(result)}`}>
                                                     {getItemTypeText(result)}
                                                   </span>
                                                   {(result.condition_result === true || result.condition_result === false) && (
                                                     <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result)}`}>
                                                       {result.condition_result === true ? (
                                                         <CheckCircle className="h-3 w-3 mr-1" />
                                                       ) : (
                                                         <XCircle className="h-3 w-3 mr-1" />
                                                       )}
                                                       {getStatusText(result)}
                                                     </span>
                                                   )}
                                                 </div>
                                                 <div className="flex items-center space-x-2 text-xs text-gray-500">
                                                   <div className="flex items-center">
                                                     <Eye className="h-3 w-3 mr-1" />
                                                     {Math.round((result.confidence_score || 0) * 100)}%
                                                   </div>
                                                   {result.page_references && result.page_references.length > 0 && (
                                                     <div className="flex items-center">
                                                       <BookOpen className="h-3 w-3 mr-1" />
                                                       P. {result.page_references[0]}
                                                     </div>
                                                   )}
                                                 </div>
                                               </div>

                                               {/* Question/Condition */}
                                               <div className="mb-3">
                                                 <h5 className="text-xs font-medium text-gray-700 mb-1">Question/Condition:</h5>
                                                 <h4 className="text-sm font-semibold text-gray-900 leading-relaxed">
                                                   {result.question_text || 'No question text available'}
                                                 </h4>
                                               </div>

                                               {/* AI Answer */}
                                               <div className="mb-3">
                                                 <h5 className="text-xs font-medium text-gray-700 mb-1">Answer:</h5>
                                                 <p className="text-sm text-gray-800 leading-relaxed">
                                                   {result.answer || 'No answer provided'}
                                                 </p>
                                               </div>

                                               {/* Evidence/Proof */}
                                               {result.evidence && (
                                                 <div className="bg-gray-50 rounded-md p-3">
                                                   <h5 className="text-xs font-medium text-gray-700 mb-1">Evidence:</h5>
                                                   <p className="text-xs text-gray-600 leading-relaxed">
                                                     {result.evidence}
                                                   </p>
                                                 </div>
                                               )}

                                               {/* Click indicator */}
                                               <div className="mt-2 text-xs text-gray-400">
                                                 Click to highlight evidence in PDF
                                               </div>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {specificAnalysisId ? 'Analysis not found' : 'No completed analyses'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {specificAnalysisId 
                ? 'The requested analysis could not be found or is not completed yet.'
                : 'Start an analysis to see results here.'
              }
            </p>
            {specificAnalysisId && (
              <div className="mt-4">
                <button
                  onClick={() => window.history.back()}
                  className="btn-primary"
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Results