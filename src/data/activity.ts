import type { Attendance, ChamberEvent, Outreach } from "../types";

export const events: ChamberEvent[] = [
  {
    event_id: "EVT-001",
    event_name: "Mount Olive Business Breakfast",
    event_type: "Networking",
    event_date: "2026-07-10",
    event_location: "Budd Lake",
    event_description: "Pilot event placeholder for future attendance tracking.",
  },
  {
    event_id: "EVT-002",
    event_name: "Member Resource Roundtable",
    event_type: "Education",
    event_date: "2026-08-14",
    event_location: "Flanders",
    event_description: "Future programming placeholder for Chamber engagement analytics.",
  },
];

export const attendance: Attendance[] = [];

export const outreach: Outreach[] = [];
