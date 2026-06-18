export type MembershipStatus = "active" | "at-risk" | "inactive" | "prospect";

export interface Member {
  member_id: string;
  business_name: string;
  contact_name: string;
  industry: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  email: string;
  phone: string;
  website: string;
  membership_start_date: string;
  renewal_date: string;
  membership_status: MembershipStatus;
  notes: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ChamberEvent {
  event_id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  event_location: string;
  event_description: string;
}

export interface Attendance {
  attendance_id: string;
  member_id: string;
  event_id: string;
  rsvp_status: string;
  attended: boolean;
  check_in_time: string;
  role: string;
  notes: string;
}

export interface Outreach {
  outreach_id: string;
  member_id: string;
  outreach_date: string;
  outreach_type: string;
  reason: string;
  response: string;
  staff_notes: string;
}
