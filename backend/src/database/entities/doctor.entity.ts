import { Column, Entity, PrimaryColumn } from "typeorm";
import type { DoctorScheduleEntry } from "../../data/types";

/**
 * Tuong ung ban ghi trong data/processed/doctors.json.
 * specialties va schedule giu dang JSON (simple-json) dung schema goc cua
 * du lieu BookingCare — logic nghiep vu doc dung cac truong nay.
 */
@Entity("doctors")
export class DoctorEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ type: "varchar", length: 500 })
  name!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  url?: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  page_url?: string | null;

  @Column({ type: "varchar", length: 1000, nullable: true })
  photo?: string | null;

  @Column({ type: "text", nullable: true })
  summary?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  province?: string | null;

  @Column({ type: "simple-json" })
  specialties!: { id: number; name: string }[];

  @Column({ type: "simple-json" })
  schedule!: DoctorScheduleEntry[];
}
