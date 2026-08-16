import { useEffect, useMemo, useRef, useState } from 'react'
import {
  NotebookPen, Plus, Trash2, Bold, Italic, Code, List, Heading, Strikethrough, Eye, Pencil,
} from 'lucide-react'
import { Scratchpad } from '../lib/api'
import { EmptyState } from '../components/EmptyState'
import { renderRichText } from '../lib/richText'
import { useScratchpads, useCreateScratchpad, useUpdateScratchpad, useDeleteScratchpad } from '../hooks/useScratchpads'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useHaptics } from '../hooks/useHaptics'
import { t, type MessageKey } from '../lib/i18n'

type Wrap = { before: string; after: string }

const FORMATS: { id: string; icon: typeof Bold; label: MessageKey; wrap: Wrap; line?: boolean }[] = [
  { id: 'bold', icon: Bold, label: 'scratchpads.bold' as MessageKey, wrap: { before: '**', after: '**' } },
  { id: 'italic', icon: Italic, label: 'scratchpads.italic' as MessageKey, wrap: { before: '*', after: '*' } },
  { id: 'strike', icon: Strikethrough, label: 'scratchpads.strikethrough' as MessageKey, wrap: { before: '~~', after: '~~' } },
  { id: 'code', icon: Code, label: 'scratchpads.code' as MessageKey, wrap: { before: '`', after: '`' } },
  { id: 'heading', icon: Heading, label: 'scratchpads.heading' as MessageKey, wrap: { before: '## ', after: '' }, line: true },
  { id: 'bullet', icon: List, label: 'scratchpads.bulletList' as MessageKey, wrap: { before: '- ', after: '' }, line: true },
]

export function ScratchpadsPage() {
  const { data: pads, isLoading } = useScratchpads()
  const createPad = useCreateScratchpad()
  const updatePad = useUpdateScratchpad()
  const deletePad = useDeleteScratchpad()
  const haptics = useHaptics()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selected = useMemo(
    () => pads?.find((p) => p.id === selectedId) ?? null,
    [pads, selectedId],
  )

  useEffect(() => {
    if (!pads || pads.length === 0) {
      setSelectedId(null)
      return
    }
    if (!pads.some((p) => p.id === selectedId)) setSelectedId(pads[0].id)
  }, [pads, selectedId])

  useEffect(() => {
    setTitle(selected?.title ?? '')
    setContent(selected?.content ?? '')
    setPreview(false)
  }, [selected?.id])

  const debouncedTitle = useDebouncedValue(title, 600)
  const debouncedContent = useDebouncedValue(content, 600)

  useEffect(() => {
    if (!selected) return
    if (debouncedTitle === selected.title && debouncedContent === selected.content) return
    updatePad.mutate({ id: selected.id, title: debouncedTitle, content: debouncedContent })
  }, [debouncedTitle, debouncedContent])

  const addPad = async () => {
    haptics.tap()
    const pad = await createPad.mutateAsync({ title: '', content: '' })
    setSelectedId(pad.id)
  }

  const removePad = async (pad: Scratchpad) => {
    if (!confirm(t('scratchpads.deleteConfirm' as MessageKey, { name: pad.title || t('scratchpads.untitled' as MessageKey) }))) return
    haptics.error()
    await deletePad.mutateAsync(pad.id)
  }

  const applyFormat = (wrap: Wrap, line?: boolean) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd

    if (line) {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1
      const next = `${content.slice(0, lineStart)}${wrap.before}${content.slice(lineStart)}`
      setContent(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + wrap.before.length, end + wrap.before.length)
      })
      return
    }

    const selectedText = content.slice(start, end)
    const next = `${content.slice(0, start)}${wrap.before}${selectedText}${wrap.after}${content.slice(end)}`
    setContent(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + wrap.before.length, end + wrap.before.length)
    })
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">{t('common.loading')}</div>
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      <div className="md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-ink-700 flex flex-col">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 dark:border-ink-700">
          <NotebookPen size={18} className="text-orange-500" />
          <h1 className="text-lg font-bold uppercase tracking-wide flex-1">{t('scratchpads.title' as MessageKey)}</h1>
          <button
            onClick={addPad}
            className="p-1.5 text-gray-400 hover:text-orange-500"
            aria-label={t('scratchpads.newNote' as MessageKey)}
            title={t('scratchpads.newNote' as MessageKey)}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-48 md:max-h-none">
          {pads?.map((pad) => (
            <div
              key={pad.id}
              className={`flex items-center gap-2 px-3 h-11 cursor-pointer transition-colors ${
                pad.id === selectedId
                  ? 'bg-orange-50 dark:bg-ink-750 text-orange-600 dark:text-orange-400'
                  : 'hover:bg-gray-50 dark:hover:bg-ink-750'
              }`}
              onClick={() => { haptics.tap(); setSelectedId(pad.id) }}
            >
              <span className="text-sm truncate flex-1">{pad.title || t('scratchpads.untitled' as MessageKey)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removePad(pad) }}
                className="text-gray-400 hover:text-red-500"
                aria-label={t('scratchpads.deleteNote' as MessageKey)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="max-w-2xl mx-auto w-full p-4 md:p-6 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('scratchpads.titlePlaceholder' as MessageKey)}
              className="input-field text-base font-medium"
            />

            <div className="flex items-center gap-1 flex-wrap">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => applyFormat(f.wrap, f.line)}
                  disabled={preview}
                  className="p-2 text-gray-500 dark:text-ink-300 hover:text-orange-500 disabled:opacity-40"
                  aria-label={t(f.label)}
                  title={t(f.label)}
                >
                  <f.icon size={16} />
                </button>
              ))}
              <button
                onClick={() => setPreview((v) => !v)}
                className="ml-auto btn-secondary text-sm inline-flex items-center gap-1.5"
              >
                {preview ? <Pencil size={14} /> : <Eye size={14} />}
                {preview ? t('scratchpads.edit' as MessageKey) : t('scratchpads.preview' as MessageKey)}
              </button>
            </div>

            {preview ? (
              <div className="surface p-4 min-h-[16rem] text-sm">
                {content.trim()
                  ? renderRichText(content)
                  : <span className="text-gray-400">{t('scratchpads.emptyNote' as MessageKey)}</span>}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('scratchpads.contentPlaceholder' as MessageKey)}
                className="input-field w-full min-h-[16rem] font-mono text-sm leading-relaxed"
                style={{ height: 'auto', minHeight: '16rem' }}
              />
            )}

            <p className="text-xs text-gray-400">{t('scratchpads.formattingHint' as MessageKey)}</p>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={NotebookPen}
              title={t('scratchpads.emptyTitle' as MessageKey)}
              description={t('scratchpads.emptyDescription' as MessageKey)}
            />
            <div className="flex justify-center">
              <button onClick={addPad} className="btn-primary">
                <Plus size={16} className="mr-2" /> {t('scratchpads.newNote' as MessageKey)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
