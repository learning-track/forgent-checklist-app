import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../services/api'
import { Plus, CheckSquare, Edit, Trash2, Copy, Eye, X, CheckCircle } from 'lucide-react'

interface ChecklistItem {
  id: number
  type: string
  text: string
  order: number
}

interface Checklist {
  id: number
  name: string
  description: string
  language: string
  is_template: boolean
  template_category: string
  created_at: string
  items: ChecklistItem[]
}

// Simple language detection function
const detectLanguage = (text: string): string => {
  if (!text || text.trim().length < 3) return 'de'
  
  const germanWords = ['der', 'die', 'das', 'und', 'oder', 'mit', 'für', 'von', 'zu', 'auf', 'in', 'an', 'ist', 'sind', 'haben', 'werden', 'können', 'müssen', 'sollen', 'dürfen', 'wollen', 'mögen', 'sein', 'werden', 'haben', 'können', 'müssen', 'sollen', 'dürfen', 'wollen', 'mögen']
  const englishWords = ['the', 'and', 'or', 'with', 'for', 'from', 'to', 'on', 'in', 'at', 'is', 'are', 'have', 'will', 'can', 'must', 'should', 'may', 'want', 'like', 'be', 'will', 'have', 'can', 'must', 'should', 'may', 'want', 'like']
  
  const words = text.toLowerCase().split(/\s+/)
  let germanCount = 0
  let englishCount = 0
  
  words.forEach(word => {
    if (germanWords.includes(word)) germanCount++
    if (englishWords.includes(word)) englishCount++
  })
  
  return germanCount > englishCount ? 'de' : 'en'
}

const Checklists: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [checklistToDelete, setChecklistToDelete] = useState<Checklist | null>(null)
  const [checklistToView, setChecklistToView] = useState<Checklist | null>(null)
  const [checklistToEdit, setChecklistToEdit] = useState<Checklist | null>(null)
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })
  const [newChecklist, setNewChecklist] = useState({
    name: '',
    description: '',
    language: 'de',
    items: [] as ChecklistItem[]
  })
  const [newItem, setNewItem] = useState({
    type: 'question',
    text: ''
  })
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false)
  
  const queryClient = useQueryClient()

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showDeleteModal || showViewModal || showEditModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showDeleteModal, showViewModal, showEditModal])

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }))
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [notification.show])

  // Auto-detect language when name or description changes
  useEffect(() => {
    const combinedText = `${newChecklist.name} ${newChecklist.description}`.trim()
    if (combinedText.length > 3) {
      setIsDetectingLanguage(true)
      // Small delay to show detection state
      setTimeout(() => {
        const detectedLanguage = detectLanguage(combinedText)
        if (detectedLanguage !== newChecklist.language) {
          setNewChecklist(prev => ({ ...prev, language: detectedLanguage }))
        }
        setIsDetectingLanguage(false)
      }, 300)
    }
  }, [newChecklist.name, newChecklist.description])

  const { data: checklists, isLoading } = useQuery<Checklist[]>('checklists', async () => {
    const response = await api.get('/api/checklists/')
    return response.data
  })

  const { data: templates } = useQuery<Checklist[]>('templates', async () => {
    const response = await api.get('/api/checklists/templates')
    return response.data
  })

  const createMutation = useMutation(
    async (checklist: any) => {
      const response = await api.post('/api/checklists/', checklist)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('checklists')
        setShowCreateForm(false)
        setNewChecklist({ name: '', description: '', language: 'de', items: [] })
      }
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      await api.delete(`/api/checklists/${id}`)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('checklists')
        setNotification({
          show: true,
          message: 'Checklist deleted successfully!',
          type: 'success'
        })
      },
      onError: (error: any) => {
        console.error('Delete error:', error)
        setNotification({
          show: true,
          message: `Failed to delete checklist: ${error.response?.data?.detail || error.message}`,
          type: 'error'
        })
      }
    }
  )

  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await api.put(`/api/checklists/${id}`, data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('checklists')
        setNotification({
          show: true,
          message: 'Checklist updated successfully!',
          type: 'success'
        })
        closeEditModal()
      },
      onError: (error: any) => {
        console.error('Update error:', error)
        setNotification({
          show: true,
          message: `Failed to update checklist: ${error.response?.data?.detail || error.message}`,
          type: 'error'
        })
      }
    }
  )

  const addItem = () => {
    if (newItem.text.trim()) {
      setNewChecklist({
        ...newChecklist,
        items: [...(newChecklist.items || []), { ...newItem, id: Date.now(), order: newChecklist.items?.length || 0 }]
      })
      setNewItem({ type: 'question', text: '' })
    }
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...(newChecklist.items || [])]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setNewChecklist({
      ...newChecklist,
      items: updatedItems
    })
  }

  const removeItem = (index: number) => {
    setNewChecklist({
      ...newChecklist,
      items: (newChecklist.items || []).filter((_, i) => i !== index)
    })
  }

  const handleDeleteChecklist = (checklist: Checklist) => {
    setChecklistToDelete(checklist)
    setShowDeleteModal(true)
  }

  const handleViewChecklist = (checklist: Checklist) => {
    setChecklistToView(checklist)
    setShowViewModal(true)
  }

  const handleEditChecklist = (checklist: Checklist) => {
    setChecklistToEdit(checklist)
    setNewChecklist({
      name: checklist.name,
      description: checklist.description,
      language: checklist.language,
      items: [...checklist.items]
    })
    setShowEditModal(true)
  }

  const confirmDelete = () => {
    if (checklistToDelete) {
      deleteMutation.mutate(checklistToDelete.id)
      setShowDeleteModal(false)
      setChecklistToDelete(null)
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setChecklistToDelete(null)
  }

  const closeViewModal = () => {
    setShowViewModal(false)
    setChecklistToView(null)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setChecklistToEdit(null)
    setNewChecklist({
      name: '',
      description: '',
      language: 'de',
      items: []
    })
  }

  const handleCreate = () => {
    if (newChecklist.name.trim() && (newChecklist.items?.length || 0) > 0) {
      createMutation.mutate(newChecklist)
    }
  }

  const useTemplate = (template: Checklist) => {
    setNewChecklist({
      name: `${template.name} (Copy)`,
      description: template.description,
      language: template.language,
      items: template.items
    })
    setShowTemplates(false)
    setShowCreateForm(true)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checklists</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage your tender checklists
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowTemplates(true)}
            className="inline-flex items-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200 border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Copy className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="whitespace-nowrap">Use Template</span>
          </button>
          <button
            onClick={() => {
              setNewChecklist({
                name: '',
                description: '',
                language: 'de',
                items: []
              })
              setNewItem({
                type: 'question',
                text: ''
              })
              setShowCreateForm(true)
            }}
            className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
          >
            <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="whitespace-nowrap">Create Checklist</span>
          </button>
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ 
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
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Template Checklists</h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates?.map((template) => (
                <div key={template.id} className="border rounded-lg p-4">
                  <h3 className="font-medium">{template.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {template.items?.length || 0} items • {template.language.toUpperCase()}
                  </p>
                  <button
                    onClick={() => useTemplate(template)}
                    className="mt-3 inline-flex items-center justify-center w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <Copy className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">Use Template</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ 
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
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Checklist</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Checklist Name
                  </label>
                  <input
                    type="text"
                    value={newChecklist.name}
                    onChange={(e) => setNewChecklist({ ...newChecklist, name: e.target.value })}
                    className="input"
                    placeholder="Enter checklist name"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language 
                    {isDetectingLanguage ? (
                      <span className="text-xs text-blue-600 ml-2">🔍 Detecting...</span>
                    ) : (
                      <span className="text-xs text-green-600 ml-2">✓ Auto-detected</span>
                    )}
                  </label>
                  <select
                    value={newChecklist.language}
                    onChange={(e) => setNewChecklist({ ...newChecklist, language: e.target.value })}
                    className={`input w-full ${isDetectingLanguage ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}
                    disabled={isDetectingLanguage}
                  >
                    <option value="de">🇩🇪 German</option>
                    <option value="en">🇺🇸 English</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newChecklist.description}
                  onChange={(e) => setNewChecklist({ ...newChecklist, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Enter description"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add Item
                </label>
                <div className="flex space-x-2">
                  <select
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                    className="input w-32"
                  >
                    <option value="question">Question</option>
                    <option value="condition">Condition</option>
                  </select>
                  <input
                    type="text"
                    value={newItem.text}
                    onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
                    className="input flex-1"
                    placeholder="Enter item text"
                  />
                  <button
                    onClick={addItem}
                    className="btn-primary"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Items ({newChecklist.items?.length || 0})</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {(newChecklist.items || []).map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                          {item.type}
                        </span>
                        <span className="text-sm">{item.text}</span>
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200 border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  <span className="whitespace-nowrap">Cancel</span>
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newChecklist.name.trim() || (newChecklist.items?.length || 0) === 0}
                  className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md disabled:shadow-none"
                >
                  <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-nowrap">Create Checklist</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checklists List */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading checklists...</p>
          </div>
        ) : checklists && Array.isArray(checklists) && checklists.length > 0 ? (
          <div className="space-y-4">
            {checklists.map((checklist) => (
              <div 
                key={checklist.id} 
                className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleViewChecklist(checklist)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900">{checklist.name}</h3>
                      {checklist.is_template && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Template
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{checklist.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>{checklist.language.toUpperCase()}</span>
                      <span>{checklist.items?.length || 0} items</span>
                      <span>{new Date(checklist.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewChecklist(checklist)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="View checklist details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditChecklist(checklist)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Edit checklist"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {!checklist.is_template && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteChecklist(checklist)
                        }}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Delete checklist"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No checklists created</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first checklist to get started.
            </p>
          </div>
        )}
      </div>

      {/* View Checklist Modal */}
      {showViewModal && checklistToView && (
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">View Checklist</h3>
              <button
                onClick={closeViewModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-xl font-semibold text-gray-900 mb-2">{checklistToView.name}</h4>
                <p className="text-sm text-gray-500 mb-2">
                  {checklistToView.language.toUpperCase()} • {checklistToView.items?.length || 0} items
                </p>
                {checklistToView.description && (
                  <p className="text-gray-700 mb-4">{checklistToView.description}</p>
                )}
              </div>
              
              <div className="space-y-3">
                <h5 className="text-lg font-medium text-gray-900 mb-3">Checklist Items:</h5>
                {checklistToView.items && checklistToView.items.length > 0 ? (
                  checklistToView.items.map((item, index) => (
                    <div key={item.id || index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm font-medium text-gray-500">
                              {item.type === 'question' ? 'Question' : 'Condition'}
                            </span>
                          </div>
                          <p className="text-gray-900 leading-relaxed">{item.text}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">No items in this checklist</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={closeViewModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Checklist Modal */}
      {showEditModal && (
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Checklist</h3>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Checklist Name
                  </label>
                  <input
                    type="text"
                    value={newChecklist.name}
                    onChange={(e) => setNewChecklist({ ...newChecklist, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter checklist name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    value={newChecklist.language}
                    onChange={(e) => setNewChecklist({ ...newChecklist, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="de">German</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newChecklist.description}
                  onChange={(e) => setNewChecklist({ ...newChecklist, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter checklist description"
                />
              </div>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Checklist Items</h4>
                  <button
                    onClick={() => {
                      const newEmptyItem = {
                        id: Date.now(),
                        type: 'question',
                        text: '',
                        order: newChecklist.items?.length || 0
                      }
                      setNewChecklist({
                        ...newChecklist,
                        items: [...(newChecklist.items || []), newEmptyItem]
                      })
                    }}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </button>
                </div>
                
                <div className="space-y-4">
                  {newChecklist.items?.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type
                            </label>
                            <select
                              value={item.type}
                              onChange={(e) => updateItem(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="question">Question</option>
                              <option value="condition">Condition</option>
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(index)}
                          className="ml-4 p-2 text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Text
                        </label>
                        <textarea
                          value={item.text}
                          onChange={(e) => updateItem(index, 'text', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Enter question or condition text"
                        />
                      </div>
                    </div>
                  ))}
                  
                  {(!newChecklist.items || newChecklist.items.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No items added yet. Click "Add Item" to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (checklistToEdit) {
                    updateMutation.mutate({ 
                      id: checklistToEdit.id, 
                      data: newChecklist 
                    })
                  }
                }}
                disabled={!newChecklist.name.trim() || (newChecklist.items?.length || 0) === 0 || updateMutation.isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {updateMutation.isLoading ? 'Updating...' : 'Update Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <h3 className="text-lg font-semibold text-gray-900">Delete Checklist</h3>
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
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 mb-2">
                    Are you sure you want to delete this checklist?
                  </p>
                  {checklistToDelete && (
                    <div className="bg-gray-50 rounded-md p-3 mb-4">
                      <p className="text-sm font-medium text-gray-900">{checklistToDelete.name}</p>
                      <p className="text-xs text-gray-500">{checklistToDelete.language} • {checklistToDelete.items?.length || 0} items</p>
                      <p className="text-xs text-gray-500">
                        Created: {new Date(checklistToDelete.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-red-600 font-medium">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 rounded-b-lg">
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
                Delete Checklist
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
                      ? 'text-green-500 hover:bg-green-100' 
                      : 'text-red-500 hover:bg-red-100'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    notification.type === 'success' ? 'focus:ring-green-600' : 'focus:ring-red-600'
                  }`}
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

export default Checklists
