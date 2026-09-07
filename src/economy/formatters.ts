export const colors = [
  "#15816e",
  "#d05b48",
  "#518bb0",
  "#997634",
  "#8f69a6",
  "#588944",
  "#8b6474",
];
export const number = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(value)
    ? "Unavailable"
    : value.toLocaleString("en-US", { maximumFractionDigits: digits });
export const month = (value: string) =>
  new Date(`${value.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const chartTooltip = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid #dce3df",
    borderRadius: 4,
    color: "#172820",
    fontSize: 12,
  },
  labelStyle: { color: "#172820" },
};
