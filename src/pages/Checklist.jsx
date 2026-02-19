import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Plus, Check, Trash2, ShoppingBag, Briefcase, User, Users, Pencil, X, Save } from 'lucide-react'
import './Checklist.css'

export default function Checklist({ userRole, collaborators }) {
    const { id } = useParams()
    const { user } = useAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('prep') // 'prep' | 'shopping'

    // 篩選
    const [assigneeFilter, setAssigneeFilter] = useState('all') // 'all' | userId

    // 新增表單
    const [newItemContent, setNewItemContent] = useState('')
    const [selectedAssignees, setSelectedAssignees] = useState([user?.id]) // 預設選自己

    // 編輯狀態
    const [editingId, setEditingId] = useState(null)
    const [editContent, setEditContent] = useState('')
    const [editAssigneeId, setEditAssigneeId] = useState(null)
    const [savingEdit, setSavingEdit] = useState(false)

    useEffect(() => {
        if (user?.id) {
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
                    assignee:assignee_id (id, full_name, email, avatar_url)
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
                    assignee:assignee_id (id, full_name, email, avatar_url)
                `)

            if (error) throw error

            setItems([...items, ...data])
            setNewItemContent('')
        } catch (error) {
            alert(error.message)
        }
    }

    const toggleCheck = async (itemId, currentStatus) => {
        setItems(items.map(i => i.id === itemId ? { ...i, is_checked: !currentStatus } : i))
        try {
            const { error } = await supabase
                .from('trip_checklists')
                .update({ is_checked: !currentStatus })
                .eq('id', itemId)
            if (error) throw error
        } catch (error) {
            console.error(error)
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

    // 開始編輯
    const startEdit = (item) => {
        setEditingId(item.id)
        setEditContent(item.content)
        setEditAssigneeId(item.assignee_id)
    }

    // 取消編輯
    const cancelEdit = () => {
        setEditingId(null)
        setEditContent('')
        setEditAssigneeId(null)
    }

    // 儲存編輯
    const saveEdit = async (itemId) => {
        if (!editContent.trim()) return
        setSavingEdit(true)
        try {
            const { data, error } = await supabase
                .from('trip_checklists')
                .update({ content: editContent.trim(), assignee_id: editAssigneeId })
                .eq('id', itemId)
                .select(`
                    *,
                    assignee:assignee_id (id, full_name, email, avatar_url)
                `)
                .single()

            if (error) throw error

            setItems(items.map(i => i.id === itemId ? data : i))
            cancelEdit()
        } catch (err) {
            console.error('Error saving edit:', err)
            alert('儲存失敗: ' + err.message)
        } finally {
            setSavingEdit(false)
        }
    }

    const toggleAssigneeSelection = (userId) => {
        setSelectedAssignees(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        )
    }

    // 取得所有成員（自己 + 協作者）
    const allMembers = [
        { id: user?.id, name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '我' },
        ...collaborators.map(c => ({ id: c.user_id, name: c.profiles?.full_name || c.profiles?.email?.split('@')[0] || '未知' }))
    ]

    const filteredItems = items.filter(i => {
        const matchTab = i.category === activeTab
        const matchAssignee = assigneeFilter === 'all' || i.assignee_id === assigneeFilter
        return matchTab && matchAssignee
    })

    const canEdit = userRole === 'owner' || userRole === 'editor'

    return (
        <div className="checklist-container">
            {/* 篩選列 */}
            <div className="checklist-filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <div className="expenses-filters">
                    <div className="filter-group">
                        <label><Users size={16} /> 只看</label>
                        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
                            <option value="all">所有人</option>
                            {allMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tab 切換 */}
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

            {/* 新增表單 */}
            {canEdit && (
                <div className="add-checklist-form glass-panel">
                    <div className="form-input-row">
                        <input
                            type="text"
                            value={newItemContent}
                            onChange={(e) => setNewItemContent(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddItem(e)}
                            placeholder={activeTab === 'prep' ? '例如：帶護照、充電線...' : '例如：鳳梨酥、紀念品...'}
                            className="checklist-input"
                        />
                        <button className="add-btn" onClick={handleAddItem} disabled={!newItemContent.trim()}>
                            <Plus size={20} />
                        </button>
                    </div>

                    {/* 負責人選擇 */}
                    <div className="assignee-selector">
                        <span className="selector-label">分配給：</span>
                        <div className="assignee-chips">
                            {allMembers.map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    className={`assignee-chip ${selectedAssignees.includes(m.id) ? 'selected' : ''}`}
                                    onClick={() => toggleAssigneeSelection(m.id)}
                                >
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 清單列表 */}
            <div className={`checklist-list glass-panel ${filteredItems.length === 0 ? 'empty' : ''}`}>
                {filteredItems.length === 0 ? (
                    <div className="empty-state">
                        {assigneeFilter !== 'all' ? '這位成員沒有此分類的項目。' : '目前還沒有項目，新增一個吧！'}
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <div key={item.id} className={`checklist-item ${item.is_checked ? 'checked' : ''} ${editingId === item.id ? 'editing' : ''}`}>
                            {editingId === item.id ? (
                                /* ─── 編輯模式 ─── */
                                <div className="edit-mode-row">
                                    <input
                                        className="edit-input"
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') saveEdit(item.id)
                                            if (e.key === 'Escape') cancelEdit()
                                        }}
                                        autoFocus
                                    />
                                    <div className="edit-assignee-row">
                                        <span className="selector-label">負責人：</span>
                                        <select
                                            value={editAssigneeId || ''}
                                            onChange={e => setEditAssigneeId(e.target.value || null)}
                                        >
                                            <option value="">無</option>
                                            {allMembers.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="edit-actions">
                                        <button className="save-edit-btn" onClick={() => saveEdit(item.id)} disabled={savingEdit}>
                                            <Save size={15} /> 儲存
                                        </button>
                                        <button className="cancel-edit-btn" onClick={cancelEdit}>
                                            <X size={15} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ─── 一般顯示模式 ─── */
                                <>
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
                                                    <User size={10} /> {item.assignee.full_name || item.assignee.email?.split('@')[0] || 'Unknown'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {canEdit && (
                                        <div className="item-actions">
                                            <button className="edit-btn" onClick={() => startEdit(item)} title="編輯">
                                                <Pencil size={15} />
                                            </button>
                                            <button className="delete-btn" onClick={() => handleDelete(item.id)} title="刪除">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
