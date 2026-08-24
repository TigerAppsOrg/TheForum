import { Panel } from "~/components/common/panel";
import { FUTURE_COLOR, NOW_COLOR } from "../_lib/map-constants";

const ENTRIES = [
  { label: "Now", color: NOW_COLOR },
  { label: "Future", color: FUTURE_COLOR },
];

export function MapLegend() {
  return (
    <Panel
      elevation="floating"
      className="flex flex-col gap-1.5 px-3 py-2"
      aria-label="Map pin legend"
    >
      {ENTRIES.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="font-dm-sans text-xs font-semibold uppercase text-forum-dark-gray">
            {label}
          </span>
        </div>
      ))}
    </Panel>
  );
}
