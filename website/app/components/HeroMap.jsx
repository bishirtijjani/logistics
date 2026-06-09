// Hero map backdrop. Uses the standalone Katsina map SVG in /public (a wide
// adaptation of the in-app tracking map: street network, labels, route + pins)
// rather than hand-drawn shapes. Decorative only (aria-hidden). Rendered as a
// plain <img> so it covers the hero; the hero adds a scrim for text legibility.
export default function HeroMap({ className = "" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/katsina-map-bg.svg"
      alt=""
      aria-hidden="true"
      className={`${className} object-cover`}
    />
  );
}
