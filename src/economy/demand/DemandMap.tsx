import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { localSupply } from "./supply";
import type { CategorySummary } from "./types";
import { fmt, signed } from "./engine";
export default function DemandMap({
  row,
  onDetail,
}: {
  row: CategorySummary;
  onDetail: () => void;
}) {
  const listings = localSupply.filter(
    (b) =>
      b.category === row.category &&
      b.latitude !== null &&
      b.longitude !== null,
  );
  return (
    <div>
      <div className="demand-map-heading">
        <button className="eco-link-button" onClick={onDetail}>
          {row.name}
        </button>
        <span>Interest {fmt(row.averageInterest)} / 100</span>
        <span>{row.businessCount} represented listings</span>
        <span>Gap {signed(row.demandGap, 2)}</span>
      </div>
      <div className="demand-map">
        <MapContainer
          center={[40.865, -74.73]}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {listings.map((b) => (
            <CircleMarker
              key={b.member_id}
              center={[b.latitude!, b.longitude!]}
              radius={8}
              pathOptions={{ color: "#15816e", fillOpacity: 0.8 }}
            >
              <Popup>
                <strong>{b.business_name}</strong>
                <p>
                  {b.address}, {b.city}
                </p>
                <button onClick={onDetail}>Category details</button>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="eco-footnote">
        {listings.length} of {row.businessCount} listings have public
        coordinates inside the township boundary. Coordinates are not
        independently verified. No search locations are mapped.
      </p>
    </div>
  );
}
