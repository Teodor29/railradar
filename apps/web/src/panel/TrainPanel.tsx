import { useEffect, type ReactNode } from "react"
import { TriangleAlert } from "lucide-react"
import type { TrainDetails } from "@railradar/shared"
import {
  formatDelay,
  getCanceledStopsNotice,
  getTrainName,
  getTrainStatus,
  getUpcomingCall,
  type TrainStatus,
} from "../trains/format"
import type { TrainStore } from "../trains/store"
import { useLiveTrain, useServerNow } from "../trains/useLiveTrain"
import { useTrainDetails, type TrainDetailsState } from "../trains/useTrainDetails"
import { Panel } from "./Panel"
import { Skeleton } from "./Skeleton"
import { StopList } from "./StopList"
import { StopTime } from "./StopTime"

const STATUS_TICK_MS = 15_000

function getRoute(details: TrainDetails | null): string | null {
  if (!details?.from || !details.to) {
    return null
  }
  return `${details.from} → ${details.to}`
}

function Missing({ text = "–" }: { text?: string }) {
  return <span className="font-normal text-muted">{text}</span>
}

function Heading({ detailsState }: { detailsState: TrainDetailsState }) {
  if (detailsState.status === "loading") {
    return <Skeleton className="w-56 max-w-full" />
  }
  const details = detailsState.status === "loaded" ? detailsState.details : null
  return getRoute(details) ?? <Missing text="Okänd sträcka" />
}

const statusDotClasses: Record<TrainStatus["kind"], string> = {
  moving: "bg-success",
  "at-station": "bg-success",
  running: "bg-success",
  stopped: "bg-warning",
  stale: "bg-muted",
  canceled: "bg-danger",
}

function getStatusText(status: TrainStatus): string {
  if (status.kind === "canceled") {
    return "Inställt"
  }
  if (status.kind === "stale") {
    return `Senast sett · ${status.minutesAgo} min sedan`
  }
  if (status.kind === "moving") {
    return `I rörelse · ${status.speed} km/h`
  }
  if (status.kind === "at-station") {
    return `Vid ${status.station}`
  }
  if (status.kind === "stopped") {
    return "Står still"
  }
  return "I trafik"
}

function Delay({ detailsState, status }: { detailsState: TrainDetailsState; status: TrainStatus }) {
  if (detailsState.status === "loading") {
    return <Skeleton className="w-14" />
  }
  // A delay means nothing for a train that doesn't run.
  const delayMinutes =
    detailsState.status === "loaded" && status.kind !== "canceled"
      ? detailsState.details.delayMinutes
      : null
  if (delayMinutes === null) {
    return <Missing />
  }

  return (
    <span className={`font-semibold ${delayMinutes > 0 ? "text-warning" : "text-success"}`}>
      {formatDelay(delayMinutes)}
    </span>
  )
}

// What the train does now on the left, how it keeps to the timetable on the right.
function StatusRow({
  detailsState,
  status,
}: {
  detailsState: TrainDetailsState
  status: TrainStatus
}) {
  let textClass = ""
  if (status.kind === "canceled") {
    textClass = "font-semibold text-danger"
  } else if (status.kind === "stale") {
    textClass = "text-muted"
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-lg">
      <div className={`flex min-w-0 items-center gap-2.5 ${textClass}`}>
        <span className={`size-2.5 shrink-0 rounded-full ${statusDotClasses[status.kind]}`} />
        <span className="truncate">{getStatusText(status)}</span>
      </div>
      <Delay detailsState={detailsState} status={status} />
    </div>
  )
}

type NextStopParts = { name: ReactNode; time: ReactNode }

function getNextStopParts(detailsState: TrainDetailsState): NextStopParts {
  if (detailsState.status === "loading") {
    const time = (
      <span className="text-lg">
        <Skeleton className="w-12" />
      </span>
    )
    return { name: <Skeleton className="w-40" />, time }
  }
  if (detailsState.status === "no-timetable") {
    return { name: <Missing text="Ingen tidtabell tillgänglig" />, time: null }
  }
  if (detailsState.status === "error") {
    return { name: <Missing text="Kunde inte hämta tidtabellen" />, time: null }
  }

  const { details } = detailsState
  const stop = details.nextStopIndex === null ? undefined : details.stops[details.nextStopIndex]
  const call = stop ? getUpcomingCall(stop) : null
  if (!stop || !call) {
    return { name: <Missing text="Inga fler stopp" />, time: null }
  }

  const name = (
    <>
      <span className="font-semibold">{stop.name}</span>
      {stop.track ? <span className="text-muted"> · spår {stop.track}</span> : null}
    </>
  )
  return { name, time: <StopTime call={call} /> }
}

// Always shown, so the panel keeps its shape while loading and between trains.
function NextStop({ detailsState }: { detailsState: TrainDetailsState }) {
  const { name, time } = getNextStopParts(detailsState)

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm text-muted">Nästa station</div>
        <div className="text-lg">{name}</div>
      </div>
      {time}
    </div>
  )
}

function Deviations({ deviations }: { deviations: string[] }) {
  if (deviations.length === 0) {
    return null
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
      <span className="font-medium">{deviations.join(" · ")}</span>
    </div>
  )
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3">
      <div className="text-sm text-muted">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function MoreDetails({ detailsState }: { detailsState: TrainDetailsState }) {
  if (detailsState.status === "loading") {
    return (
      <>
        <DetailField label="Operatör">
          <Skeleton className="w-32" />
        </DetailField>
        <DetailField label="Stopp">
          <Skeleton className="w-full" />
        </DetailField>
        <DetailField label="Övrig information">
          <Skeleton className="w-full" />
        </DetailField>
      </>
    )
  }

  const details = detailsState.status === "loaded" ? detailsState.details : null
  const otherInformation = details?.otherInformation ?? []
  const missingStopsText =
    detailsState.status === "error" ? "Kunde inte hämta tidtabellen" : "Ingen tidtabell tillgänglig"

  return (
    <>
      <DetailField label="Operatör">{details?.operator ?? <Missing />}</DetailField>
      <DetailField label="Stopp">
        {details ? <StopList details={details} /> : <Missing text={missingStopsText} />}
      </DetailField>
      <DetailField label="Övrig information">
        {otherInformation.length > 0 ? (
          otherInformation.map((information) => <p key={information}>{information}</p>)
        ) : (
          <Missing />
        )}
      </DetailField>
    </>
  )
}

type TrainPanelProps = {
  store: TrainStore
  trainId: string
  onClose: () => void
}

export function TrainPanel({ store, trainId, onClose }: TrainPanelProps) {
  const train = useLiveTrain(store, trainId)
  const serverNow = useServerNow(store, STATUS_TICK_MS)
  const detailsState = useTrainDetails(trainId)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  // App deselects trains that leave the map, so this only happens briefly.
  if (!train) {
    return null
  }

  const details = detailsState.status === "loaded" ? detailsState.details : null
  const status = getTrainStatus(details, train, serverNow)
  const canceledStops = details ? getCanceledStopsNotice(details) : null

  // Everything but the deviations is always shown, with "–" or a short text for
  // missing values, so the panel doesn't change shape when details arrive.
  return (
    <Panel
      title={getTrainName(details?.product ?? null, train.n)}
      heading={<Heading detailsState={detailsState} />}
      onClose={onClose}
      more={<MoreDetails detailsState={detailsState} />}
    >
      <StatusRow detailsState={detailsState} status={status} />
      <NextStop detailsState={detailsState} />
      {details ? (
        <Deviations
          deviations={canceledStops ? [canceledStops, ...details.deviations] : details.deviations}
        />
      ) : null}
    </Panel>
  )
}
