import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeft, Camera, Loader2, Save } from 'lucide-react'
import './Profile.css'

export default function Profile() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const [fullName, setFullName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (user) {
            setFullName(user.user_metadata?.full_name || '')
            setAvatarUrl(user.user_metadata?.avatar_url || '')
        }
    }, [user])

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            setUploading(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}-${Math.random()}.${fileExt}`
            const filePath = `avatars/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('trip-covers')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from('trip-covers').getPublicUrl(filePath)
            setAvatarUrl(data.publicUrl)
        } catch (error) {
            console.error('Upload error:', error)
            alert('頭像上傳失敗')
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)

        try {
            // 1. Update auth user metadata
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    avatar_url: avatarUrl
                }
            })

            if (error) throw error

            // 2. Also update profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    avatar_url: avatarUrl
                })
                .eq('id', user.id)

            if (profileError) throw profileError

            // 3. Refresh the session to get updated user data
            await supabase.auth.refreshSession()

            alert('個人資料已更新！')

            // Optional: Navigate back after successful update
            setTimeout(() => navigate(-1), 500)
        } catch (error) {
            console.error('Save error:', error)
            alert('更新失敗: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="profile-container">
            <div className="profile-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                    返回
                </button>
                <h1>個人資料</h1>
            </div>

            <div className="profile-content glass-panel">
                <form onSubmit={handleSave}>
                    {/* Avatar Section */}
                    <div className="avatar-section">
                        <div className="avatar-preview">
                            <img
                                src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                                alt="Avatar"
                            />
                            <label htmlFor="avatar-upload" className="avatar-upload-btn">
                                {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                            </label>
                            <input
                                type="file"
                                id="avatar-upload"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                hidden
                            />
                        </div>
                        <p className="avatar-hint">點擊相機圖標更換頭像</p>
                    </div>

                    {/* Form Fields */}
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="disabled-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>暱稱 / 姓名</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="輸入您的名字"
                        />
                    </div>

                    <button type="submit" className="primary-button" disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                儲存中...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                儲存變更
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
