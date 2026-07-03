import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReservationView } from "@/components/reservation-view";
import type { Player } from "@/lib/types";

const activePlayers: Player[] = [
  {
    id: "p1",
    name: "Sinyu",
    createdAt: "2026-06-26T10:00:00.000Z",
    isActive: true,
  },
  {
    id: "p2",
    name: "cwj",
    createdAt: "2026-06-26T10:01:00.000Z",
    isActive: true,
  },
];

vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({
    activePlayers,
    isLoaded: true,
  }),
}));

describe("ReservationView", () => {
  it("shows player names in the daily order list", () => {
    render(<ReservationView />);
    const orderList = screen.getByLabelText("每日排序名单");

    expect(within(orderList).getByText("Sinyu")).toBeVisible();
    expect(within(orderList).getByText("cwj")).toBeVisible();
  });
});
