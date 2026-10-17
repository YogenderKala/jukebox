import { ArrowUpRight, Loader2 } from 'lucide-react'

/**
 * Neo-brutalist accent card: bold text on the left, line icon on the right.
 * Pass `onClick` to make it clickable (adds the ↗ arrow and lift/shadow hover).
 * Without `onClick` it renders as a static container that may hold `children`
 * (inputs, buttons) below the header.
 */
export default function Card({
  eyebrow,
  title,
  description,
  icon: Icon,
  onClick,
  loading = false,
  disabled = false,
  className = '',
  children,
}) {
  const interactive = typeof onClick === 'function'
  const Root = interactive ? 'button' : 'div'
  const rootProps = interactive
    ? { type: 'button', onClick, disabled: disabled || loading }
    : {}

  return (
    <Root
      {...rootProps}
      className={`card-accent relative flex flex-col gap-4 text-left w-full
        ${interactive ? 'card-hover disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none' : ''}
        ${className}`}
    >
      {interactive && (
        <span className="absolute top-4 right-4" aria-hidden="true">
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <ArrowUpRight className="w-6 h-6" strokeWidth={2.5} />}
        </span>
      )}

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 pr-6">
          {eyebrow && (
            <span className="text-[11px] font-extrabold uppercase tracking-widest">{eyebrow}</span>
          )}
          <h2 className="font-display text-2xl leading-tight mt-1">{title}</h2>
          {description && (
            <p className="text-sm font-medium text-ink/70 mt-2 leading-relaxed">{description}</p>
          )}
        </div>
        {Icon && <Icon className="w-14 h-14 shrink-0" strokeWidth={1.5} aria-hidden="true" />}
      </div>

      {children}
    </Root>
  )
}
