import { useRef } from 'react'

/**
 * NumberInput - a money/quantity field that reads naturally for admins.
 *
 *   • Shows thousand separators as you type (5,000,000 not 5000000).
 *   • Starts empty with a "0" placeholder instead of a stuck, must-delete 0.
 *   • Emits a bare numeric string ("5000000") through onChange, so callers keep
 *     parsing it with Number()/parseFloat() exactly as they did before.
 *
 * Under the hood it's a plain text input - type="number" can't render commas -
 * with inputMode set so phones still pop the numeric keypad. `required`,
 * `className`, `placeholder`, and any other props pass straight through.
 *
 * Non-negative only: the minus sign is stripped. Don't use it for fields that
 * accept negative values (e.g. a +/- price adjustment).
 *
 * Props:
 *   value    - the bare model value (number | string | '')
 *   onChange - receives the cleaned numeric string ('' when empty)
 *   decimal  - allow a single decimal point (prices, rates). Default false.
 */

// "5000000" -> "5,000,000". Operates on the integer part's digits only.
const groupInt = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// Model value -> display text with separators (keeps a trailing "." mid-typing).
function toDisplay(value, decimal) {
  if (value === '' || value == null) return ''
  const s = String(value)
  if (!decimal) return groupInt(s.replace(/\D/g, ''))
  const [int, ...rest] = s.split('.')
  const grouped = groupInt(int.replace(/\D/g, ''))
  return s.includes('.') ? `${grouped}.${rest.join('').replace(/\D/g, '')}` : grouped
}

// Display text (commas and all) -> bare numeric string ("5000000" / "12.5").
function toModel(text, decimal) {
  let raw = decimal ? text.replace(/[^\d.]/g, '') : text.replace(/\D/g, '')
  if (decimal) {
    const [int, ...rest] = raw.split('.')
    raw = rest.length ? `${int}.${rest.join('')}` : raw.endsWith('.') ? `${int}.` : int
  }
  // Drop leading zeros but keep a lone "0" and "0." intact.
  return raw.replace(/^0+(?=\d)/, '')
}

export default function NumberInput({ value, onChange, decimal = false, placeholder = '0', ...rest }) {
  const ref = useRef(null)

  const handleChange = (e) => {
    const el = e.target
    const before = el.value
    const caret = el.selectionStart ?? before.length
    // Value-bearing chars left of the caret (separators don't count).
    const significantLeft = before.slice(0, caret).replace(/[^\d.]/g, '').length

    const model = toModel(before, decimal)
    onChange(model)

    // Restore the caret after React swaps in the reformatted value, landing it
    // after the same number of significant chars it was sitting behind.
    const next = toDisplay(model, decimal)
    let pos = 0
    let seen = 0
    while (pos < next.length && seen < significantLeft) {
      if (/[\d.]/.test(next[pos])) seen++
      pos++
    }
    requestAnimationFrame(() => {
      const node = ref.current
      if (node && document.activeElement === node) node.setSelectionRange(pos, pos)
    })
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={toDisplay(value, decimal)}
      onChange={handleChange}
      placeholder={placeholder}
      {...rest}
    />
  )
}
