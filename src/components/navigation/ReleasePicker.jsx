import { RocketLaunch, ArrowRight } from "@phosphor-icons/react";
import { Kicker } from "../core/Kicker.jsx";

export function ReleasePicker({ projectName, releases, onPick }) {
  return (
    <div className="rt-release-picker">
      <Kicker>{projectName}</Kicker>
      <h1>Select a release</h1>
      <div>
        {releases.map((item) => (
          <button type="button" key={item.id} onClick={() => onPick(item.id)}>
            <span><RocketLaunch /></span>
            <strong>{item.name}</strong>
            <small>{item.status} · {item.targetValue || "target not set"}</small>
            <ArrowRight />
          </button>
        ))}
      </div>
    </div>
  );
}
