import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Trang thai dat lich theo phien chat — backend ghim bac si/slot nguoi dung
 * da chon (may trang thai xac dinh) de agent khong tu tra cuu lai lam lech
 * du kien qua nhieu luot hoi thoai.
 * step: none -> doctor (da ghim bac si) -> slot (da ghim khung gio) -> booked.
 */
@Entity("session_booking_states")
export class SessionBookingStateEntity {
  @PrimaryColumn({ type: "varchar", length: 128 })
  sessionId!: string;

  @Column({ type: "varchar", length: 16, default: "none" })
  step!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  doctorId!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  doctorName!: string | null;

  /** YYYY-MM-DD */
  @Column({ type: "varchar", length: 10, nullable: true })
  date!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  slotId!: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  timeLabel!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  facilityName!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  bookingId!: string | null;

  /** ISO string */
  @Column({ type: "varchar", length: 64 })
  updatedAt!: string;
}
