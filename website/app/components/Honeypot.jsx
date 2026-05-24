/**
 * Honeypot — a hidden input named `website` that real users never see or fill,
 * but spam bots do (they auto-fill every input they encounter).
 *
 * Hidden via a combination of off-screen positioning + ARIA + tab-skipping +
 * autocomplete off. We deliberately avoid `display:none` / `hidden` because
 * smart bots skip those; positioning off-screen looks like a real field.
 *
 * Server-side, the backend treats a non-empty value as a bot and silently
 * drops the submission (returns 200 OK so the bot moves on).
 */

export default function Honeypot({ value, onChange }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-10000px",
        top: "auto",
        width: "1px",
        height: "1px",
        overflow: "hidden",
      }}
    >
      <label htmlFor="website-url-field">
        Website (leave blank)
        <input
          id="website-url-field"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={onChange}
        />
      </label>
    </div>
  );
}
