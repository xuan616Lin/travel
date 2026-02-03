import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Users, UserPlus, X, Shield, ShieldAlert, ChevronDown } from 'lucide-react'
import './Collaborators.css'

export default function Collaborators({ tripId, ownerId, currentUser }) {
    const [collaborators, setCollaborators] = useState([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('editor') // 'editor' | 'viewer'
    const [loading, setLoading] = useState(false)
    const [showInviteForm, setShowInviteForm] = useState(false)

    const isOwner = currentUser?.id === ownerId
    const [currentUserRole, setCurrentUserRole] = useState(null)
    const [openActionsId, setOpenActionsId] = useState(null) // Track which member's actions are open

    useEffect(() => {
        if (collaborators.length > 0 && currentUser) {
            const me = collaborators.find(c => c.user_id === currentUser.id)
            setCurrentUserRole(me?.role || null)
        }
    }, [collaborators, currentUser])

    const canManage = isOwner || currentUserRole === 'editor'

    useEffect(() => {
        if (tripId) fetchCollaborators()
    }, [tripId])

    const fetchCollaborators = async () => {
        try {
            const { data, error } = await supabase
                .from('collaborators')
                .select(`
                    *,
                    profiles:user_id (full_name, email, avatar_url)
                `)
                .eq('trip_id', tripId)

            if (error) throw error
            setCollaborators(data || [])
        } catch (error) {
            console.error('Error fetching collaborators:', error)
        }
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            // 1. Find user by Email
            const { data: user, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', inviteEmail)
                .single()

            if (userError || !user) {
                alert('找不到此 Email 的使用者，請確認對方已註冊。')
                setLoading(false)
                return
            }

            // 2. Add as collaborator
            const { data, error: inviteError } = await supabase
                .from('collaborators')
                .insert([{
                    trip_id: tripId,
                    user_id: user.id,
                    role: inviteRole
                }])
                .select(`
                    *,
                    profiles:user_id (full_name, email, avatar_url)
                `)
                .single()

            if (inviteError) {
                if (inviteError.code === '23505') alert('該使用者已經是協作者了。')
                else throw inviteError
            } else {
                setCollaborators([...collaborators, data])
                setInviteEmail('')
                setShowInviteForm(false)
                alert('邀請成功！')
            }

        } catch (error) {
            console.error(error)
            alert('邀請失敗: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRoleChange = async (userId, newRole) => {
        try {
            const { error } = await supabase
                .from('collaborators')
                .update({ role: newRole })
                .eq('trip_id', tripId)
                .eq('user_id', userId)

            if (error) throw error

            setCollaborators(collaborators.map(c =>
                c.user_id === userId ? { ...c, role: newRole } : c
            ))
        } catch (error) {
            alert('權限修改失敗')
        }
    }

    const removeCollaborator = async (userId) => {
        if (!confirm('確定要移除這位協作者嗎？')) return
        try {
            const { error } = await supabase
                .from('collaborators')
                .delete()
                .eq('trip_id', tripId)
                .eq('user_id', userId)

            if (error) throw error
            setCollaborators(collaborators.filter(c => c.user_id !== userId))
        } catch (error) {
            alert(error.message)
        }
    }

    return (
        <div className="collaborators-section">
            <div className="members-list">
                {/* Show all members except current user */}
                {collaborators
                    .filter(c => c.user_id !== currentUser?.id) // Exclude current user, show everyone else
                    .map(c => (
                        <div key={c.id} className="member-avatar-wrapper">
                            <div
                                className="member-avatar"
                                title={`${c.profiles.full_name || 'User'} (${c.role === 'editor' ? '編輯者' : '檢視者'})`}
                                onClick={() => {
                                    console.log('Avatar clicked! isOwner:', isOwner, 'c.id:', c.id)
                                    if (isOwner) {
                                        setOpenActionsId(openActionsId === c.id ? null : c.id)
                                    }
                                }}
                                style={{ cursor: isOwner ? 'pointer' : 'default' }}
                            >
                                <img
                                    src={c.profiles.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profiles.email}`}
                                    alt="Avatar"
                                    style={{ border: c.role === 'editor' ? '2px solid var(--primary)' : '2px solid var(--text-secondary)' }}
                                />
                                {/* Role Badge */}
                                <span className={`role-badge ${c.role}`}>
                                    {c.role === 'editor' ? <ShieldAlert size={10} /> : <Shield size={10} />}
                                </span>
                            </div>
                            {/* Display Name Below Avatar */}
                            <span className="member-name">
                                {c.profiles.full_name || c.profiles.email?.split('@')[0] || 'User'}
                            </span>

                            {/* Dropdown for Owner to managing roles - Show when clicked */}
                            {isOwner && openActionsId === c.id && (
                                <>
                                    <div className="actions-backdrop" onClick={() => setOpenActionsId(null)} />
                                    <div className="member-actions">
                                        <select
                                            className="role-select"
                                            value={c.role}
                                            onChange={(e) => handleRoleChange(c.user_id, e.target.value)}
                                        >
                                            <option value="editor">編輯</option>
                                            <option value="viewer">檢視</option>
                                        </select>
                                        <button className="remove-btn" onClick={() => removeCollaborator(c.user_id)}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                {/* Invite Button - Always visible for owners/editors */}
                {canManage && (
                    <div className="invite-wrapper">
                        <button
                            className={`invite-btn ${showInviteForm ? 'active' : ''}`}
                            onClick={() => {
                                console.log('Invite button clicked, canManage:', canManage)
                                setShowInviteForm(!showInviteForm)
                            }}
                            title="邀請協作者"
                        >
                            <UserPlus size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Invite Form Popover */}
            {canManage && showInviteForm && (
                <form onSubmit={handleInvite} className="invite-form glass-panel">
                    <div className="invite-row">
                        <input
                            type="email"
                            placeholder="輸入對方 Email"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            autoFocus
                            required
                        />
                        <select
                            value={inviteRole}
                            onChange={e => setInviteRole(e.target.value)}
                            className="role-select-initial"
                        >
                            <option value="editor">編輯者</option>
                            <option value="viewer">檢視者</option>
                        </select>
                    </div>
                    <div className="invite-actions">
                        <button type="button" className="cancel-btn" onClick={() => setShowInviteForm(false)}>取消</button>
                        <button type="submit" disabled={loading} className="confirm-btn">
                            {loading ? '...' : '發送邀請'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}
