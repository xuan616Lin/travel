import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeft, Loader2, AlertCircle, Mail, CheckCircle, Lock } from 'lucide-react'
import './Settings.css'

export default function Settings() {
    const { user } = useAuth()
    const navigate = useNavigate()

    // Email change state
    const [newEmail, setNewEmail] = useState('')
    const [emailPassword, setEmailPassword] = useState('')
    const [changingEmail, setChangingEmail] = useState(false)
    const [emailError, setEmailError] = useState('')
    const [emailSuccess, setEmailSuccess] = useState('')

    // 修改密碼 state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [changingPassword, setChangingPassword] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')

    // Delete account state
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const handleChangeEmail = async (e) => {
        e.preventDefault()
        setEmailError('')
        setEmailSuccess('')

        // Validation
        if (!newEmail || !newEmail.includes('@')) {
            setEmailError('請輸入有效的 Email 地址')
            return
        }

        if (!emailPassword) {
            setEmailError('請輸入目前密碼以驗證身份')
            return
        }

        setChangingEmail(true)

        try {
            // 1. Verify current password by re-authenticating
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: emailPassword
            })

            if (signInError) {
                setEmailError('密碼驗證失敗，請確認密碼是否正確')
                setChangingEmail(false)
                return
            }

            // 2. Update email (will send confirmation emails)
            const { error } = await supabase.auth.updateUser({
                email: newEmail
            })

            if (error) throw error

            setEmailSuccess('✅ 確認信已發送到新舊 Email 信箱，請在 5 分鐘內點擊信件中的連結完成變更。完成後請重新登入。')
            setNewEmail('')
            setEmailPassword('')

            // Force logout after 3 seconds to ensure user re-authenticates with new email
            setTimeout(async () => {
                await supabase.auth.signOut()
                navigate('/auth')
            }, 3000)
        } catch (error) {
            console.error('Email change error:', error)
            setEmailError('Email 更新失敗: ' + error.message)
        } finally {
            setChangingEmail(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPasswordError('')
        setPasswordSuccess('')

        if (newPassword.length < 6) {
            setPasswordError('新密碼至少需要 6 個字元')
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('両次輸入的新密碼不一致')
            return
        }

        setChangingPassword(true)
        try {
            // 1. 驗證目前密碼
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            })
            if (signInError) {
                setPasswordError('目前密碼驗證失敗，請確認是否正確')
                setChangingPassword(false)
                return
            }

            // 2. 更新新密碼
            const { error } = await supabase.auth.updateUser({ password: newPassword })
            if (error) throw error

            setPasswordSuccess('✅ 密碼已成功更新')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            setPasswordError('密碼更新失敗: ' + err.message)
        } finally {
            setChangingPassword(false)
        }
    }

    const handleDeleteAccount = async (e) => {
        e.preventDefault()

        // 驗證確認文字
        if (deleteConfirmText !== '刪除我的帳號') {
            alert('請輸入正確的確認文字：刪除我的帳號')
            return
        }

        // 最後確認
        if (!confirm('⚠️ 最後確認：此操作無法復原，您的所有資料（包括行程、清單、記帳、回憶錄）將永久刪除。確定要繼續嗎？')) {
            return
        }

        setDeleting(true)

        try {
            // 1. 驗證密碼
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: deletePassword
            })

            if (signInError) {
                alert('密碼驗證失敗，請確認密碼是否正確')
                setDeleting(false)
                return
            }

            // 2. 呼叫 delete_account RPC（會同時刪除 auth.users 和所有相關資料）
            const { error: rpcError } = await supabase.rpc('delete_account')

            if (rpcError) throw rpcError

            // 3. 登出並導向登入頁
            await supabase.auth.signOut()
            alert('✅ 帳號已完整刪除，感謝您的使用')
            navigate('/auth')

        } catch (error) {
            console.error('Delete error:', error)
            alert('刪除失敗: ' + error.message)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="settings-container">
            <div className="settings-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                    返回
                </button>
                <h1>帳號設定</h1>
            </div>

            <div className="settings-content glass-panel">
                {/* Account Info */}
                <div className="settings-section">
                    <h2>帳號資訊</h2>
                    <div className="info-row">
                        <span className="info-label">Email</span>
                        <span className="info-value">{user?.email}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">帳號建立時間</span>
                        <span className="info-value">
                            {user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-TW') : '未知'}
                        </span>
                    </div>
                </div>

                <div className="settings-divider" />

                {/* Change Email */}
                <div className="settings-section">
                    <h2>修改 Email</h2>
                    <p className="section-description">
                        修改 Email 需要密碼驗證，確認信將發送到新舊 Email 信箱（⏱️ 5 分鐘內有效）
                    </p>

                    <form onSubmit={handleChangeEmail}>
                        {emailError && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {emailError}
                            </div>
                        )}

                        {emailSuccess && (
                            <div className="success-message">
                                <CheckCircle size={16} />
                                {emailSuccess}
                            </div>
                        )}

                        <div className="form-group">
                            <label>新 Email *</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="輸入新的 Email 地址"
                                disabled={changingEmail}
                            />
                        </div>

                        <div className="form-group">
                            <label>目前密碼 *</label>
                            <input
                                type="password"
                                value={emailPassword}
                                onChange={(e) => setEmailPassword(e.target.value)}
                                placeholder="輸入密碼以驗證身份"
                                disabled={changingEmail}
                            />
                            <small className="form-hint">為了安全起見，需要驗證您的密碼</small>
                        </div>

                        <button type="submit" className="primary-button" disabled={changingEmail}>
                            {changingEmail ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    處理中...
                                </>
                            ) : (
                                <>
                                    <Mail size={20} />
                                    發送確認信
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="settings-divider" />

                {/* Change Password */}
                <div className="settings-section">
                    <h2>修改密碼</h2>
                    <p className="section-description">
                        輸入目前密碼及新密碼以完成變更
                    </p>

                    <form onSubmit={handleChangePassword}>
                        {passwordError && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {passwordError}
                            </div>
                        )}
                        {passwordSuccess && (
                            <div className="success-message">
                                <CheckCircle size={16} />
                                {passwordSuccess}
                            </div>
                        )}

                        <div className="form-group">
                            <label>目前密碼 *</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="輸入目前密碼"
                                disabled={changingPassword}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>新密碼 *</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="輸入新密碼（至少 6 字元）"
                                disabled={changingPassword}
                                required
                                minLength={6}
                            />
                        </div>

                        <div className="form-group">
                            <label>確認新密碼 *</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="再次輸入新密碼"
                                disabled={changingPassword}
                                required
                                minLength={6}
                            />
                        </div>

                        <button type="submit" className="primary-button" disabled={changingPassword}>
                            {changingPassword ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    更新中...
                                </>
                            ) : (
                                <>
                                    <Lock size={20} />
                                    更新密碼
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="settings-divider" />

                {/* Delete Account - Danger Zone */}
                <div className="settings-section danger-zone">
                    <h2>🚨 刪除帳號</h2>
                    <p className="section-description">
                        刪除帳號將永久移除您的所有資料，包括行程、清單、記帳、回憶錄等。此操作<strong>無法復原</strong>。
                    </p>

                    {!showDeleteConfirm ? (
                        <button
                            className="danger-toggle-btn"
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            我要刪除帳號
                        </button>
                    ) : (
                        <form onSubmit={handleDeleteAccount} className="delete-form">
                            <div className="form-group">
                                <label>輸入密碼確認身份 *</label>
                                <input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    placeholder="輸入您的密碼"
                                    required
                                    disabled={deleting}
                                />
                            </div>

                            <div className="form-group">
                                <label>輸入「刪除我的帳號」以確認 *</label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="刪除我的帳號"
                                    required
                                    disabled={deleting}
                                />
                                <small className="form-hint">請完整輸入上方文字以確認刪除</small>
                            </div>

                            <div className="delete-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => {
                                        setShowDeleteConfirm(false)
                                        setDeletePassword('')
                                        setDeleteConfirmText('')
                                    }}
                                    disabled={deleting}
                                >
                                    取消
                                </button>
                                <button type="submit" className="danger-button" disabled={deleting}>
                                    {deleting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            刪除中...
                                        </>
                                    ) : (
                                        '永久刪除帳號'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
