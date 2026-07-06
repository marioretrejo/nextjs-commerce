export function CountdownRing({ fraction }: { fraction: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const filled = (1 - fraction) * circ;
  return (
    <svg width={22} height={22} className="-rotate-90" viewBox="0 0 22 22">
      <circle
        cx={11}
        cy={11}
        r={r}
        fill="none"
        stroke="#e8e8e8"
        strokeWidth={3}
      />
      <circle
        cx={11}
        cy={11}
        r={r}
        fill="none"
        stroke="#111"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{ transition: "stroke-dasharray 0.1s linear" }}
      />
    </svg>
  );
}
