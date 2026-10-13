import { Check } from "lucide-react";

export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="mp-stepper" aria-label="Étapes de la demande">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className={`mp-step mp-step--${state}`}>
            <button
              type="button"
              className="mp-step__button"
              onClick={() => onSelect?.(i)}
              aria-current={state === "current" ? "step" : undefined}
              disabled={!onSelect}
            >
              <span className="mp-step__dot">{state === "done" ? <Check aria-hidden /> : i + 1}</span>
              <span className="mp-step__label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
