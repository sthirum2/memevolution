/**
 * Film grain + a faint lab grid, fixed over the whole app at ~3%.
 * Rendered once, pointer-events-none, never re-renders.
 */
export default function GrainOverlay() {
  return (
    <>
      <svg
        className="pointer-events-none fixed inset-0 z-[60] h-full w-full opacity-[0.032] mix-blend-screen"
        aria-hidden
      >
        <filter id="mv-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.82"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#mv-grain)" />
      </svg>
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(237,232,224,0.022) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(237,232,224,0.022) 1px, transparent 1px)',
          backgroundSize: '68px 68px',
        }}
      />
      {/* vignette — keeps the eye in the middle of the canvas */}
      <div
        className="pointer-events-none fixed inset-0 z-[2]"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse at 50% 42%, transparent 52%, rgba(8,9,10,0.62) 100%)',
        }}
      />
    </>
  )
}
