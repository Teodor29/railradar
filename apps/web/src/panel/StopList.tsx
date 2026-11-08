import type { TrainDetails, TrainStop } from "@railradar/shared"
import { getUpcomingCall } from "../trains/format"
import { StopTime } from "./StopTime"

function getDotClass(stop: TrainStop, isNext: boolean): string {
  if (stop.canceled) {
    return "bg-danger"
  }
  return isNext ? "bg-accent" : "bg-muted"
}

function getNameClass(stop: TrainStop, isNext: boolean): string {
  if (stop.canceled) {
    return "text-muted line-through"
  }
  return isNext ? "font-semibold" : ""
}

function StopRow({ stop, isNext }: { stop: TrainStop; isNext: boolean }) {
  const call = getUpcomingCall(stop)

  return (
    <li
      className={`flex items-center justify-between gap-3 py-2 ${stop.passed ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`size-2.5 shrink-0 rounded-full ${getDotClass(stop, isNext)}`} />
        <div className="min-w-0">
          <div className={`truncate ${getNameClass(stop, isNext)}`}>{stop.name}</div>
          <div className="text-sm text-muted">
            Spår {stop.track ?? "–"}
            {stop.passed ? <span className="sr-only"> · passerad</span> : null}
          </div>
        </div>
      </div>
      {stop.canceled ? <span className="font-semibold text-danger">Inställt</span> : null}
      {!stop.canceled && call ? <StopTime call={call} /> : null}
    </li>
  )
}

export function StopList({ details }: { details: TrainDetails }) {
  return (
    <ol className="divide-y divide-line/30">
      {details.stops.map((stop, index) => (
        <StopRow
          key={`${stop.signature}-${index}`}
          stop={stop}
          isNext={index === details.nextStopIndex}
        />
      ))}
    </ol>
  )
}
