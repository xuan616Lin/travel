import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Plus, DollarSign, PieChart, Users, Trash2 } from 'lucide-react'
import './Expenses.css'

export default function Expenses({ userRole, collaborators }) {
    const { id } = useParams()
    const { user } = useAuth()

    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [summary, setSummary] = useState({ total: 0, byCategory: {} })

    // Filters
    const [payerFilter, setPayerFilter] = useState('all') // 'all' | userId
    const [categoryFilter, setCategoryFilter] = useState('all') // 'all' | cat

    // New Expense Form
    const [newExpense, setNewExpense] = useState({
        amount: '',
        description: '',
        category: 'food', // food, transport, ticket, shopping, other
        payer_id: user?.id,
        currency: 'TWD'
    })

    useEffect(() => {
        fetchExpenses()
    }, [id])

    useEffect(() => {
        // Recalculate summary when expenses or filters change
        calculateSummary()
    }, [expenses, payerFilter, categoryFilter])

    const fetchExpenses = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('expenses')
                .select(`
          *,
          profiles:payer_id (full_name, email)
        `)
                .eq('trip_id', id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setExpenses(data)
        } catch (error) {
            console.error('Error fetching expenses:', error)
        } finally {
            setLoading(false)
        }
    }

    // Filter Logic
    const filteredExpenses = expenses.filter(e => {
        const matchPayer = payerFilter === 'all' || e.payer_id === payerFilter
        const matchCat = categoryFilter === 'all' || e.category === categoryFilter
        return matchPayer && matchCat
    })

    const calculateSummary = () => {
        const total = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0)

        const byCategory = filteredExpenses.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount)
            return acc
        }, {})

        setSummary({ total, byCategory })
    }

    // Category Translation Helper
    const getCategoryName = (cat) => {
        const map = {
            food: '餐飲',
            transport: '交通',
            ticket: '票券',
            shopping: '購物',
            lodging: '住宿',
            other: '其他'
        }
        return map[cat] || cat
    }

    // Helper to get user name
    const getUserName = (userId) => {
        if (userId === user?.id) {
            return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown'
        }
        const c = collaborators.find(c => c.user_id === userId)
        return c?.profiles?.full_name || c?.profiles?.email?.split('@')[0] || 'Unknown'
    }

    const handleAddExpense = async (e) => {
        e.preventDefault()
        try {
            const { data, error } = await supabase.from('expenses').insert([
                {
                    trip_id: id,
                    amount: newExpense.amount,
                    description: newExpense.description,
                    category: newExpense.category,
                    payer_id: newExpense.payer_id || user.id
                }
            ]).select(`
         *,
         profiles:payer_id (full_name, email)
      `)

            if (error) throw error

            setExpenses([data[0], ...expenses])
            // Summary will auto-update via useEffect
            setShowAddModal(false)
            setNewExpense({ ...newExpense, amount: '', description: '', payer_id: user.id })
        } catch (error) {
            console.error('Error adding expense:', error)
            alert(error.message)
        }
    }

    const handleDeleteExpense = async (expenseId) => {
        if (!confirm('確定要刪除這筆花費嗎？')) return
        try {
            const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
            if (error) throw error

            setExpenses(expenses.filter(e => e.id !== expenseId))
        } catch (error) {
            alert(error.message)
        }
    }

    if (loading) return <div className="loading-state">載入中...</div>

    return (
        <div className="expenses-container">
            {/* Filter Bar */}
            <div className="expenses-filters glass-panel">
                <div className="filter-group">
                    <label><Users size={14} /> 付款人</label>
                    <select value={payerFilter} onChange={e => setPayerFilter(e.target.value)}>
                        <option value="all">全部成員</option>
                        <option value={user?.id}>{user?.user_metadata?.full_name || user?.email?.split('@')[0] || '我'}</option>
                        {collaborators.map(c => (
                            <option key={c.user_id} value={c.user_id}>
                                {c.profiles?.full_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label><PieChart size={14} /> 類別</label>
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                        <option value="all">全部分類</option>
                        {['food', 'transport', 'ticket', 'shopping', 'lodging', 'other'].map(cat => (
                            <option key={cat} value={cat}>{getCategoryName(cat)}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="expenses-header">
                <h2>
                    {payerFilter !== 'all' ? `${getUserName(payerFilter)} 的支出` : '總支出'}
                    <span className="total-badge">{summary.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} TWD</span>
                </h2>
                {(userRole === 'owner' || userRole === 'editor') && (
                    <button className="primary-button" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> 記一筆
                    </button>
                )}
            </div>

            <div className="expenses-layout">
                {/* Summary Card */}
                <div className="summary-card glass-panel">
                    <h3><PieChart size={18} /> 花費統計</h3>
                    <div className="category-list">
                        {Object.entries(summary.byCategory).length === 0 ? (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>無資料</div>
                        ) : (
                            Object.entries(summary.byCategory).map(([cat, amount]) => (
                                <div key={cat} className="category-row">
                                    <span className={`cat-dot cat-${cat}`}></span>
                                    <span className="cat-name">{getCategoryName(cat)}</span>
                                    <span className="cat-amount">
                                        {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Expenses List */}
                <div className="expenses-list glass-panel">
                    {filteredExpenses.length === 0 ? (
                        <div className="empty-state">目前還沒有符合條件的花費紀錄。</div>
                    ) : (
                        filteredExpenses.map(expense => (
                            <div key={expense.id} className="expense-item">
                                <div className={`expense-icon cat-${expense.category}`}>
                                    <DollarSign size={20} />
                                </div>
                                <div className="expense-details">
                                    <div className="expense-main">
                                        <h4>{expense.description || getCategoryName(expense.category)}</h4>
                                        <span className="expense-amount">
                                            {Number(expense.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="expense-meta">
                                        <span className="payer-name">
                                            <Users size={12} /> {getUserName(expense.payer_id) || expense.profiles?.full_name}
                                        </span>
                                        <span className="date">{new Date(expense.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {(userRole === 'owner' || userRole === 'editor') && (
                                    <button className="delete-icon" onClick={() => handleDeleteExpense(expense.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel">
                        <h2>新增花費</h2>
                        <form onSubmit={handleAddExpense}>
                            <div className="form-group">
                                <label>金額</label>
                                <input
                                    type="number"
                                    required
                                    value={newExpense.amount}
                                    onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>項目說明</label>
                                <input
                                    type="text"
                                    value={newExpense.description}
                                    onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                    placeholder="午餐、車票..."
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>分類</label>
                                    <select
                                        value={newExpense.category}
                                        onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                                    >
                                        <option value="food">餐飲</option>
                                        <option value="transport">交通</option>
                                        <option value="ticket">票券</option>
                                        <option value="shopping">購物</option>
                                        <option value="lodging">住宿</option>
                                        <option value="other">其他</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>付款人</label>
                                    <select
                                        value={newExpense.payer_id}
                                        onChange={e => setNewExpense({ ...newExpense, payer_id: e.target.value })}
                                    >
                                        <option value={user?.id}>{user?.user_metadata?.full_name || user?.email?.split('@')[0] || '我'}</option>
                                        {collaborators.map(c => (
                                            <option key={c.user_id} value={c.user_id}>{c.profiles?.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="secondary-button" onClick={() => setShowAddModal(false)}>取消</button>
                                <button type="submit" className="primary-button">儲存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
