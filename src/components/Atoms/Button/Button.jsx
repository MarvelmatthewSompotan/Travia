import './Button.css'

export function Button({ variant = 'default', size = 'md', children, className = '', ...rest }) {
  const cls = `btn btn--${variant} btn--${size} ${className}`.trim()
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
