import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { BookingStatus } from "../../data/types";

/** Dat lich MO PHONG — truoc day luu o data/processed/bookings.json, nay o DB. */
@Entity("bookings")
@Index(["idempotencyKey"])
@Index(["slotId", "status"])
export class BookingEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  bookingId!: string;

  @Column({ type: "varchar", length: 128 })
  slotId!: string;

  @Column({ type: "varchar", length: 64 })
  doctorId!: string;

  @Column({ type: "varchar", length: 500 })
  doctorName!: string;

  @Column({ type: "varchar", length: 500 })
  facilityName!: string;

  @Column({ type: "varchar", length: 1000 })
  facilityAddress!: string;

  /** YYYY-MM-DD */
  @Column({ type: "varchar", length: 10 })
  date!: string;

  @Column({ type: "varchar", length: 32 })
  timeLabel!: string;

  @Column({ type: "int", nullable: true })
  priceMin!: number | null;

  @Column({ type: "int", nullable: true })
  priceMax!: number | null;

  @Column({ type: "varchar", length: 255 })
  patientName!: string;

  @Column({ type: "varchar", length: 32 })
  phone!: string;

  @Column({ type: "varchar", length: 500 })
  idempotencyKey!: string;

  @Column({ type: "varchar", length: 16 })
  status!: BookingStatus;

  /** ISO string — thoi diem het han giu cho (mo phong) */
  @Column({ type: "varchar", length: 64 })
  holdExpiresAt!: string;

  /** ISO string */
  @Column({ type: "varchar", length: 64 })
  createdAt!: string;
}
