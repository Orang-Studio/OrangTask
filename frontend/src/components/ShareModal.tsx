import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, UserPlus, Trash2, Crown } from 'lucide-react'
import { useListMembers, useInviteMember, useRemoveMember, useUpdateMemberRole } from '../hooks/useLists'
import { Avatar } from './Avatar'
import { useAuthStore } from '../stores/auth'
import { useHaptics } from '../hooks/useHaptics'

interface Props {
  listId: string
  listName: string
  isOwner: boolean
  onClose: () => void
}

export function ShareModal({ listId, listName, isOwner, onClose }: Props) {
  const { data: members } = useListMembers(listId)
  const invite = useInviteMember()
  const removeMember = useRemoveMember()
  const updateRole = useUpdateMemberRole()
  const currentUser = useAuthStore((s) => s.user)
  const haptics = useHaptics()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [error, setError] = useState('')

  const handleLeave = async () => {
    if (!currentUser) return
    if (!confirm(`Leave "${listName}"? You'll lose access until you're invited again.`)) return
    await removeMember.mutateAsync({ listId, userId: currentUser.id })
    haptics.success()
    onClose()
    // navigate away the list is no longer accessible
    window.location.assign('/today')
  }

  const handleInvite = async () => {
    if (!email.trim()) return
    setError('')
    try {
      await invite.mutateAsync({ listId, email: email.trim(), role })
      haptics.success()
      setEmail('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invite')
      haptics.error()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-ink-850 border border-gray-200 dark:border-ink-600 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-ink-700">
          <h2 className="font-bold uppercase tracking-wide truncate">Share "{listName}"</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isOwner && (
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">Invite by email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                type="email"
                placeholder="teammate@example.com"
                className="input-field w-full"
              />
              <div className="flex gap-2 mt-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                  className="input-field !w-28 flex-shrink-0"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={invite.isPending}
                  className="btn-primary flex-1"
                >
                  <UserPlus size={16} className="mr-2" />
                  {invite.isPending ? 'Inviting...' : 'Invite'}
                </button>
              </div>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400 mb-2 block">Members</label>
            <div className="space-y-2">
              {members && members.filter((m) => m.role !== 'owner').length === 0 && (
                <p className="text-sm text-gray-400">Just you for now. Invite someone to collaborate.</p>
              )}
              {members?.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.name} url={m.avatar_url} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{m.name}</div>
                    <div className="text-xs text-gray-400 truncate">{m.email}</div>
                  </div>
                  {m.role === 'owner' ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 rounded">
                      <Crown size={12} /> Owner
                    </span>
                  ) : isOwner ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => {
                          haptics.tap()
                          updateRole.mutate({ listId, userId: m.id, role: e.target.value })
                        }}
                        className="input-field !w-24 !h-8 text-xs !py-0"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => removeMember.mutate({ listId, userId: m.id })}
                        className="text-gray-400 hover:text-red-500"
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-ink-700 rounded capitalize">{m.role}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!isOwner && (
            <div className="pt-2 border-t border-gray-200 dark:border-ink-700">
              <button
                onClick={handleLeave}
                disabled={removeMember.isPending}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 font-medium"
              >
                <Trash2 size={15} /> Leave list
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
