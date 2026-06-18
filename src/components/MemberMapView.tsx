import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { Member } from "../types";
import { StatusBadge } from "./Cards";

const markerIcon = (status: string) =>
  L.divIcon({
    className: "",
    html: `<div class="map-pin ${status}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export function MemberMapView({ members }: { members: Member[] }) {
  const mapped = members.filter((member) => member.latitude && member.longitude);

  if (!mapped.length) {
    return <div className="rounded-lg bg-ink-900 p-8 text-center text-sm text-slate-400">No mapped members match the current filters.</div>;
  }

  return (
    <div className="h-[520px] overflow-hidden rounded-lg border border-white/10">
      <MapContainer center={[40.862, -74.735]} zoom={11} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapped.map((member) => (
          <Marker
            key={member.member_id}
            position={[member.latitude!, member.longitude!]}
            icon={markerIcon(member.membership_status)}
          >
            <Popup>
              <div className="space-y-2">
                <strong>{member.business_name}</strong>
                <div>{member.industry}</div>
                <div>
                  {member.city}, {member.state}
                </div>
                <StatusBadge value={member.membership_status} />
                {member.website ? (
                  <a href={member.website} target="_blank" rel="noreferrer">
                    Website
                  </a>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
