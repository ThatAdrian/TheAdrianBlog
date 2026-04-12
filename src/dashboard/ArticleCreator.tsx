import React, { useState, useRef } from 'react'
import { commitFile, uploadImage, slugify } from './github'

type BlockType = 'heading' | 'subheading' | 'paragraph' | 'quote' | 'image' | 'divider'

interface Block {
  id: string
  type: BlockType
  content: string
  imageUrl?: string
  imageLocalUrl?: string
  imageCaption?: string
  imageFile?: File
}

function uid() { return Math.random().toString(36).slice(2, 9) }

function blockToMarkdown(block: Block, postSlug: string): string {
  switch (block.type) {
    case 'heading':    return `## ${block.content}`
    case 'subheading': return `### ${block.content}`
    case 'paragraph':  return block.content
    case 'quote':      return block.content.split('\n').map(l => `> ${l}`).join('\n')
    case 'divider':    return '---'
    case 'image': {
      const src = block.imageUrl || (block.imageFile ? `posts/${postSlug}-${block.id}.jpg` : '')
      const img = src ? `![${block.imageCaption || ''}](${src})` : '[image pending upload]'
      return block.imageCaption ? `${img}\n*${block.imageCaption}*` : img
    }
    default: return block.content
  }
}

function BlockCard({ block, index, total, onChange, onDelete, onMove, onImageDrop, onDragStart, onDragOver, onDrop, isDragging }: {
  block: Block; index: number; total: number
  onChange: (id: string, data: Partial<Block>) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onImageDrop: (id: string, file: File) => void
  onDragStart: (id: string) => void
  onDragOver: (index: number) => void
  onDrop: (index: number) => void
  isDragging: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onImageDrop(block.id, file)
  }

  return (
    <div
      className={`db-block ${isDragging ? 'dragging' : ''}`}
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(block.id) }}
      onDragOver={e => { e.preventDefault(); onDragOver(index) }}
      onDrop={e => { e.preventDefault(); onDrop(index) }}
    >
      <div className="db-block-header">
        <span className="db-block-drag" title="Drag to reorder">⠿</span>
        <span className="db-block-type">{block.type}</span>
        <div className="db-block-actions">
          <button onClick={() => onMove(block.id, -1)} disabled={index === 0} className="db-icon-btn" title="Move up">↑</button>
          <button onClick={() => onMove(block.id, 1)} disabled={index === total - 1} className="db-icon-btn" title="Move down">↓</button>
          <button onClick={() => onDelete(block.id)} className="db-icon-btn db-icon-btn--danger" title="Delete">✕</button>
        </div>
      </div>

      {block.type === 'divider' && (
        <div className="db-divider-preview">— divider —</div>
      )}

      {block.type === 'image' && (
        <div className="db-image-block">
          {block.imageLocalUrl || block.imageUrl ? (
            <div className="db-block-img-wrap">
              <img src={block.imageLocalUrl || block.imageUrl} alt="" className="db-block-img" />
              <button className="db-art-change" onClick={() => fileRef.current?.click()}>Change image</button>
            </div>
          ) : (
            <div className="db-image-drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              onDrop={handleFileDrop}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:'8px',opacity:0.4}}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>Drop image here or click to upload</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
            onChange={e => { const f = e.target.files?.[0]; if (f) onImageDrop(block.id, f) }} />
          <input className="db-input db-input--sm" placeholder="Caption (optional)"
            value={block.imageCaption || ''} onChange={e => onChange(block.id, { imageCaption: e.target.value })} />
        </div>
      )}

      {block.type === 'paragraph' && (
        <textarea className="db-textarea" rows={4} value={block.content}
          placeholder="Write paragraph text..."
          onChange={e => onChange(block.id, { content: e.target.value })} />
      )}

      {(block.type === 'heading' || block.type === 'subheading') && (
        <input className="db-input" value={block.content}
          placeholder={`${block.type === 'heading' ? 'Heading' : 'Subheading'} text...`}
          onChange={e => onChange(block.id, { content: e.target.value })} />
      )}

      {block.type === 'quote' && (
        <textarea className="db-textarea" rows={2} value={block.content}
          placeholder="Quote text..."
          onChange={e => onChange(block.id, { content: e.target.value })} />
      )}
    </div>
  )
}

export default function ArticleCreator() {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('Tech')
  const [blocks, setBlocks] = useState<Block[]>([{ id: uid(), type: 'paragraph', content: '' }])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragTarget, setDragTarget] = useState<number | null>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  function addBlock(type: BlockType) {
    setBlocks(b => [...b, { id: uid(), type, content: '' }])
  }

  function updateBlock(id: string, data: Partial<Block>) {
    setBlocks(b => b.map(bl => bl.id === id ? { ...bl, ...data } : bl))
  }

  function deleteBlock(id: string) {
    setBlocks(b => b.filter(bl => bl.id !== id))
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks(b => {
      const idx = b.findIndex(bl => bl.id === id)
      if (idx + dir < 0 || idx + dir >= b.length) return b
      const next = [...b]
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })
  }

  function handleImageDrop(blockId: string, file: File) {
    updateBlock(blockId, { imageLocalUrl: URL.createObjectURL(file), imageFile: file })
  }

  function onDrop(targetIndex: number) {
    if (!draggingId) return
    const fromIndex = blocks.findIndex(b => b.id === draggingId)
    if (fromIndex === targetIndex) { setDraggingId(null); return }
    const next = [...blocks]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(targetIndex, 0, moved)
    setBlocks(next)
    setDraggingId(null)
    setDragTarget(null)
  }

  function onCoverDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)) }
  }

  const postSlug = slugify(title || 'article')

  function generateMarkdown(): string {
    const today = new Date()
    const date = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`
    const body = blocks.map(b => blockToMarkdown(b, postSlug)).join('\n\n')
    return `---
date: ${date}
title: "${title}"
summary: '${summary}'
categories:
  - ${category}
image: posts/${postSlug}.jpg
draft: false
---

${body}
`
  }

  async function publish() {
    if (!title.trim()) { setError('Title is required'); return }
    setPublishing(true)
    setError('')
    try {
      // Upload cover
      if (coverFile) {
        const b64 = await fileToBase64(coverFile)
        await uploadImage(`public/posts/${postSlug}.jpg`, b64)
      }

      // Upload block images
      for (const block of blocks) {
        if (block.type === 'image' && block.imageFile) {
          const b64 = await fileToBase64(block.imageFile)
          const path = `public/posts/${postSlug}-${block.id}.jpg`
          await uploadImage(path, b64)
        }
      }

      const ok = await commitFile(`content/posts/${postSlug}.md`, generateMarkdown(), `Add post: ${title}`)
      if (ok) setPublished(true)
      else setError('GitHub commit failed — check token permissions.')
    } catch {
      setError('Publish failed.')
    }
    setPublishing(false)
  }

  return (
    <div className="db-section">
      <h2 className="db-section-title">New Article</h2>

      <div className="db-card">
        <label className="db-label">Title</label>
        <input className="db-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title..." />
        <label className="db-label" style={{marginTop:'0.75rem'}}>Summary</label>
        <input className="db-input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="One-line summary for the card..." />
        <label className="db-label" style={{marginTop:'0.75rem'}}>Category</label>
        <select className="db-select" value={category} onChange={e => setCategory(e.target.value)}>
          <option>Tech</option>
          <option>General</option>
        </select>
      </div>

      <div className="db-card">
        <label className="db-label">Cover Image</label>
        {coverPreview ? (
          <div className="db-cover-wrap">
            <img src={coverPreview} alt="Cover" className="db-cover-preview" />
            <button className="db-btn" onClick={() => coverRef.current?.click()}>Change</button>
          </div>
        ) : (
          <div className="db-image-drop"
            onClick={() => coverRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={onCoverDrop}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:'8px',opacity:0.4}}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>Drop cover image here or click to upload</span>
          </div>
        )}
        <input ref={coverRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={e => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)) } }} />
      </div>

      <div className="db-blocks">
        {blocks.map((block, i) => (
          <BlockCard key={block.id} block={block} index={i} total={blocks.length}
            onChange={updateBlock} onDelete={deleteBlock} onMove={moveBlock}
            onImageDrop={handleImageDrop}
            onDragStart={setDraggingId}
            onDragOver={setDragTarget}
            onDrop={onDrop}
            isDragging={draggingId === block.id}
          />
        ))}
      </div>

      <div className="db-add-blocks">
        <span className="db-add-label">Add block:</span>
        {(['heading','subheading','paragraph','quote','image','divider'] as BlockType[]).map(type => (
          <button key={type} className="db-btn db-btn--block" onClick={() => addBlock(type)}>{type}</button>
        ))}
      </div>

      <div className="db-card">
        <label className="db-label">Generated Markdown</label>
        <pre className="db-preview">{generateMarkdown()}</pre>
      </div>

      <div className="db-publish-row">
        {published ? (
          <div className="db-success">✓ Published! Deploying in ~1 minute.</div>
        ) : (
          <button className="db-btn db-btn--publish" onClick={publish} disabled={publishing}>
            {publishing ? 'Publishing...' : 'Publish Article'}
          </button>
        )}
        {error && <p className="db-error">{error}</p>}
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(file)
  })
}
