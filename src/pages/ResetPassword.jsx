import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Lock, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import './ResetPassword.css'

export default function ResetPassword() {
    const navigate = useNavigate()

    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [updating, setUpdating] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        // Check if we have a valid session from the email link
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                setError('無效的重設連結或連結已過期，請重新申請')
            }
        })
    }, [])

    const handleResetPassword = async (e) => {
        e.preventDefault()
        setError('')

        // Validation
        if (newPassword.length < 6) {
            setError('密碼至少需要 6 個字元')
            return
        }

        if (newPassword !== confirmPassword) {
            setError('兩次輸入的密碼不一致')
            return
        }

        setUpdating(true)

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (error) throw error

            setSuccess(true)

            // Sign out and redirect to login after 2 seconds
            setTimeout(async () => {
                await supabase.auth.signOut()
                navigate('/auth')
            }, 2000)
        } catch (error) {
            console.error('Password update error:', error)
            setError('密碼更新失敗: ' + error.message)
        } finally {
            setUpdating(false)
        }
    }

    if (success) {
        return (
            <div className="reset-password-container">
                <div className="reset-password-card glass-panel">
                    <div className="success-icon">
                        <CheckCircle size={64} />
                    </div>
                    <h1>密碼更新成功！</h1>
                    <p>為了安全起見，請重新登入</p>
                </div>
            </div>
        )
    }

    return (
        <div className="reset-password-container">
            <div className="reset-password-card glass-panel">
                <div className="reset-header">
                    <Lock size={48} />
                    <h1>設定新密碼</h1>
                    <p>請輸入您的新密碼</p>
                </div>

                <form onSubmit={handleResetPassword}>
                    {error && (
                        <div className="error-message">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>新密碼 *</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="至少 6 個字元"
                            required
                            disabled={updating}
                        />
                    </div>

                    <div className="form-group">
                        <label>確認新密碼 *</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="再次輸入新密碼"
                            required
                            disabled={updating}
                        />
                    </div>

                    <button type="submit" className="primary-button" disabled={updating}>
                        {updating ? (
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

                <div className="reset-footer">
                    <small>⏱️ 連結將在 5 分鐘後失效</small>
                </div>
            </div>
        </div>
    )
}
