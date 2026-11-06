import { z } from "zod"
import { escapeXml, postQuery } from "../ingest/trafikverket"

const descriptionsSchema = z.array(z.object({ Description: z.string() })).optional()
const locationsSchema = z.array(z.object({ LocationName: z.string() })).optional()

export const trainAnnouncementSchema = z.object({
  ActivityType: z.enum(["Ankomst", "Avgang"]),
  LocationSignature: z.string().min(1),
  AdvertisedTimeAtLocation: z.iso.datetime({ offset: true }),
  EstimatedTimeAtLocation: z.iso.datetime({ offset: true }).optional(),
  TimeAtLocation: z.iso.datetime({ offset: true }).optional(),
  TrackAtLocation: z.string().optional(),
  Canceled: z.boolean(),
  Deleted: z.boolean(),
  ProductInformation: descriptionsSchema,
  InformationOwner: z.string().optional(),
  FromLocation: locationsSchema,
  ToLocation: locationsSchema,
  Deviation: descriptionsSchema,
  OtherInformation: descriptionsSchema,
})

export type TrainAnnouncement = z.infer<typeof trainAnnouncementSchema>

export type Announcement = {
  activity: "arrival" | "departure"
  signature: string // LocationSignature
  advertisedAt: Date
  estimatedAt: Date | null
  actualAt: Date | null
  track: string | null
  canceled: boolean // Per location: a train can be canceled for only part of its route
  product: string | null // e.g. "SJ Regional" or "SL Pendeltåg 43"
  operator: string | null
  fromSignature: string | null
  toSignature: string | null
  deviations: string[] // e.g. "Spårändrat" or "Buss ersätter"
  otherInformation: string[]
}

const responseSchema = z.object({
  RESPONSE: z.object({
    RESULT: z.array(
      z.object({
        TrainAnnouncement: z.array(z.unknown()).default([]),
      }),
    ),
  }),
})

// departureDate is YYYY-MM-DD: the date the train started, also for stops after midnight.
export function buildAnnouncementQuery(
  apiKey: string,
  departureDate: string,
  trainNumber: string,
): string {
  const midnight = `${escapeXml(departureDate)}T00:00:00`

  // ScheduledDepartureDateTime is midnight Swedish time, and this range covers both of its offsets.
  return [
    "<REQUEST>",
    `<LOGIN authenticationkey="${escapeXml(apiKey)}"/>`,
    '<QUERY objecttype="TrainAnnouncement" namespace="rail.trafficinfo" schemaversion="2.0">',
    "<FILTER>",
    `<EQ name="AdvertisedTrainIdent" value="${escapeXml(trainNumber)}"/>`,
    `<GTE name="ScheduledDepartureDateTime" value="${midnight}+02:00"/>`,
    `<LTE name="ScheduledDepartureDateTime" value="${midnight}+01:00"/>`,
    '<EQ name="Advertised" value="true"/>',
    "</FILTER>",
    "<INCLUDE>ActivityType</INCLUDE>",
    "<INCLUDE>LocationSignature</INCLUDE>",
    "<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>",
    "<INCLUDE>EstimatedTimeAtLocation</INCLUDE>",
    "<INCLUDE>TimeAtLocation</INCLUDE>",
    "<INCLUDE>TrackAtLocation</INCLUDE>",
    "<INCLUDE>Canceled</INCLUDE>",
    "<INCLUDE>Deleted</INCLUDE>",
    "<INCLUDE>ProductInformation</INCLUDE>",
    "<INCLUDE>InformationOwner</INCLUDE>",
    "<INCLUDE>FromLocation</INCLUDE>",
    "<INCLUDE>ToLocation</INCLUDE>",
    "<INCLUDE>Deviation</INCLUDE>",
    "<INCLUDE>OtherInformation</INCLUDE>",
    "</QUERY>",
    "</REQUEST>",
  ].join("")
}

function descriptions(items: { Description: string }[] | undefined): string[] {
  if (!items) return []
  return items.map((item) => item.Description)
}

function toOptionalDate(value: string | undefined): Date | null {
  if (!value) return null
  return new Date(value)
}

export function toAnnouncement(trainAnnouncement: TrainAnnouncement): Announcement {
  const productParts = descriptions(trainAnnouncement.ProductInformation)

  return {
    activity: trainAnnouncement.ActivityType === "Ankomst" ? "arrival" : "departure",
    signature: trainAnnouncement.LocationSignature,
    advertisedAt: new Date(trainAnnouncement.AdvertisedTimeAtLocation),
    estimatedAt: toOptionalDate(trainAnnouncement.EstimatedTimeAtLocation),
    actualAt: toOptionalDate(trainAnnouncement.TimeAtLocation),
    track: trainAnnouncement.TrackAtLocation ?? null,
    canceled: trainAnnouncement.Canceled,
    product: productParts.length > 0 ? productParts.join(" ") : null,
    // InformationOwner is the name passengers know (Skånetrafiken), Operator the contractor (ARRIVA).
    operator: trainAnnouncement.InformationOwner ?? null,
    fromSignature: trainAnnouncement.FromLocation?.[0]?.LocationName ?? null,
    toSignature: trainAnnouncement.ToLocation?.[0]?.LocationName ?? null,
    deviations: descriptions(trainAnnouncement.Deviation),
    otherInformation: descriptions(trainAnnouncement.OtherInformation),
  }
}

// Validates each row on its own, so one odd row doesn't drop the whole train.
export function parseAnnouncementResponse(json: unknown): Announcement[] {
  const result = responseSchema.parse(json).RESPONSE.RESULT[0]
  if (!result) return []

  const announcements: Announcement[] = []
  let invalidCount = 0
  for (const item of result.TrainAnnouncement) {
    const parsed = trainAnnouncementSchema.safeParse(item)
    if (!parsed.success) {
      invalidCount++
      continue
    }
    if (!parsed.data.Deleted) {
      announcements.push(toAnnouncement(parsed.data))
    }
  }
  if (invalidCount > 0) {
    console.warn(`Skipped ${invalidCount} invalid TrainAnnouncement(s)`)
  }

  return announcements
}

export async function queryTrainAnnouncements(
  apiKey: string,
  departureDate: string,
  trainNumber: string,
  signal: AbortSignal,
): Promise<Announcement[]> {
  const query = buildAnnouncementQuery(apiKey, departureDate, trainNumber)
  return parseAnnouncementResponse(await postQuery(query, signal))
}
