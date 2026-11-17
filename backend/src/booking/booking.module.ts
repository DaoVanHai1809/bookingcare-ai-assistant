import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../database/entities/booking.entity";
import { DoctorEntity } from "../database/entities/doctor.entity";
import { SlotEntity } from "../database/entities/slot.entity";
import { BookingService } from "./booking.service";

@Module({
  imports: [TypeOrmModule.forFeature([DoctorEntity, SlotEntity, BookingEntity])],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
