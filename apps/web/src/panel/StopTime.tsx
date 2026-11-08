import type { StopCall } from "@railradar/shared"
import { getDisplayTime } from "../trains/format"

// The shown time, with the timetable struck through below it when they differ.
export function StopTime({ call }: { call: StopCall }) {
  const { time, plannedTime, late } = getDisplayTime(call)

  if (!plannedTime) {
    return <div className="text-right text-lg tabular-nums">{time}</div>
  }

  return (
    <div className="text-right tabular-nums">
      <div className={`text-lg font-semibold ${late ? "text-warning" : "text-success"}`}>
        {time}
      </div>
      <div className="text-sm text-muted line-through">{plannedTime}</div>
    </div>
  )
}
