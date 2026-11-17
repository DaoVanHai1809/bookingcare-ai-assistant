import { Column, Entity, PrimaryColumn } from "typeorm";

/** Tuong ung ban ghi trong data/processed/specialties.json. */
@Entity("specialties")
export class SpecialtyEntity {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 500 })
  url!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  page_url?: string | null;

  @Column({ type: "text", nullable: true })
  description?: string | null;
}
