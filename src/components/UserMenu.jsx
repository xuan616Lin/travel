import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { User, Settings, LogOut, ChevronDown } from 'lucide-react'
import './UserMenu.css'

export default function UserMenu() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [showMenu, setShowMenu] = useState(false)

    const handleSignOut = async () => {
        await signOut()
        navigate('/auth')
    }

    return (
        <div className="user-menu-container">
            <button
                className="user-avatar-btn"
                onClick={() => setShowMenu(!showMenu)}
                title={user?.email}
            >
                <img
                    src={user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                    alt="User Avatar"
                />
            </button>

            {showMenu && (
                <>
                    <div className="menu-backdrop" onClick={() => setShowMenu(false)} />
                    <div className="user-dropdown glass-panel">
                        <div className="user-info">
                            <img
                                src={user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                                alt="Avatar"
                                className="dropdown-avatar"
                            />
                            <div className="user-details">
                                <p className="user-name">{user?.user_metadata?.full_name || '使用者'}</p>
                                <p className="user-email">{user?.email}</p>
                            </div>
                        </div>

                        <div className="menu-divider" />

                        <button className="menu-item" onClick={() => {
                            setShowMenu(false)
                            navigate('/profile')
                        }}>
                            <User size={16} />
                            <span>個人資料</span>
                        </button>

                        <button className="menu-item" onClick={() => {
                            setShowMenu(false)
                            navigate('/settings')
                        }}>
                            <Settings size={16} />
                            <span>帳號設定</span>
                        </button>

                        <div className="menu-divider" />

                        <button className="menu-item danger" onClick={handleSignOut}>
                            <LogOut size={16} />
                            <span>登出</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
