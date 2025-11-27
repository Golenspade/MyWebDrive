/**
 * Page Background Illustration
 * Original design by MyGO Studio for MyWebDrive
 * MIT License
 */
export default function PageIllustration() {
  return (
    <>
      {/* Top gradient mesh */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] overflow-hidden"
        aria-hidden="true"
      >
        {/* Grid pattern using CSS */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                              linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Decorative gradient orbs */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 ml-[580px] -translate-x-1/2"
        aria-hidden="true"
      >
        <div className="h-80 w-80 rounded-full bg-gradient-to-tr from-blue-500/40 to-transparent opacity-50 blur-[120px]" />
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-[420px] ml-[380px] -translate-x-1/2"
        aria-hidden="true"
      >
        <div className="h-80 w-80 rounded-full bg-gradient-to-tr from-blue-500/30 to-purple-500/20 opacity-40 blur-[140px]" />
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-[640px] -ml-[300px] -translate-x-1/2"
        aria-hidden="true"
      >
        <div className="h-80 w-80 rounded-full bg-gradient-to-tr from-purple-500/30 to-gray-900 opacity-40 blur-[140px]" />
      </div>
    </>
  );
}
