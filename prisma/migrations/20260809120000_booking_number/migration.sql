-- Human-quotable booking reference. SERIAL backfills existing rows in
-- creation order and keeps the sequence for new bookings.
ALTER TABLE "Booking" ADD COLUMN "bookingNumber" SERIAL NOT NULL;

CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");
