import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Plus, Check, Trash2, ShoppingBag, Briefcase, User, Users } from 'lucide-react'
import './Checklist.css'

export default function Checklist({ userRole, collaborators }) {
    const { id } = useParams()
    const { user } = useAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('prep') // 'prep' | 'shopping'

    // Filters
    const [assigneeFilter, setAssigneeFilter] = useState('all') // 'all' | userId

    // Add Item Inputs
    const [newItemContent, setNewItemContent] = useState('')
    const [selectedAssignees, setSelectedAssignees] = useState([user?.id]) // Default to self

    useEffect(() => {
        if (user?.id) {
            // Ensure self is selected by default if state was reset
            setSelectedAssignees(prev => prev.length === 0 ? [user.id] : prev)
        }
        fetchChecklists()
    }, [id, user?.id])

    const fetchChecklists = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('trip_checklists')
                .select(`
                    *,
                    assignee:assignee_id (full_name, email, avatar_url)
                `)
                .eq('trip_id', id)
                .order('created_at', { ascending: true })

            if (error) throw error
            setItems(data)
        } catch (error) {
            console.error('Error fetching checklist:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddItem = async (e) => {
        e.preventDefault()
        if (!newItemContent.trim()) return
        if (selectedAssignees.length === 0) {
            alert('請至少選擇一位負責人')
            return
        }

        try {
            // Batch insert for each selected assignee
            const newItemsPayload = selectedAssignees.map(userId => ({
                trip_id: id,
                content: newItemContent,
                category: activeTab,
                assignee_id: userId,
                is_checked: false
            }))

            const { data, error } = await supabase
                .from('trip_checklists')
                .insert(newItemsPayload)
                .select(`
                    *,
                    assignee:assignee_id (full_name, email, avatar_url)
                `)

            if (error) throw error

            setItems([...items, ...data])
            setNewItemContent('')
            // Keep assignees selected for convenience
        } catch (error) {
            alert(error.message)
        }
    }

    const toggleCheck = async (itemId, currentStatus) => {
        // Optimistic update
        setItems(items.map(i => i.id === itemId ? { ...i, is_checked: !currentStatus } : i))

        try {
            const { error } = await supabase
                .from('trip_checklists')
                .update({ is_checked: !currentStatus })
                .eq('id', itemId)

            if (error) throw error
        } catch (error) {
            console.error(error)
            // Revert on error
            setItems(items.map(i => i.id === itemId ? { ...i, is_checked: currentStatus } : i))
        }
    }

    const handleDelete = async (itemId) => {
        if (!confirm('確定刪除此項目？')) return
        try {
            const { error } = await supabase
                .from('trip_checklists')
                .delete()
                .eq('id', itemId)

            if (error) throw error
            setItems(items.filter(i => i.id !== itemId))
        } catch (error) {
            console.error(error)
        }
    }

    const toggleAssigneeSelection = (userId) => {
        setSelectedAssignees(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId)
            } else {
                return [...prev, userId]
            }
        })
    }

    // Filter items logic
    const filteredItems = items.filter(i => {
        const matchTab = i.category === activeTab
        const matchAssignee = assigneeFilter === 'all' || i.assignee_id === assigneeFilter
        return matchTab && matchAssignee
    })

    return (
        <div className="checklist-container">
            {/* Filter Bar (Copied style from Expenses) */}
            <div className="checklist-filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <div className="expenses-filters">
                    <div className="filter-group">
                        <label><Users size={16} /> 只看</label>
                        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
                            <option value="all">所有人</option>
                            <option value={user?.id}>我的項目</option>
                            {collaborators.map(c => (
                                <option key={c.user_id} value={c.user_id}>
                                    {c.profiles?.full_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="checklist-tabs">
                <button
                    className={`checklist-tab ${activeTab === 'prep' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prep')}
                >
                    <Briefcase size={18} /> 行前準備
                </button>
                <button
                    className={`checklist-tab ${activeTab === 'shopping' ? 'active' : ''}`}
                    onClick={() => setActiveTab('shopping')}
                >
                    <ShoppingBag size={18} /> 購物清單
                </button>
            </div>

            {/* Add Item Form */}
            {(userRole === 'owner' || userRole === 'editor') && (
                <div className="add-checklist-form glass-panel">
                    <div className="form-input-row">
                        <input
                            type="text"
                            value={newItemContent}
                            onChange={(e) => setNewItemContent(e.target.value)}
                            placeholder={activeTab === 'prep' ? "例如：帶護照、充電線..." : "例如：鳳梨酥、紀念品..."}
                            className="checklist-input"
                        />
                        <button className="add-btn" onClick={handleAddItem} disabled={!newItemContent.trim()}>
                            <Plus size={20} />
                        </button>
                    </div>

                    {/* Assignee Selector */}
                    <div className="assignee-selector">
                        <span className="selector-label">分配給：</span>
                        <div className="assignee-chips">
                            {/* Self */}
                            <button
                                type="button"
                                className={`assignee-chip ${selectedAssignees.includes(user?.id) ? 'selected' : ''}`}
                                onClick={() => toggleAssigneeSelection(user?.id)}
                            >
                                我
                            </button>
                            {/* Collaborators */}
                            {collaborators.map(c => (
                                <button
                                    key={c.user_id}
                                    type="button"
                                    className={`assignee-chip ${selectedAssignees.includes(c.user_id) ? 'selected' : ''}`}
                                    onClick={() => toggleAssigneeSelection(c.user_id)}
                                >
                                    {c.profiles?.full_name || '...'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className={`checklist-list glass-panel ${filteredItems.length === 0 ? 'empty' : ''}`}>
                {filteredItems.length === 0 ? (
                    <div className="empty-state">
                        {assigneeFilter !== 'all' ? '這位成員沒有此分類的項目。' : '目前還沒有項目，新增一個吧！'}
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <div key={item.id} className={`checklist-item ${item.is_checked ? 'checked' : ''}`}>
                            <button
                                className="check-btn"
                                onClick={() => toggleCheck(item.id, item.is_checked)}
                            >
                                {item.is_checked ? <Check size={16} /> : null}
                            </button>

                            <div className="item-content-col">
                                <span className="item-text">{item.content}</span>
                                <div className="item-meta">
                                    {item.assignee && (
                                        <span className="assignee-badge">
                                            <User size={10} /> {item.assignee.id === user?.id ? '我' : item.assignee.full_name}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {(userRole === 'owner' || userRole === 'editor') && (
                                <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
