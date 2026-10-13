/**
 * Logo Mathieu Pharma — RECONSTITUTION PROVISOIRE d'après les mockups.
 * À remplacer par le fichier vectoriel officiel (déposer dans public/brand/).
 */
export function Logo({ height = 44, className }: { height?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 168 60"
      height={height}
      width={(height * 168) / 60}
      role="img"
      aria-label="Mathieu Pharma"
      className={className}
    >
      <path d="M8 50 C 22 58, 40 55, 52 45" fill="none" stroke="#1d4ed8" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M93 22 L101 4 L104 22" fill="none" stroke="#1d4ed8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <text
        x="4"
        y="40"
        fill="var(--mp-brand-navy)"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="29"
        letterSpacing="0.4"
      >
        MATHIEU
      </text>
      <text
        x="160"
        y="56"
        textAnchor="end"
        fill="var(--mp-brand-navy)"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="12.5"
      >
        Pharma
      </text>
    </svg>
  );
}
