interface Props {
  size?: number;
  className?: string;
}

export function MatchWheelsLogo({ size = 44, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mwFlame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF7A00" />
          <stop offset="55%" stopColor="#FF3D00" />
          <stop offset="100%" stopColor="#6D5DFB" />
        </linearGradient>
      </defs>
      {/* flame outline */}
      <path
        d="M32 4 C26 14 18 16 18 28 C18 37 24 43 32 43 C40 43 46 37 46 28 C46 22 42 18 40 14 C38 19 35 20 33 18 C32.4 17.4 32 16 32 14 C32 11 32 7 32 4 Z"
        fill="url(#mwFlame)"
        opacity="0.95"
      />
      {/* wheel */}
      <circle cx="32" cy="46" r="14" fill="#0F172A" />
      <circle cx="32" cy="46" r="9" fill="#F7F8FB" />
      <circle cx="32" cy="46" r="3" fill="#0F172A" />
      {/* spokes */}
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect
          key={a}
          x="31"
          y="38"
          width="2"
          height="8"
          fill="#0F172A"
          transform={`rotate(${a} 32 46)`}
        />
      ))}
    </svg>
  );
}

export function MatchWheelsTitle() {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="relative inline-flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur shadow-soft border border-border p-1.5">
        <MatchWheelsLogo size={42} />
      </span>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
        <span className="bg-gradient-to-r from-[oklch(0.59_0.22_280)] to-[oklch(0.55_0.2_310)] bg-clip-text text-transparent">
          MatchWheels
        </span>
        <span className="text-foreground/80 font-medium">
          : From Pricer to Shopper
        </span>
        <span className="block text-sm sm:text-base text-muted-foreground font-normal mt-1">
          Matrix MSRP Updater
        </span>
      </h1>
    </div>
  );
}
