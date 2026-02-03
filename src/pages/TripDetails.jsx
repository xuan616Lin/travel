import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Plus, MapPin, Truck, Utensils, Bed, ExternalLink, Pencil, Trash2, Image as ImageIcon, Camera, Loader2, X, DollarSign, Settings, List, CheckSquare, BookOpen } from 'lucide-react'
import { differenceInDays, addDays, format } from 'date-fns'
import Collaborators from '../components/Collaborators'
import UserMenu from '../components/UserMenu'
import Expenses from './Expenses'
import Checklist from './Checklist'
import Memoir from './Memoir' // Changed: Import Memoir
import './TripDetails.css'

export default function TripDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [trip, setTrip] = useState(null)
    const [items, setItems] = useState([])
    const [photos, setPhotos] = useState({}) // { itemId: [photo1, photo2] }
    const [collaborators, setCollaborators] = useState([]) // New state for passing to children

    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState(0)
    const [activeView, setActiveView] = useState('itinerary') // 'itinerary' | 'expenses' | 'checklist'

    // Trip Edit Modal
    const [showEditTripModal, setShowEditTripModal] = useState(false)
    const [tripEditData, setTripEditData] = useState({
        title: '',
        cover_image: '',
        cover_position: 'center',
        cover_display: 'cover'
    })
    const [tripSaving, setTripSaving] = useState(false)
    const [tripUploading, setTripUploading] = useState(false)

    // Item Modal State
    const [showModal, setShowModal] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [itemUploading, setItemUploading] = useState(false) // For cover image
    const [galleryUploading, setGalleryUploading] = useState(false) // For gallery
    const [formData, setFormData] = useState({
        id: null,
        type: 'activity',
        title: '',
        start_time: '',
        end_time: '',
        location_name: '',
        address: '',
        description: '',
        image_url: '',
        image_position: 'center',
        image_display: 'cover',
        day_index: 0,
        cost_amount: ''
    })

    // Generate Time Options (15 min intervals)
    const timeOptions = []
    for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 60; j += 15) {
            const hour = i.toString().padStart(2, '0')
            const minute = j.toString().padStart(2, '0')
            timeOptions.push(`${hour}:${minute}`)
        }
    }

    const [userRole, setUserRole] = useState(null) // 'owner', 'editor', 'viewer'

    useEffect(() => {
        if (id) {
            fetchTripDetails()
        }
    }, [id])

    const fetchTripDetails = async () => {
        setLoading(true)
        try {
            // 1. Fetch Trip Info & Owner
            const { data: tripData, error: tripError } = await supabase
                .from('trips')
                .select(`
                  *,
                  owner:owner_id (email, full_name)
                `)
                .eq('id', id)
                .single()

            if (tripError) throw tripError
            setTrip(tripData)
            setTripEditData({
                title: tripData.title,
                cover_image: tripData.cover_image,
                cover_position: tripData.cover_position || 'center',
                cover_display: tripData.cover_display || 'cover'
            })

            // 2. Fetch Collaborators (for permission check AND for children components)
            const { data: collabData, error: collabError } = await supabase
                .from('collaborators')
                .select(`
                    *,
                    profiles:user_id (full_name, email, avatar_url)
                `)
                .eq('trip_id', id)

            if (collabError) throw collabError

            setCollaborators(collabData || [])

            // Determine Role
            if (user?.id === tripData.owner_id) {
                setUserRole('owner')
            } else {
                const myCollabRecord = collabData?.find(c => c.user_id === user?.id)
                if (myCollabRecord) {
                    setUserRole(myCollabRecord.role)
                } else {
                    setUserRole(null)
                }
            }

            // 3. Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('trip_items')
                .select('*')
                .eq('trip_id', id)
                .order('day_index', { ascending: true })
                .order('start_time', { ascending: true })

            if (itemsError) throw itemsError
            setItems(itemsData)

            // 4. Fetch Photos
            const itemIds = itemsData.map(i => i.id)
            if (itemIds.length > 0) {
                const { data: photosData, error: photosError } = await supabase
                    .from('trip_item_photos')
                    .select('*')
                    .in('trip_item_id', itemIds)
                    .order('created_at', { ascending: false })

                if (photosError) throw photosError

                // Group by item_id
                const photosMap = {}
                photosData?.forEach(p => {
                    if (!photosMap[p.trip_item_id]) photosMap[p.trip_item_id] = []
                    photosMap[p.trip_item_id].push(p)
                })
                setPhotos(photosMap)
            }

        } catch (error) {
            console.error('Error fetching trip details:', error)
            alert('無法載入行程: ' + error.message)
            navigate('/')
        } finally {
            setLoading(false)
        }
    }

    // --- Image Upload Helpers ---
    const uploadImage = async (file, pathPrefix = 'items') => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${pathPrefix}/${id}/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('trip-covers') // Reuse existing bucket
            .upload(filePath, file)

        if (uploadError) {
            if (uploadError.statusCode === "404") {
                alert('上傳失敗：請檢查 Supabase Storage "trip-covers" bucket 是否存在且為 Public。')
            }
            throw uploadError
        }

        const { data } = supabase.storage.from('trip-covers').getPublicUrl(filePath)
        return data.publicUrl
    }

    const handleTripCoverUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            setTripUploading(true)
            const url = await uploadImage(file, 'headers')
            setTripEditData({ ...tripEditData, cover_image: url })
        } catch (error) {
            console.error(error)
            alert('上傳失敗')
        } finally {
            setTripUploading(false)
        }
    }

    const handleItemCoverUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            setItemUploading(true)
            const url = await uploadImage(file, 'items')
            setFormData({ ...formData, image_url: url })
        } catch (error) {
            console.error(error)
            alert('上傳失敗')
        } finally {
            setItemUploading(false)
        }
    }

    const handleGalleryUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (!formData.id || files.length === 0) return

        try {
            setGalleryUploading(true)
            const newPhotos = []

            for (const file of files) {
                const url = await uploadImage(file, `gallery/${formData.id}`)
                // Insert into DB immediately
                const { data, error } = await supabase.from('trip_item_photos').insert({
                    trip_item_id: formData.id,
                    url: url
                }).select().single()

                if (error) throw error
                newPhotos.push(data)
            }

            setPhotos(prev => ({
                ...prev,
                [formData.id]: [...(prev[formData.id] || []), ...newPhotos]
            }))

        } catch (error) {
            console.error(error)
            alert('部分照片上傳失敗')
        } finally {
            setGalleryUploading(false)
        }
    }

    const handleDeletePhoto = async (photoId, itemId) => {
        if (!confirm('確定刪除這張照片？')) return
        try {
            const { error } = await supabase.from('trip_item_photos').delete().eq('id', photoId)
            if (error) throw error
            setPhotos(prev => ({
                ...prev,
                [itemId]: prev[itemId].filter(p => p.id !== photoId)
            }))
        } catch (error) {
            alert('刪除失敗')
        }
    }

    // --- Trip Update ---
    const handleUpdateTrip = async (e) => {
        e.preventDefault()
        try {
            setTripSaving(true)
            const { error } = await supabase.from('trips').update({
                title: tripEditData.title,
                cover_image: tripEditData.cover_image,
                cover_position: tripEditData.cover_position,
                cover_display: tripEditData.cover_display
            }).eq('id', id)

            if (error) throw error
            setTrip({ ...trip, ...tripEditData })
            setShowEditTripModal(false)
        } catch (error) {
            alert('更新失敗: ' + error.message)
        } finally {
            setTripSaving(false)
        }
    }

    // --- Item CRUD ---
    const handleOpenModal = (item = null) => {
        if (item) {
            setIsEditing(true)
            setFormData({
                id: item.id,
                type: item.type,
                title: item.title,
                start_time: item.start_time || '',
                end_time: item.end_time || '',
                location_name: item.location_name || '',
                address: item.address || '',
                description: item.description || '',
                image_url: item.image_url || '',
                image_position: item.image_position || 'center',
                image_display: item.image_display || 'cover',
                day_index: item.day_index,
                cost_amount: item.cost_amount || ''
            })
        } else {
            setIsEditing(false)
            setFormData({
                id: null,
                type: 'activity',
                title: '',
                start_time: '',
                end_time: '',
                location_name: '',
                address: '',
                description: '',
                image_url: '',
                image_position: 'center',
                image_display: 'cover',
                day_index: selectedDay === -1 ? 0 : selectedDay,
                cost_amount: ''
            })
        }
        setShowModal(true)
    }

    const handleSaveItem = async (e) => {
        e.preventDefault()
        try {
            const itemPayload = {
                trip_id: id,
                title: formData.title,
                type: formData.type,
                day_index: formData.day_index,
                start_time: formData.start_time || null,
                end_time: formData.end_time || null,
                location_name: formData.location_name,
                address: formData.address,
                description: formData.description,
                image_url: formData.image_url,
                image_position: formData.image_position,
                image_display: formData.image_display,
                cost_amount: formData.cost_amount || null
            }

            if (isEditing) {
                const { data, error } = await supabase
                    .from('trip_items')
                    .update(itemPayload)
                    .eq('id', formData.id)
                    .select()
                if (error) throw error
                setItems(items.map(i => i.id === formData.id ? data[0] : i))
            } else {
                const { data, error } = await supabase
                    .from('trip_items')
                    .insert([itemPayload])
                    .select()
                if (error) throw error
                setItems([...items, ...data])
            }
            setShowModal(false)
        } catch (error) {
            console.error('Error saving item:', error)
            alert(error.message)
        }
    }

    const handleDeleteItem = async () => {
        if (!confirm('確定要刪除這個項目嗎？')) return
        try {
            const { error } = await supabase
                .from('trip_items')
                .delete()
                .eq('id', formData.id)

            if (error) throw error
            setItems(items.filter(i => i.id !== formData.id))
            setShowModal(false)
        } catch (error) {
            alert(error.message)
        }
    }

    const openMap = (location, address) => {
        const query = location || address
        if (!query) return
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
    }

    const getDaysArray = () => {
        if (!trip?.start_date || !trip?.end_date) return []
        const start = new Date(trip.start_date)
        const end = new Date(trip.end_date)
        const daysDiff = differenceInDays(end, start) + 1
        if (daysDiff < 0) return []
        return Array.from({ length: daysDiff }, (_, i) => ({
            index: i,
            date: addDays(start, i)
        }))
    }

    // Filter and Sort Items
    const filteredItems = (selectedDay === -1 ? items : items.filter(item => item.day_index === selectedDay))
        .sort((a, b) => {
            if (a.day_index !== b.day_index) return a.day_index - b.day_index
            if (!a.start_time) return 1
            if (!b.start_time) return -1
            return a.start_time.localeCompare(b.start_time)
        })

    if (loading) return <div className="loading-state">載入中...</div>

    return (
        <div className="trip-container">
            {/* Header Image */}
            <div
                className="trip-header"
                style={{
                    backgroundImage: `url(${trip?.cover_image})`,
                    backgroundPosition: trip?.cover_position || 'center',
                    backgroundSize: trip?.cover_display || 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: 'var(--bg-secondary)' // fallback color matches theme
                }}
            >
                <div className="trip-header-overlay">
                    <div className="header-top-row">
                        {/* Back Button */}
                        {/* Back Button */}
                        <button className="nav-btn back-btn" onClick={() => navigate('/')}>
                            <ArrowLeft size={24} color="white" strokeWidth={3} />
                        </button>

                        {/* Right side: User Menu + Settings */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', pointerEvents: 'auto' }}>
                            <UserMenu />
                            {(userRole === 'owner' || userRole === 'editor') && (
                                <button className="nav-btn settings-btn" onClick={() => setShowEditTripModal(true)} title="行程設定">
                                    <Settings size={22} color="white" strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bottom Section: Title & Collaborators */}
                    <div className="header-bottom-row" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                        <div className="trip-title-block">
                            <h1>{trip?.title}</h1>
                            <p>{trip?.start_date} ~ {trip?.end_date}</p>
                        </div>
                        <Collaborators tripId={id} ownerId={trip?.owner_id} currentUser={user} />
                    </div>
                </div>
            </div>

            <div className="trip-content">
                {/* 1. View Switcher (Itinerary / Expenses / Checklist) */}
                <div className="view-switcher-container">
                    <div className="nav-pill-tabs large">
                        <button
                            className={`nav-tab-btn ${activeView === 'itinerary' ? 'active' : ''}`}
                            onClick={() => setActiveView('itinerary')}
                        >
                            <List size={18} /> 行程表
                        </button>
                        <button
                            className={`nav-tab-btn ${activeView === 'checklist' ? 'active' : ''}`}
                            onClick={() => setActiveView('checklist')}
                        >
                            <CheckSquare size={18} /> 清單
                        </button>
                        <button
                            className={`nav-tab-btn ${activeView === 'expenses' ? 'active' : ''}`}
                            onClick={() => setActiveView('expenses')}
                        >
                            <DollarSign size={18} /> 記帳
                        </button>
                        <button
                            className={`nav-tab-btn ${activeView === 'memoir' ? 'active' : ''}`}
                            onClick={() => setActiveView('memoir')}
                        >
                            <BookOpen size={18} /> 回憶錄
                        </button>
                    </div>
                </div>

                {/* Content Switching */}
                {activeView === 'itinerary' && (
                    <>
                        {/* 2. Days Navigation Bar (Horizontal Scroll) */}
                        <div className="days-bar-container glass-panel">
                            <div className="days-scroll-wrapper">
                                <button
                                    className={`day-tab ${selectedDay === -1 ? 'active' : ''}`}
                                    onClick={() => setSelectedDay(-1)}
                                >
                                    全部
                                </button>
                                {getDaysArray().map(day => (
                                    <button
                                        key={day.index}
                                        className={`day-tab ${selectedDay === day.index ? 'active' : ''}`}
                                        onClick={() => setSelectedDay(day.index)}
                                    >
                                        <span>第 {day.index + 1} 天</span>
                                        <small>{format(day.date, 'MM/dd')}</small>
                                    </button>
                                ))}
                            </div>

                            {(userRole === 'owner' || userRole === 'editor') && (
                                <button className="add-activity-small-btn" onClick={() => handleOpenModal()}>
                                    <Plus size={16} /> 新增活動
                                </button>
                            )}
                        </div>

                        {/* Timeline Items */}
                        <div className="timeline-container">
                            <div className="timeline">
                                {filteredItems.length === 0 ? (
                                    <div className="empty-day">這天還沒有安排活動。</div>
                                ) : (
                                    filteredItems.map(item => (
                                        <div
                                            key={item.id}
                                            className="timeline-item glass-panel"
                                            onClick={() => handleOpenModal(item)}
                                        >
                                            {/* Main Row: Icon + Content (Left side on desktop) */}
                                            <div className="item-main-row">
                                                <div className={`item-icon type-${item.type}`}>
                                                    {item.type === 'transport' && <Truck size={20} />}
                                                    {item.type === 'food' && <Utensils size={20} />}
                                                    {item.type === 'lodging' && <Bed size={20} />}
                                                    {item.type === 'activity' && <MapPin size={20} />}
                                                </div>
                                                <div className="item-content">
                                                    <div className="item-header">
                                                        <span className="item-time">
                                                            {item.start_time ? item.start_time.slice(0, 5) : ''}
                                                            {item.start_time && item.end_time ? ' - ' : ''}
                                                            {item.end_time ? item.end_time.slice(0, 5) : ''}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            {photos[item.id]?.length > 0 && (
                                                                <span className="photo-indicator"><Camera size={14} /> {photos[item.id].length}</span>
                                                            )}
                                                            {(userRole === 'owner' || userRole === 'editor') && (
                                                                <button className="edit-hint-btn"><Pencil size={14} /></button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <h3 className="item-title">{item.title}</h3>

                                                    {(item.location_name || item.address) && (
                                                        <div className="item-location-row">
                                                            <div className="location-text">
                                                                {item.location_name && <span className="loc-name">{item.location_name}</span>}
                                                                {item.address && <span className="loc-addr">{item.address}</span>}
                                                            </div>
                                                            <button
                                                                className="map-btn"
                                                                onClick={(e) => { e.stopPropagation(); openMap(item.location_name, item.address) }}
                                                            >
                                                                <ExternalLink size={14} /> 地圖
                                                            </button>
                                                        </div>
                                                    )}

                                                    {item.description && <p className="item-desc">{item.description}</p>}
                                                </div>
                                            </div>

                                            {/* Right/Bottom Image Box */}
                                            {
                                                item.image_url && (
                                                    <div
                                                        className="item-right-image"
                                                        style={{
                                                            backgroundImage: `url(${item.image_url})`,
                                                            backgroundSize: item.image_display || 'cover',
                                                            backgroundPosition: 'center',
                                                            backgroundRepeat: 'no-repeat',
                                                            backgroundColor: 'rgba(0,0,0,0.05)'
                                                        }}
                                                    />
                                                )
                                            }
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeView === 'checklist' && (
                    <Checklist userRole={userRole} collaborators={collaborators} />
                )}

                {activeView === 'expenses' && (
                    <Expenses userRole={userRole} collaborators={collaborators} />
                )}

                {activeView === 'memoir' && (
                    <Memoir tripId={id} tripData={trip} />
                )}
            </div>

            {/* Edit Trip Modal */}
            {
                showEditTripModal && (
                    <div className="modal-overlay">
                        <div className="modal-content glass-panel">
                            <h2>編輯行程資訊</h2>
                            <form onSubmit={handleUpdateTrip}>
                                <div className="form-group">
                                    <label>行程標題</label>
                                    <input required value={tripEditData.title} onChange={e => setTripEditData({ ...tripEditData, title: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>封面圖片</label>
                                    <div className="image-input-group">
                                        <input type="file" accept="image/*" onChange={handleTripCoverUpload} id="trip-cover-upload" hidden />
                                        <label htmlFor="trip-cover-upload" className="upload-btn secondary-button">
                                            {tripUploading ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                                            {tripUploading ? '上傳中...' : '更換圖片'}
                                        </label>
                                        <span className="or-divider">或</span>
                                        <input
                                            value={tripEditData.cover_image}
                                            onChange={e => setTripEditData({ ...tripEditData, cover_image: e.target.value })}
                                            placeholder="圖片網址..."
                                            className="url-input"
                                        />
                                    </div>
                                    {tripEditData.cover_image && (
                                        <div
                                            className="image-preview"
                                            style={{
                                                backgroundImage: `url(${tripEditData.cover_image})`,
                                                backgroundPosition: tripEditData.cover_position,
                                                backgroundSize: tripEditData.cover_display,
                                                backgroundRepeat: 'no-repeat',
                                                backgroundColor: 'rgba(0,0,0,0.2)'
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Trip Image Options */}
                                <div className="form-group">
                                    <label>圖片顯示模式</label>
                                    <select
                                        value={tripEditData.cover_display}
                                        onChange={e => setTripEditData({ ...tripEditData, cover_display: e.target.value })}
                                    >
                                        <option value="cover">自動填滿 (裁切)</option>
                                        <option value="contain">完整顯示 (底色留白)</option>
                                    </select>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="secondary-button" onClick={() => setShowEditTripModal(false)}>取消</button>
                                    <button type="submit" className="primary-button" disabled={tripSaving}>儲存</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Add/Edit Item Modal */}
            {
                showModal && (
                    <div className="modal-overlay">
                        <div className="modal-content glass-panel">
                            <div className="modal-header">
                                <h2>{isEditing ? '編輯活動' : `新增活動至 第 ${(formData.day_index || 0) + 1} 天`}</h2>
                                {isEditing && (
                                    <button type="button" className="delete-text-btn" onClick={handleDeleteItem}>
                                        <Trash2 size={16} /> 刪除此項目
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleSaveItem}>
                                <div className="form-group">
                                    <label>類型</label>
                                    <div className="type-selector">
                                        {[
                                            { id: 'activity', label: '景點' },
                                            { id: 'transport', label: '交通' },
                                            { id: 'food', label: '美食' },
                                            { id: 'lodging', label: '住宿' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                className={`type-btn ${formData.type === t.id ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, type: t.id })}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>標題</label>
                                    <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="要做什麼？" />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>開始時間</label>
                                        <select value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })}>
                                            <option value="">-- 請選擇 --</option>
                                            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>結束時間</label>
                                        <select value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })}>
                                            <option value="">-- 請選擇 --</option>
                                            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>



                                <div className="form-group">
                                    <label>地點名稱</label>
                                    <input value={formData.location_name} onChange={e => setFormData({ ...formData, location_name: e.target.value })} placeholder="例如：台北101" />
                                </div>

                                <div className="form-group">
                                    <label>地址 (用於地圖導航)</label>
                                    <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="輸入完整地址..." />
                                </div>

                                <div className="form-group">
                                    <label>封面圖片 (顯示於卡片背景)</label>
                                    <div className="image-input-group">
                                        <input type="file" accept="image/*" onChange={handleItemCoverUpload} id="item-cover-upload" hidden />
                                        <label htmlFor="item-cover-upload" className="upload-btn secondary-button">
                                            {itemUploading ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                                            {itemUploading ? '上傳中...' : '上傳圖片'}
                                        </label>
                                        <input
                                            value={formData.image_url}
                                            onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                            placeholder="或輸入網址..."
                                            className="url-input"
                                        />
                                    </div>
                                    {/* Item Image Options - Only show if image exists */}
                                    {formData.image_url && (
                                        <>
                                            <div
                                                className="image-preview item-preview"
                                                style={{
                                                    backgroundImage: `url(${formData.image_url})`,
                                                    backgroundPosition: formData.image_position,
                                                    backgroundSize: formData.image_display,
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundColor: 'rgba(0,0,0,0.2)'
                                                }}
                                            />
                                            {/* Simplified Options: Only Display Mode */}
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <small style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>圖片縮放</small>
                                                <select
                                                    value={formData.image_display}
                                                    onChange={e => setFormData({ ...formData, image_display: e.target.value })}
                                                    style={{ fontSize: '0.85rem', padding: '0.4rem', width: '100%' }}
                                                >
                                                    <option value="cover">填滿 (Crop)</option>
                                                    <option value="contain">完整顯示 (Fit)</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Gallery Section */}
                                {isEditing ? (
                                    <div className="form-group gallery-section">
                                        <label>回憶相簿 (多張上傳)</label>
                                        <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} id="gallery-upload" hidden />
                                        <label htmlFor="gallery-upload" className="upload-btn secondary-button full-width">
                                            {galleryUploading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                                            {galleryUploading ? '上傳中...' : '新增相片'}
                                        </label>

                                        <div className="gallery-grid">
                                            {photos[formData.id]?.map(photo => (
                                                <div key={photo.id} className="gallery-thumbnail" style={{ backgroundImage: `url(${photo.url})` }}>
                                                    <button type="button" className="remove-photo-btn" onClick={() => handleDeletePhoto(photo.id, formData.id)}>
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="form-group gallery-section" style={{ opacity: 0.6 }}>
                                        <label>回憶相簿</label>
                                        <div className="empty-gallery-hint">
                                            <Camera size={20} />
                                            <span>請先儲存活動，即可上傳照片</span>
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>備註 / 營業時間</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
                                </div>

                                <div className="form-group">
                                    <label>第幾天</label>
                                    <select
                                        value={formData.day_index}
                                        onChange={e => setFormData({ ...formData, day_index: Number(e.target.value) })}
                                    >
                                        {getDaysArray().map(d => (
                                            <option key={d.index} value={d.index}>第 {d.index + 1} 天 ({format(d.date, 'MM/dd')})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>
                                        {(userRole === 'owner' || userRole === 'editor') ? '取消' : '關閉'}
                                    </button>
                                    {(userRole === 'owner' || userRole === 'editor') && (
                                        <button type="submit" className="primary-button">{isEditing ? '儲存變更' : '新增'}</button>
                                    )}
                                </div>
                            </form >
                        </div >
                    </div >
                )
            }
        </div>
    )
}
