"use client";

import { Dialog } from "@/components/ui/dialog";
import { BookingOrderSection } from "@/components/bookings/booking-order-section";
import { t } from "@/lib/i18n/t";

export function GroupedBookingDetailsDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}
      title={t("bookings.groupedDetails.title")} description={t("bookings.groupedDetails.description")} size="xl">
      <BookingOrderSection orderId={bookingId} currentBookingId="" />
    </Dialog>
  );
}
