import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { AlertCircle, Save, Loader2, StickyNote } from 'lucide-react'
import './Notes.css'

export default function Notes({ userRole }) {
    const { id } = useParams()
    const [content, setContent] = useState('')
    const [noteId, setNoteId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const autoSaveTimer = useRef(null)

    useEffect(() => {
        fetchNotes()
        return () => clearTimeout(autoSaveTimer.current)
    }, [id])

    const fetchNotes = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('trip_notes')
                .select('*')
                .eq('trip_id', id)
                .single()

            if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows found

            if (data) {
                setContent(data.content || '')
                setNoteId(data.id)
            } else {
                setContent('')
                setNoteId(null)
            }
        } catch (err) {
            console.error('Error fetching notes:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (text) => {
        setSaving(true)
        setSaved(false)
        try {
            if (noteId) {
                // 更新現有記錄
                const { error } = await supabase
                    .from('trip_notes')
                    .update({ content: text, updated_at: new Date().toISOString() })
                    .eq('id', noteId)
                if (error) throw error
            } else {
                // 新增記錄
                const { data, error } = await supabase
                    .from('trip_notes')
                    .insert({ trip_id: id, content: text })
                    .select()
                    .single()
                if (error) throw error
                setNoteId(data.id)
            }
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error('Error saving notes:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleChange = (e) => {
        const text = e.target.value
        setContent(text)
        setSaved(false)

        // 自動儲存（輸入停止 1.5 秒後）
        clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = setTimeout(() => {
            handleSave(text)
        }, 1500)
    }

    const isReadOnly = userRole === 'viewer'

    if (loading) {
        return (
            <div className="notes-loading">
                <Loader2 className="animate-spin" size={24} />
            </div>
        )
    }

    return (
        <div className="notes-container">
            <div className="notes-header glass-panel">
                <div className="notes-title-row">
                    <StickyNote size={20} />
                    <h3>旅遊注意事項</h3>
                </div>
                <div className="notes-status">
                    {saving && (
                        <span className="saving-hint">
                            <Loader2 size={14} className="animate-spin" /> 儲存中...
                        </span>
                    )}
                    {saved && !saving && (
                        <span className="saved-hint">✅ 已儲存</span>
                    )}
                    {!isReadOnly && (
                        <button
                            className="save-btn"
                            onClick={() => handleSave(content)}
                            disabled={saving}
                        >
                            <Save size={16} />
                            立即儲存
                        </button>
                    )}
                </div>
            </div>

            {isReadOnly && (
                <div className="notes-readonly-badge">
                    <AlertCircle size={14} /> 您目前為觀看者，無法編輯
                </div>
            )}

            <div className="notes-editor glass-panel">
                <textarea
                    className="notes-textarea"
                    value={content}
                    onChange={handleChange}
                    placeholder={isReadOnly ? '目前沒有注意事項' : `在此輸入旅遊注意事項...\n\n例如：\n• 記得帶雨傘\n• 海關申報規定\n• 景點開放時間\n• 當地禁忌注意事項\n• 緊急聯絡資訊`}
                    readOnly={isReadOnly}
                    rows={20}
                />
            </div>
        </div>
    )
}
