/** The card gui kem cho frontend qua SSE event "cards". */
export type Card =
  | { type: "doctor"; [k: string]: unknown }
  | { type: "facility"; [k: string]: unknown }
  | { type: "slots"; [k: string]: unknown }
  | { type: "booking"; [k: string]: unknown }
  | { type: "article"; [k: string]: unknown };

export function formatPrice(min: number | null, max: number | null): string {
  if (min == null && max == null) return "chưa công bố";
  if (min != null && max != null && max !== min)
    return `${min.toLocaleString("vi-VN")} - ${max.toLocaleString("vi-VN")}đ`;
  const v = (min ?? max) as number;
  return `${v.toLocaleString("vi-VN")}đ`;
}
