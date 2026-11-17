import { Column, Entity, PrimaryColumn } from "typeorm";

/** Tuong ung ban ghi trong data/processed/facilities.json. */
@Entity("facilities")
export class FacilityEntity {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({ type: "varchar", length: 500 })
  name!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  url?: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  page_url?: string | null;

  @Column({ type: "varchar", length: 1000, nullable: true })
  address?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  province?: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  latitude?: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  longitude?: string | null;

  @Column({ type: "varchar", length: 1000, nullable: true })
  image?: string | null;

  @Column({ type: "text", nullable: true })
  description?: string | null;
}
