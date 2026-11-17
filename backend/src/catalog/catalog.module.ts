import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingEntity } from "../database/entities/booking.entity";
import { DoctorEntity } from "../database/entities/doctor.entity";
import { FacilityEntity } from "../database/entities/facility.entity";
import { SlotEntity } from "../database/entities/slot.entity";
import { SpecialtyEntity } from "../database/entities/specialty.entity";
import { CatalogService } from "./catalog.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorEntity,
      FacilityEntity,
      SpecialtyEntity,
      SlotEntity,
      BookingEntity,
    ]),
  ],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
