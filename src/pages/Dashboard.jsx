import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Plus, MapPin, Calendar, Clock, LogOut, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'
import UserMenu from '../components/UserMenu'
import './Dashboard.css'

export default function Dashboard() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()

    const [trips, setTrips] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)

    // New Trip Form State
    const [newTitle, setNewTitle] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [coverImage, setCoverImage] = useState('')
    const [creating, setCreating] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        fetchTrips()
    }, [user])

    const fetchTrips = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .order('start_date', { ascending: true })

            if (error) throw error
            setTrips(data || [])
        } catch (error) {
            console.error('Error fetching trips:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleImageFile = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            setUploading(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt} `;
            const filePath = `${fileName} `

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('trip-covers')
                .upload(filePath, file)

            if (uploadError) {
                // Hint if bucket missing
                if (uploadError.statusCode === "404") {
                    alert('上傳失敗：請檢查 Supabase Storage 是否已建立 "trip-covers" bucket (Public)。')
                }
                throw uploadError
            }

            // 2. Get Public URL
            const { data } = supabase.storage.from('trip-covers').getPublicUrl(filePath)
            setCoverImage(data.publicUrl)

        } catch (error) {
            console.error('Upload error:', error)
            alert('圖片上傳失敗，請稍後再試')
        } finally {
            setUploading(false)
        }
    }

    const handleCreateTrip = async (e) => {
        e.preventDefault()
        setCreating(true)

        try {
            const { data, error } = await supabase.from('trips').insert([
                {
                    owner_id: user.id,
                    title: newTitle,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    cover_image: coverImage || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
                }
            ]).select()

            if (error) throw error

            setTrips([...trips, ...data])
            setShowCreateModal(false)
            resetForm()
        } catch (error) {
            console.error('Error creating trip:', error)
            alert('創建行程失敗: ' + error.message)
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteTrip = async (e, id) => {
        e.stopPropagation() // Prevent card click
        if (!confirm('確定要刪除這個行程嗎？此動作無法復原。')) return

        try {
            const { error } = await supabase.from('trips').delete().eq('id', id)
            if (error) throw error
            setTrips(trips.filter(t => t.id !== id))
        } catch (error) {
            console.error('Error deleting trip:', error)
            alert(error.message)
        }
    }

    const resetForm = () => {
        setNewTitle('')
        setStartDate('')
        setEndDate('')
        setCoverImage('')
    }

    // Format Date Helper
    const formatDate = (dateString) => {
        if (!dateString) return '未定'
        return new Date(dateString).toLocaleDateString('zh-TW')
    }

    return (
        <div className="dashboard-container">
            {/* Header */}
            <header className="dashboard-header glass-panel">
                <div className="header-left">
                    <h1 className="gradient-text">旅遊行程規劃</h1>
                </div>
                <div className="header-right">
                    <UserMenu />
                </div>
            </header>

            {/* Main Content */}
            <main className="dashboard-content">
                <div className="content-actions">
                    <h2 className="section-title">我的行程</h2>
                    <button className="primary-button" onClick={() => setShowCreateModal(true)}>
                        <Plus size={20} />
                        新增行程
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state">載入中...</div>
                ) : trips.length === 0 ? (
                    <div className="empty-state glass-panel">
                        <MapPin size={48} className="empty-icon" />
                        <h3>尚無行程</h3>
                        <p>現在就開始規劃下一場冒險吧！</p>
                        <button className="primary-button" onClick={() => setShowCreateModal(true)}>
                            開始規劃
                        </button>
                    </div>
                ) : (
                    <div className="trips-grid">
                        {trips.map(trip => (
                            <div
                                key={trip.id}
                                className="trip-card glass-panel"
                                onClick={() => navigate(`/trip/${trip.id}`)}
                                style={{
                                    backgroundImage: `url(${trip.cover_image})`,
                                    backgroundPosition: trip.cover_position || 'center',
                                    backgroundSize: trip.cover_display || 'cover',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundColor: 'var(--bg-secondary)'
                                }}
                            >
                                <div className="trip-card-content">
                                    <div className="trip-actions">
                                        <button className="delete-btn" onClick={(e) => handleDeleteTrip(e, trip.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <h3>{trip.title}</h3>
                                    <div className="trip-date">
                                        <Calendar size={14} />
                                        {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Trip Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel">
                        <h2>規劃新旅程</h2>
                        <form onSubmit={handleCreateTrip}>
                            <div className="form-group">
                                <label>行程名稱</label>
                                <input
                                    type="text"
                                    placeholder="例如：京都夏日之旅"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>開始日期</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>結束日期</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>封面圖片</label>
                                <div className="image-input-group">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageFile}
                                        id="cover-upload"
                                        hidden
                                    />
                                    <label htmlFor="cover-upload" className="upload-btn secondary-button">
                                        {uploading ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                                        {uploading ? '上傳中...' : '上傳圖片'}
                                    </label>
                                    <span className="or-divider">或</span>
                                    <input
                                        type="url"
                                        placeholder="輸入圖片網址..."
                                        value={coverImage}
                                        onChange={e => setCoverImage(e.target.value)}
                                        className="url-input"
                                    />
                                </div>
                                {coverImage && (
                                    <div className="image-preview" style={{ backgroundImage: `url(${coverImage})` }}></div>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="secondary-button" onClick={() => setShowCreateModal(false)}>取消</button>
                                <button type="submit" className="primary-button" disabled={creating || uploading}>
                                    {creating ? '建立中...' : '建立行程'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
