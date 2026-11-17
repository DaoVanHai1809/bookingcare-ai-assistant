import { DataSource, type DataSourceOptions } from "typeorm";
import {
  DB_DATABASE,
  DB_HOST,
  DB_PASSWORD,
  DB_PORT,
  DB_TYPE,
  DB_USERNAME,
  SQLITE_PATH,
} from "../config";
import { ArticleChunkEntity } from "./entities/article-chunk.entity";
import { BookingEntity } from "./entities/booking.entity";
import { DoctorEntity } from "./entities/doctor.entity";
import { FacilityEntity } from "./entities/facility.entity";
import { SessionBookingStateEntity } from "./entities/session-booking-state.entity";
import { SlotEntity } from "./entities/slot.entity";
import { SpecialtyEntity } from "./entities/specialty.entity";

export const ALL_ENTITIES = [
  SpecialtyEntity,
  FacilityEntity,
  DoctorEntity,
  SlotEntity,
  BookingEntity,
  ArticleChunkEntity,
  SessionBookingStateEntity,
];

/**
 * Cau hinh DataSource dung chung cho Nest (TypeOrmModule) va script seed.
 * - DB_TYPE=sqlite (mac dinh): file SQLite o backend/bookingcare.db.
 * - DB_TYPE=mysql: MySQL qua DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  if (DB_TYPE === "mysql") {
    return {
      type: "mysql",
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USERNAME,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      entities: ALL_ENTITIES,
      synchronize: true,
    };
  }
  return {
    type: "better-sqlite3",
    database: SQLITE_PATH,
    entities: ALL_ENTITIES,
    synchronize: true,
  };
}

export function createDataSource(): DataSource {
  return new DataSource(buildDataSourceOptions());
}
