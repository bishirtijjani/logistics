/**
 * Toggle - a labelled on/off switch for a single boolean setting.
 *
 * Renders the label + helper text on the left and the switch on the right,
 * stacking on narrow screens instead of squeezing.
 */
export default function Toggle({ label, description, checked, onChange, danger = false }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
      <div className="pr-0 sm:pr-4">
        <p className="font-medium text-text dark:text-dark-text">{label}</p>
        {description && (
          <p className="text-sm text-muted dark:text-dark-muted mt-0.5">{description}</p>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={`w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
            danger
              ? 'peer-focus:ring-red-500/30 peer-checked:bg-red-600'
              : 'peer-focus:ring-primary/30 peer-checked:bg-primary'
          }`}
        ></div>
      </label>
    </div>
  )
}
