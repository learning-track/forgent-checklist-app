import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useDropzone } from 'react-dropzone'
import { api } from '../services/api'
import { Upload, FileText, Trash2, Eye, Clock, X, Edit, CheckCircle } from 'lucide-react'

interface Document {
  id: number
  filename: string
  original_filename: string
  file_size: number
  mime_type: string
  language: string
  status: string
  created_at: string
}

const Documents: React.FC = () => {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [renamingDocument, setRenamingDocument] = useState<number | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })
  const queryClient = useQueryClient()

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

  const { data: documents, isLoading } = useQuery<Document[]>('documents', async () => {
    const response = await api.get('/api/documents/')
    // Sort documents by creation date in descending order (newest first)
    return response.data.sort((a: Document, b: Document) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  })

  const uploadMutation = useMutation(
    async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await api.post('/api/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents')
      },
      onError: (error) => {
        console.error('Upload error:', error)
        alert(`Failed to upload file: ${error.message}`)
      }
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      await api.delete(`/api/documents/${id}`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents')
        setNotification({
          show: true,
          message: 'Document deleted successfully!',
          type: 'success'
        })
      },
      onError: (error: any) => {
        console.error('Delete error:', error)
        setNotification({
          show: true,
          message: `Failed to delete document: ${error.response?.data?.detail || error.message}`,
          type: 'error'
        })
      }
    }
  )

  const renameMutation = useMutation(
    async ({ id, newName }: { id: number; newName: string }) => {
      const response = await api.patch(`/api/documents/${id}`, { original_filename: newName })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents')
        setRenamingDocument(null)
        setNewFileName('')
        setNotification({
          show: true,
          message: 'Document renamed successfully!',
          type: 'success'
        })
      },
      onError: (error: any) => {
        console.error('Rename error:', error)
        setNotification({
          show: true,
          message: `Failed to rename document: ${error.response?.data?.detail || error.message}`,
          type: 'error'
        })
      }
    }
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploading(true)
        setUploadProgress({ current: 0, total: acceptedFiles.length })
        try {
          // Upload files sequentially to avoid overwhelming the server
          for (let i = 0; i < acceptedFiles.length; i++) {
            const file = acceptedFiles[i]
            setUploadProgress({ current: i + 1, total: acceptedFiles.length })
            await uploadMutation.mutateAsync(file)
          }
        } catch (error) {
          console.error('Upload error:', error)
        } finally {
          setUploading(false)
          setUploadProgress({ current: 0, total: 0 })
        }
      }
    },
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDeleteDocument = (document: Document) => {
    setDocumentToDelete(document)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (documentToDelete) {
      deleteMutation.mutate(documentToDelete.id)
      setShowDeleteModal(false)
      setDocumentToDelete(null)
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setDocumentToDelete(null)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  const handleDocumentClick = (document: Document) => {
    if (selectedDocument?.id === document.id) {
      // If clicking the same document, close the PDF viewer
      setSelectedDocument(null)
    } else {
      // If clicking a different document, open it in the PDF viewer
      setSelectedDocument(document)
      setPdfLoading(true)
      setPdfError(false)
    }
  }

  const handleRenameStart = (document: Document) => {
    setRenamingDocument(document.id)
    setNewFileName(document.original_filename)
  }

  const handleRenameCancel = () => {
    setRenamingDocument(null)
    setNewFileName('')
  }

  const handleRenameSave = () => {
    if (newFileName.trim() && renamingDocument) {
      renameMutation.mutate({ id: renamingDocument, newName: newFileName.trim() })
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload and manage your tender documents
        </p>
      </div>

      <div className={`flex gap-6 ${selectedDocument ? '' : 'justify-start'}`}>
        {/* Left Side - Upload and Documents List */}
        <div className={`space-y-6 ${selectedDocument ? 'flex-1' : 'w-full'}`}>

      {/* Upload Area */}
      <div className="card">

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className={`mx-auto h-12 w-12 transition-colors ${
            isDragActive
              ? 'text-primary-500'
              : 'text-gray-400'
          }`} />
          <div className="mt-4">
            <p className={`text-lg font-medium transition-colors ${
              isDragActive
                ? 'text-primary-700'
                : 'text-gray-900'
            }`}>
              {isDragActive
                ? 'Drop the PDF files here'
                : 'Drag & drop PDF files here, or click to select'}
            </p>
            <p className={`mt-1 text-sm transition-colors ${
              isDragActive
                ? 'text-primary-600'
                : 'text-gray-500'
            }`}>
              Multiple PDF files supported
            </p>
          </div>
        </div>

        {uploading && (
          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-sm text-gray-600">
              Uploading {uploadProgress.current} of {uploadProgress.total} files...
            </span>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Uploaded Documents ({documents?.length || 0})
          </h2>
        </div>

        {documents && documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedDocument?.id === doc.id 
                    ? 'bg-blue-50 border-2 border-blue-200' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => handleDocumentClick(doc)}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-red-500" />
                  </div>
                  <div className="ml-4">
                    {renamingDocument === doc.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 flex-1"
                          onClick={(e) => e.stopPropagation()}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameSave()
                            } else if (e.key === 'Escape') {
                              handleRenameCancel()
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRenameSave()
                          }}
                          className="text-green-600 hover:text-green-800 text-xs px-2 py-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRenameCancel()
                          }}
                          className="text-gray-600 hover:text-gray-800 text-xs px-2 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{doc.original_filename}</p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                      <span>{doc.language.toUpperCase()}</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDateTime(doc.created_at).date} at {formatDateTime(doc.created_at).time}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDocumentClick(doc)
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View document"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRenameStart(doc)
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Rename document"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteDocument(doc)
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents uploaded</h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload your first PDF document to get started.
            </p>
          </div>
        )}
      </div>
        </div>

        {/* Right Side - PDF Viewer (only when document is selected) */}
        {selectedDocument && (
          <div className="w-1/2">
            <div className="card h-[800px] flex flex-col">
              {/* PDF Viewer Header */}
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate" title={selectedDocument.original_filename}>
                      {selectedDocument.original_filename}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedDocument.language.toUpperCase()} • {formatFileSize(selectedDocument.file_size)} • {formatDateTime(selectedDocument.created_at).date} at {formatDateTime(selectedDocument.created_at).time}
                    </p>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <button
                      onClick={() => setSelectedDocument(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 p-4">
                {pdfLoading && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600">Loading PDF...</p>
                    </div>
                  </div>
                )}
                {pdfError && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load PDF</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        The document could not be displayed. Try opening it in a new tab.
                      </p>
                      <button
                        onClick={() => window.open(`http://localhost:8000/uploads/${selectedDocument.filename}`, '_blank')}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Open in New Tab
                      </button>
                    </div>
                  </div>
                )}
                <iframe
                  src={`http://localhost:8000/uploads/${selectedDocument.filename}#toolbar=1&navpanes=1&scrollbar=1`}
                  className={`w-full h-full border border-gray-200 rounded-lg ${pdfLoading ? 'hidden' : ''}`}
                  title={selectedDocument.original_filename}
                  onLoad={() => {
                    setPdfLoading(false)
                    setPdfError(false)
                  }}
                  onError={() => {
                    setPdfLoading(false)
                    setPdfError(true)
                  }}
                />
              </div>
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
              <h3 className="text-lg font-semibold text-gray-900">Delete Document</h3>
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
                    Are you sure you want to delete this document?
                  </p>
                  {documentToDelete && (
                    <div className="bg-gray-50 rounded-md p-3 mb-4">
                      <p className="text-sm font-medium text-gray-900">{documentToDelete.original_filename}</p>
                      <p className="text-xs text-gray-500">{documentToDelete.language} • {formatFileSize(documentToDelete.file_size)}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded: {formatDateTime(documentToDelete.created_at).date} at {formatDateTime(documentToDelete.created_at).time}
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
                Delete Document
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

export default Documents
