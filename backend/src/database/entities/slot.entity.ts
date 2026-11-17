import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { SlotStatus } from "../../data/types";

/** Tuong ung ban ghi trong data/processed/slots.json (lich kham cu the theo ngay). */
@Entity("slots")
@Index(["doctorId", "date"])
@Index(["date"])
export class SlotEntity {
  @PrimaryColumn({ type: "varchar", length: 128 })
  slotId!: string;

  @Column({ type: "varchar", length: 64 })
  doctorId!: string;

  @Column({ type: "varchar", length: 500 })
  doctorName!: string;

  @Column({ type: "int" })
  facilityId!: number;

  @Column({ type: "varchar", length: 500 })
  facilityName!: string;

  @Column({ type: "varchar", length: 1000 })
  facilityAddress!: string;

  /** YYYY-MM-DD */
  @Column({ type: "varchar", length: 10 })
  date!: string;

  @Column({ type: "int" })
  weekday!: number;

  /** "09:00" */
  @Column({ type: "varchar", length: 5 })
  start!: string;

  /** "09:30" */
  @Column({ type: "varchar", length: 5 })
  end!: string;

  /** "09:00 - 09:30" */
  @Column({ type: "varchar", length: 32 })
  label!: string;

  @Column({ type: "int", nullable: true })
  priceMin!: number | null;

  @Column({ type: "int", nullable: true })
  priceMax!: number | null;

  @Column({ type: "varchar", length: 16 })
  status!: SlotStatus;
}
