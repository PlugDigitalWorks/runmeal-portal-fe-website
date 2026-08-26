import { Order, OrderItem } from "@/services/order.service";
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/currency";

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatCurrency(
  value: number | string | null | undefined,
  symbol: string | null | undefined = DEFAULT_CURRENCY_SYMBOL,
): string {
  const amount = toNumber(value);
  const formatted = amount.toLocaleString("tr-TR", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const resolved = symbol?.trim() || DEFAULT_CURRENCY_SYMBOL;
  // ISO codes need a space before the amount; a glyph like ₺ does not.
  const separator = /^[A-Z]{3}$/.test(resolved) ? " " : "";
  return `${resolved}${separator}${formatted}`;
}

export function formatOrderDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

export function formatOrderDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getOrderDisplayId(order: Order): string {
  return order.orderNumber || order.orderNo || order.code || order.id.slice(0, 8);
}

export function getOrderItemQty(item: OrderItem): number {
  return item.quantity ?? item.qty ?? 1;
}

export function getOrderItemUnitPrice(item: OrderItem): number {
  const directUnit = toNumber(item.unitPrice);
  if (directUnit > 0) return directUnit;

  const basePrice = toNumber(item.basePrice);
  if (basePrice > 0) return basePrice;

  const qty = getOrderItemQty(item);
  const lineTotal = toNumber(item.lineTotal) || toNumber(item.totalPrice);
  return qty > 0 ? lineTotal / qty : 0;
}

export function getOrderItemTotalPrice(item: OrderItem): number {
  const lineTotal = toNumber(item.lineTotal);
  if (lineTotal > 0) return lineTotal;

  const totalPrice = toNumber(item.totalPrice);
  if (totalPrice > 0) return totalPrice;

  return getOrderItemUnitPrice(item) * getOrderItemQty(item);
}

function formatDelta(value: number | string | null | undefined): string {
  const amount = toNumber(value);
  if (!amount) return "";
  return ` (+${formatCurrency(amount)})`;
}

export function getOrderItemDetailLines(item: OrderItem): string[] {
  const lines: string[] = [];

  item.options?.forEach((group) => {
    const selections = group.selectedOptions ?? group.selections ?? [];
    if (selections.length === 0) return;

    const groupName = group.groupName || group.name || "Option";
    const selectedText = selections
      .map((option) => {
        const name = option.optionName || option.name;
        if (!name) return null;
        return `${name}${formatDelta(option.priceDelta ?? option.price)}`;
      })
      .filter((value): value is string => Boolean(value))
      .join(", ");

    if (selectedText) lines.push(`${groupName}: ${selectedText}`);
  });

  item.addons?.forEach((addon) => {
    const name = addon.addonName || addon.name;
    if (!name) return;

    const qty = addon.quantity && addon.quantity > 1 ? `${addon.quantity}x ` : "";
    lines.push(`Addon: ${qty}${name}${formatDelta(addon.priceDelta ?? addon.price)}`);
  });

  if (item.note) {
    lines.push(`Note: ${item.note}`);
  }

  return lines;
}

export function getOrderSubtotal(order: Order, items: OrderItem[] = []): number {
  const directSubtotal = toNumber(order.subtotal ?? order.subTotal);
  if (directSubtotal > 0) return directSubtotal;

  const itemSubtotal = items.reduce((sum, item) => sum + getOrderItemTotalPrice(item), 0);
  if (itemSubtotal > 0) return itemSubtotal;

  return toNumber(order.totalPrice);
}
