import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { User, Lock, Mail, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import './Auth.css'

export default function Auth() {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loginIdentifier, setLoginIdentifier] = useState('') // Can be email or username
    const [error, setError] = useState(null)

    // 忘記密碼
    const [forgotPassword, setForgotPassword] = useState(false)
    const [resetEmail, setResetEmail] = useState('')
    const [resetLoading, setResetLoading] = useState(false)
    const [resetMessage, setResetMessage] = useState('')
    const [resetError, setResetError] = useState('')

    const { signIn, signUp } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isLogin) {
                // Login Logic
                let loginEmail = loginIdentifier

                // If input is NOT an email (assuming username), try to fetch the email first
                if (!loginIdentifier.includes('@')) {
                    const { data, error: fetchError } = await supabase
                        .from('profiles')
                        .select('email')
                        .eq('full_name', loginIdentifier)
                        .single()

                    if (fetchError || !data) {
                        throw new Error('找不到此使用者名稱')
                    }
                    loginEmail = data.email
                }

                // Proceed with Supabase Auth using the resolved email
                const { error } = await signIn({ email: loginEmail, password })
                if (error) throw error
                navigate('/')

            } else {
                // Sign Up Logic
                // 1. Check if username exists first to give better feedback
                const { data: existingUser } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('full_name', username)
                    .single()

                if (existingUser) {
                    throw new Error('此暱稱已被使用')
                }

                // 2. Sign Up with Supabase Auth
                const { error } = await signUp({
                    email: email,
                    password,
                    options: {
                        data: {
                            full_name: username, // Initially set full name as username
                            username: username,  // Important for profile creation trigger
                            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
                        }
                    }
                })
                if (error) throw error

                // 3. Update profile with email (Trigger might safeguard this, but explicit update is safer for new column)
                // Note: The handle_new_user trigger usually inserts into profiles. 
                // We need to ensure the `email` column in `profiles` is also populated.
                // Depending on your trigger setup, run an update here just in case.
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    await supabase.from('profiles').update({ email: email }).eq('id', user.id)
                }

                alert('註冊成功！')
                navigate('/')
            }
        } catch (error) {
            console.error(error)
            if (error.message.includes('Invalid login credentials')) {
                setError('帳號或密碼錯誤')
            } else if (error.message.includes('User already registered')) {
                setError('此 Email 已被註冊')
            } else {
                setError(error.message || '發生錯誤，請稍後再試')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleForgotPassword = async (e) => {
        e.preventDefault()
        setResetError('')
        setResetMessage('')
        setResetLoading(true)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/reset-password`
            })
            if (error) throw error
            setResetMessage('✅ 密碼重設信已發送，請在 5 分鐘內查收並完成重設')
            setResetEmail('')
        } catch (err) {
            setResetError('發送失敗：' + err.message)
        } finally {
            setResetLoading(false)
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card glass-panel">
                <h2 className="auth-title gradient-text">
                    {forgotPassword ? '重設密碼' : (isLogin ? 'Welcome Back' : 'Create Account')}
                </h2>
                <p className="auth-subtitle">
                    {forgotPassword ? '輸入您的 Email，我們將發送重設連結' : (isLogin ? '以 Email 或 暱稱 登入' : '使用 Email 註冊帳號')}
                </p>

                {/* 忘記密碼模式 */}
                {forgotPassword ? (
                    <div className="forgot-password-section">
                        {resetError && (
                            <div className="auth-error">{resetError}</div>
                        )}
                        {resetMessage ? (
                            <div className="auth-success">
                                <CheckCircle size={20} />
                                {resetMessage}
                            </div>
                        ) : (
                            <form onSubmit={handleForgotPassword} className="auth-form">
                                <div className="input-group">
                                    <Mail className="input-icon" size={20} />
                                    <input
                                        type="email"
                                        placeholder="輸入您的 Email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <button type="submit" className="auth-button" disabled={resetLoading}>
                                    {resetLoading ? <Loader2 className="animate-spin" /> : '發送重設信'}
                                </button>
                            </form>
                        )}
                        <div className="auth-footer">
                            <p>
                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => {
                                        setForgotPassword(false)
                                        setResetEmail('')
                                        setResetMessage('')
                                        setResetError('')
                                    }}
                                >
                                    ← 返回登入
                                </button>
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {error && <div className="auth-error">{error}</div>}

                        {/* Warning for password retention */}
                        <div className="warning-box" style={{
                            fontSize: '0.85rem',
                            color: '#fbbf24',
                            background: 'rgba(251, 191, 36, 0.1)',
                            padding: '0.8rem',
                            marginBottom: '1rem',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'start',
                            lineHeight: '1.4'
                        }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '3px' }} />
                            <span>請妥善保管您的密碼。</span>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">
                            {isLogin ? (
                                <div className="input-group">
                                    <User className="input-icon" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Email 或 暱稱"
                                        value={loginIdentifier}
                                        onChange={(e) => setLoginIdentifier(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="input-group">
                                        <Mail className="input-icon" size={20} />
                                        <input
                                            type="email"
                                            placeholder="Gmail / Email Address"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <User className="input-icon" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Username (暱稱 - 唯一識別)"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            required
                                            pattern="[a-zA-Z0-9_\-\u4e00-\u9fa5]+"
                                            title="可以使用中文、英文、數字"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="input-group">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>

                            <button type="submit" className="auth-button" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : (isLogin ? '登入' : '註冊')}
                            </button>
                        </form>

                        <div className="auth-footer">
                            {isLogin && (
                                <p>
                                    <button
                                        type="button"
                                        className="link-button"
                                        onClick={() => {
                                            setForgotPassword(true)
                                            setError(null)
                                        }}
                                    >
                                        忘記密碼？
                                    </button>
                                </p>
                            )}
                            <p>
                                {isLogin ? "沒有帳號嗎？" : "已有帳號？"}
                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => {
                                        setIsLogin(!isLogin)
                                        setError(null)
                                        setUsername('')
                                        setPassword('')
                                        setEmail('')
                                    }}
                                >
                                    {isLogin ? '去註冊' : '去登入'}
                                </button>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
