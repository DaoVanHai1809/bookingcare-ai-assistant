import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../database/entities/booking.entity";
import { DoctorEntity } from "../database/entities/doctor.entity";
import { SessionBookingStateEntity } from "../database/entities/session-booking-state.entity";
import { SlotEntity } from "../database/entities/slot.entity";
import { BookingStateService } from "./booking-state.service";
import { BookingService } from "./booking.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorEntity,
      SlotEntity,
      BookingEntity,
      SessionBookingStateEntity,
    ]),
  ],
  providers: [BookingService, BookingStateService],
  exports: [BookingService, BookingStateService],
})
export class BookingModule {}
