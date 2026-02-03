import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeft, Edit, Download, Save, X, Upload, Loader2, BookOpen, RefreshCw, Trash2, Calendar, Settings } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import UserMenu from '../components/UserMenu'
import Collaborators from '../components/Collaborators'
import './Memoir.css'

export default function Memoir({ tripId, tripData: initialTripData }) {
    const navigate = useNavigate()
    const { user } = useAuth()

    // Use props if available, otherwise might need internal state (but we expect props now)
    const [trip, setTrip] = useState(initialTripData || null)

    // If tripId is passed, use it. Otherwise try params (for backward compatibility or testing)
    const { id: paramId } = useParams()
    const id = tripId || paramId

    const [memoir, setMemoir] = useState(null)
    const [dailyJournals, setDailyJournals] = useState([])
    const [photos, setPhotos] = useState([])
    const [editMode, setEditMode] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [regenerating, setRegenerating] = useState(false)

    useEffect(() => {
        if (id) {
            fetchData()
        }
    }, [id])

    useEffect(() => {
        if (initialTripData) {
            setTrip(initialTripData)
        }
    }, [initialTripData])

    // --- Helper to Collect All Photos from Items ---
    const collectAllPhotos = async (items) => {
        if (!items || items.length === 0) return []
        const itemIds = items.map(i => i.id)

        // 1. Get Cover Images (from trip_items)
        const coverPhotos = items
            .filter(item => item.image_url)
            .map((item, index) => ({
                url: item.image_url,
                caption: item.title,
                order: index,
                source: 'cover',
                itemId: item.id
            }))

        // 2. Get Gallery Images (from trip_item_photos)
        const { data: galleryData, error } = await supabase
            .from('trip_item_photos')
            .select('*')
            .in('trip_item_id', itemIds)

        if (error) {
            console.error('Error fetching gallery photos:', error)
            return coverPhotos
        }

        const galleryPhotos = (galleryData || []).map((p, index) => ({
            url: p.url,
            caption: '',
            order: coverPhotos.length + index,
            source: 'gallery',
            itemId: p.trip_item_id
        }))

        // Merge and re-index
        return [...coverPhotos, ...galleryPhotos].map((p, i) => ({ ...p, order: i }))
    }

    // --- Helper to Generate Narrative Text ---
    const generateDailyNarrative = (dayItems, date) => {
        if (!dayItems || dayItems.length === 0) return '這天是自由活動時間，好好放鬆享受旅程！'

        const locations = dayItems
            .filter(i => i.type === 'activity' || i.type === 'food')
            .map(i => i.title)
            .filter(Boolean)

        if (locations.length === 0) return '今天主要在交通移動或休息。'

        // Simple narrative generation
        const locationStr = locations.join('、')
        return `今天我們去了 ${locationStr}。${dayItems[0]?.description || ''}`
    }

    const handleRegenerate = async () => {
        if (!window.confirm('確定要重新生成嗎？這會清除目前回憶錄中的所有照片與文字，並重新抓取行程資料。')) {
            return
        }

        setRegenerating(true)
        try {
            // 1. Fetch latest items
            const { data: itemsData } = await supabase
                .from('trip_items')
                .select('*')
                .eq('trip_id', id)
                .order('day_index')
                .order('start_time')

            if (!itemsData || itemsData.length === 0) {
                alert('行程中沒有任何項目')
                setPhotos([])
                setRegenerating(false)
                return
            }

            // 2. Collect ALL photos (Cover + Gallery)
            const allPhotos = await collectAllPhotos(itemsData)
            setPhotos(allPhotos)

            // 3. Regenerate Daily Journals
            // Group by day
            const daysMap = {}
            itemsData.forEach(item => {
                const day = item.day_index || 0
                if (!daysMap[day]) daysMap[day] = []
                daysMap[day].push(item)
            })

            const newJournals = Object.keys(daysMap).map(dayIndex => {
                const dIndex = parseInt(dayIndex)
                const dayItems = daysMap[dIndex]
                const itemDate = new Date(trip.start_date)
                itemDate.setDate(itemDate.getDate() + dIndex)

                return {
                    dayIndex: dIndex,
                    date: itemDate,
                    content: generateDailyNarrative(dayItems, itemDate),
                    items: dayItems
                }
            })
            // Sort by day index
            newJournals.sort((a, b) => a.dayIndex - b.dayIndex)
            setDailyJournals(newJournals)

            alert(`已重新生成！共找到 ${allPhotos.length} 張照片。請記得點擊「儲存」。`)

        } catch (error) {
            console.error('Error regenerating:', error)
            alert('重新生成失敗')
        } finally {
            setRegenerating(false)
        }
    }

    const fetchData = async () => {
        try {
            // 1. Fetch Trip Info ONLY if not provided
            let currentTrip = trip
            if (!currentTrip) {
                const { data: tripData, error: tripError } = await supabase
                    .from('trips')
                    .select(`
                      *,
                      owner:owner_id (email, full_name)
                    `)
                    .eq('id', id)
                    .single()

                if (tripError) throw tripError
                if (!tripData) {
                    console.error('Trip not found')
                    navigate('/')
                    return
                }
                setTrip(tripData)
                currentTrip = tripData
            }

            // 2. Fetch Items
            const { data: itemsDataRaw, error: itemsError } = await supabase
                .from('trip_items')
                .select('*')
                .eq('trip_id', id)
                .order('day_index')
                .order('start_time')

            if (itemsError) throw itemsError
            const itemsData = itemsDataRaw || []

            // Group Items by Day (for display even if memoir exists)
            const daysMap = {}
            itemsData.forEach(item => {
                const day = item.day_index || 0
                if (!daysMap[day]) daysMap[day] = []
                daysMap[day].push(item)
            })

            // 3. Fetch/Create Memoir
            let { data: memoirData, error: memoirError } = await supabase
                .from('trip_memories')
                .select('*')
                .eq('trip_id', id)
                .single()

            if (memoirError && memoirError.code !== 'PGRST116') throw memoirError

            // Generate "In-Memory" Journals
            const generatedJournals = Object.keys(daysMap).map(dayIndex => {
                const dIndex = parseInt(dayIndex)
                const dayItems = daysMap[dIndex]
                const itemDate = new Date(currentTrip.start_date)
                itemDate.setDate(itemDate.getDate() + dIndex)

                return {
                    dayIndex: dIndex,
                    date: itemDate,
                    content: generateDailyNarrative(dayItems, itemDate),
                    items: dayItems
                }
            }).sort((a, b) => a.dayIndex - b.dayIndex)

            setDailyJournals(generatedJournals)

            if (!memoirData) {
                // CREATE NEW MEMOIR (First Time)
                const initialPhotos = await collectAllPhotos(itemsData)

                const { data: newMemoir, error: insertError } = await supabase
                    .from('trip_memories')
                    .insert({
                        trip_id: id,
                        title: `${currentTrip.title} - 旅遊回憶`,
                        photos: initialPhotos
                    })
                    .select()
                    .single()

                if (insertError) throw insertError
                memoirData = newMemoir
            } else if (!memoirData.photos || memoirData.photos.length === 0) {
                // Auto-fix empty photos
                console.log('Memoir photos empty, attempting auto-fill...')
                const autoPhotos = await collectAllPhotos(itemsData)
                if (autoPhotos.length > 0) {
                    memoirData.photos = autoPhotos
                }
            }

            setMemoir(memoirData)
            setPhotos(memoirData?.photos || [])

        } catch (error) {
            console.error('Error fetching memoir:', error)
            // Just Alert but stop loading so UI shows
            alert(`載入失敗：${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return
        setUploading(true)
        try {
            const uploadedPhotos = []
            for (const file of files) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${id}/${Date.now()}_${Math.random()}.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('trip-gallery')
                    .upload(fileName, file)
                if (uploadError) throw uploadError
                const { data: { publicUrl } } = supabase.storage
                    .from('trip-gallery')
                    .getPublicUrl(fileName)
                uploadedPhotos.push({
                    url: publicUrl,
                    caption: '',
                    order: photos.length + uploadedPhotos.length,
                    source: 'upload'
                })
            }
            setPhotos([...photos, ...uploadedPhotos])
        } catch (error) {
            console.error('Error uploading:', error)
            alert('照片上傳失敗')
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('trip_memories')
                .update({
                    photos: photos,
                    title: memoir.title
                })
                .eq('id', memoir.id)

            if (error) throw error
            setEditMode(false)
            alert('儲存成功！')
        } catch (error) {
            console.error('Error saving:', error)
            alert('儲存失敗')
        } finally {
            setSaving(false)
        }
    }

    const handleExportPDF = async () => {
        setExporting(true)
        try {
            const element = document.getElementById('memoir-content')

            // Use html2canvas to capture the full element
            const canvas = await html2canvas(element, {
                scale: 2, // High quality
                useCORS: true,
                logging: false,
                backgroundColor: '#fffbf7', // Paper background
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            })

            const imgData = canvas.toDataURL('image/jpeg', 0.9) // JPEG for better compression
            const imgWidth = canvas.width
            const imgHeight = canvas.height

            // Initialize jsPDF with CUSTOM dimensions matching the image
            // orientation: portrait ('p')
            // unit: 'px' (pixels)
            // format: [width, height]
            const pdf = new jsPDF({
                orientation: imgWidth > imgHeight ? 'l' : 'p',
                unit: 'px',
                format: [imgWidth, imgHeight]
            })

            // Add image at 0,0 with full width and height
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)

            pdf.save(`${trip.title}-回憶錄.pdf`)
        } catch (error) {
            console.error('Export error:', error)
            alert('PDF 匯出失敗')
        } finally {
            setExporting(false)
        }
    }

    const handleDeletePhoto = (index) => {
        setPhotos(photos.filter((_, i) => i !== index))
    }

    const handleCaptionChange = (index, caption) => {
        const newPhotos = [...photos]
        newPhotos[index].caption = caption
        setPhotos(newPhotos)
    }

    if (loading) return <div className="memoir-loading"><Loader2 className="animate-spin" /> 載入中...</div>

    if (!trip || !memoir) {
        return (
            <div className="memoir-container">
                <div className="loading-state">
                    <p>找不到資料</p>
                </div>
            </div>
        )
    }

    return (
        <div className="memoir-page-root">
            {/* Toolbar */}
            <div className="memoir-toolbar-container">
                <div className="memoir-actions">
                    {editMode ? (
                        <>
                            <label className="upload-btn">
                                <Upload size={20} /> 加照片
                                <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} hidden disabled={uploading} />
                            </label>
                            <button className="secondary-button" onClick={handleRegenerate} disabled={regenerating}>
                                <RefreshCw size={20} /> 重置
                            </button>
                            <button className="primary-button" onClick={handleSave} disabled={saving}>
                                <Save size={20} /> 儲存
                            </button>
                            <button className="secondary-button" onClick={() => setEditMode(false)}>
                                <X size={20} /> 取消
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="secondary-button" onClick={() => setEditMode(true)}>
                                <Edit size={20} /> 編輯
                            </button>
                            <button className="primary-button" onClick={handleExportPDF} disabled={exporting}>
                                <Download size={20} /> 下載 PDF
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Paper Content */}
            <div className="memoir-container">
                <div id="memoir-content" className="memoir-paper">
                    {/* Paper Header */}
                    <div className="paper-header">
                        <div className="stamp-decoration">Travel</div>
                        {editMode ? (
                            <input
                                type="text"
                                className="title-input"
                                value={memoir?.title || ''}
                                onChange={(e) => setMemoir({ ...memoir, title: e.target.value })}
                            />
                        ) : (
                            <h1 className="paper-title">{memoir?.title}</h1>
                        )}
                        <div className="paper-meta">
                            <Calendar size={14} />
                            {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
                        </div>
                    </div>

                    {/* Daily Journal Section */}
                    <div className="journal-entries">
                        {dailyJournals.map((journal) => (
                            <div key={journal.dayIndex} className="journal-entry">
                                <div className="entry-date-label">Day {journal.dayIndex + 1}</div>
                                <div className="entry-content">
                                    <p>{journal.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Photo Collage Section */}
                    {photos.length > 0 && (
                        <div className="photo-collage-section">
                            {photos.map((photo, index) => (
                                <div key={index} className="collage-item">
                                    <div className="polaroid-frame">
                                        <img src={photo.url} alt="memoir" onError={(e) => e.target.src = 'https://via.placeholder.com/200?text=Error'} />
                                        {editMode ? (
                                            <div className="polaroid-caption-edit">
                                                <input
                                                    value={photo.caption || ''}
                                                    onChange={(e) => handleCaptionChange(index, e.target.value)}
                                                    placeholder="寫點什麼..."
                                                />
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeletePhoto(index)}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            photo.caption && <div className="polaroid-caption">{photo.caption}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {photos.length === 0 && !editMode && (
                        <div className="empty-state-hint">
                            尚無照片。點擊「編輯」並「重新生成」來抓取行程照片！
                        </div>
                    )}

                    <div className="paper-footer">
                        ~ The End ~
                    </div>
                </div>
            </div>
        </div>
    )
}
