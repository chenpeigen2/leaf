import { useState } from 'react'

interface OverlayProps {
  className?: string
  immersive: boolean
  hintShown: boolean
  name: string
  message: string
  submitted: boolean
  soundOn: boolean
  onNameChange: (value: string) => void
  onMessageChange: (value: string) => void
  onSubmit: () => void
  onToggleSound: () => void
  onToggleImmersive: () => void
  onReveal: () => void
  onReset: () => void
}

const DEFAULT_MESSAGE = '今天的银杏很黄，想和你一起捡一片。'
const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const area = document.createElement('textarea')
    area.value = value
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
  }
}

export function Overlay({
  className = '',
  immersive,
  hintShown,
  name,
  message,
  submitted,
  soundOn,
  onNameChange,
  onMessageChange,
  onSubmit,
  onToggleSound,
  onToggleImmersive,
  onReveal,
  onReset,
}: OverlayProps) {
  const [copied, setCopied] = useState<'text' | null>(null)

  const letter = `秋天的银杏很黄，风一吹就落了一地。\n${name ? `${name}，` : ''}${message || DEFAULT_MESSAGE}\n—— 这片叶子送给你。`
  const link = window.location.href

  const flash = (what: 'text') => {
    setCopied(what)
    window.setTimeout(() => setCopied(null), 2400)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: '一片银杏', text: letter, url: link })
        return
      } catch {
        /* the sheet was closed, fall back to copying */
      }
    }
    await copyText(`${letter}\n${link}`)
    flash('text')
  }

  const handleCopyText = async () => {
    await copyText(letter)
    flash('text')
  }

  return (
    <div className={`overlay ${className} ${immersive ? 'overlay--immersive' : ''}`}>
      {immersive ? (
        /*
         * Default state: no panels, no instructions, just the tree and the sky.
         * Only a small sound switch and one quiet invitation remain.
         */
        <>
          <div className="immersive-toolbar">
            <button type="button" className="ghost" onClick={onToggleSound}>
              {soundOn ? '🔊' : '🔈'}
            </button>
          </div>

          <div className={`immersive-invite ${hintShown ? 'immersive-invite--shown' : ''}`}>
            <p className="immersive-line">
              {submitted ? (
                <>
                  <span className="immersive-name">{name ? `${name}，` : ''}</span>
                  {message || DEFAULT_MESSAGE}
                </>
              ) : (
                '风一吹，落叶就替我把话说了。'
              )}
            </p>
            <div className="immersive-actions">
              <button type="button" className="ink-button" onClick={onReveal}>
                {submitted ? '回一句' : '写一句话'}
              </button>
              {submitted && (
                <button type="button" className="ink-button ink-button--solid" onClick={handleShare}>
                  把这片叶子发给 TA
                </button>
              )}
            </div>
            <p className="immersive-hint">
              {submitted
                ? isTouch
                  ? '链接里已经藏好了这句话'
                  : '链接里已经藏好了这句话 · Esc 回到这片秋天'
                : '拖动换角度 · 轻点树冠会落一场金色的雨'}
            </p>
          </div>
        </>
      ) : (
        <>
          <header className="masthead">
            <p className="eyebrow">秋 · 十一月的第一个晴天</p>
            <h1>银杏寄语</h1>
            <p className="latin">a letter in leaves</p>
            <p className="sub">风一吹，落叶就替我把话说了。</p>
          </header>

          <div className="toolbar">
            <button type="button" className="ghost" onClick={onToggleSound}>
              {soundOn ? '🔊 风声已开' : '🔈 打开风声'}
            </button>
            <button type="button" className="ghost" onClick={onToggleImmersive}>
              ⤢ 沉浸
            </button>
            {submitted && (
              <button type="button" className="ghost" onClick={handleShare}>
                📤 把这片叶子发给 TA
              </button>
            )}
          </div>

          {submitted ? (
            <section className="card wish">
              <p className="wish-kicker">银杏树收到了</p>
              <p className="wish-text">
                {name ? <span className="wish-name">{name}，</span> : null}
                {message || DEFAULT_MESSAGE}
              </p>
              <p className="wish-foot">风会替你带过去。</p>
              <div className="actions">
                <button type="button" className="primary" onClick={handleShare}>
                  把这句话发给 TA
                </button>
                <button type="button" className="ghost" onClick={handleCopyText}>
                  {copied === 'text' ? '✓ 已复制' : '复制文字'}
                </button>
                <button type="button" className="ghost" onClick={onReset}>
                  再写一句
                </button>
              </div>
              <p className="hint">这句话已经写进链接里了。TA 打开链接，就能看见这棵为这句话长出来的树。</p>
            </section>
          ) : (
            <section className="card">
              <label className="field">
                <span>TA 的名字</span>
                <input
                  type="text"
                  value={name}
                  maxLength={12}
                  placeholder="TA 叫…"
                  onChange={(event) => onNameChange(event.target.value)}
                />
              </label>
              <label className="field">
                <span>想对 TA 说的一句话</span>
                <textarea
                  value={message}
                  maxLength={90}
                  rows={3}
                  placeholder={DEFAULT_MESSAGE}
                  onChange={(event) => onMessageChange(event.target.value)}
                />
              </label>
              <button type="button" className="primary" onClick={onSubmit}>
                把这句话交给银杏树
              </button>
              <p className="hint">TA 会收到一棵为这句话长出来的树，和一片不会化的叶子。</p>
            </section>
          )}

          <footer className="foot">
            {isTouch
              ? '拖动换角度 · 轻点树冠会下一场金色的雨'
              : '拖动可以换个角度 · 轻点树冠会下一场金色的雨 · Esc 回到沉浸'}
          </footer>
        </>
      )}
    </div>
  )
}
