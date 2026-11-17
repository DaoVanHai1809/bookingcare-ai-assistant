import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { seedFromProcessed } from "./seed-data";

/**
 * Luc khoi dong: neu DB chua co du lieu (chua chay `npm run db:seed`),
 * tu dong nap tu data/processed/*.json de app chay duoc ngay.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const result = await seedFromProcessed(this.dataSource);
      this.logger.log(
        `Du lieu san sang: ${result.doctors} bac si, ${result.slots} slot, ` +
          `${result.facilities} co so, ${result.specialties} chuyen khoa, ` +
          `${result.articleChunks} doan bai viet, ${result.bookings} booking.`,
      );
    } catch (err) {
      this.logger.error(
        `Seed du lieu luc khoi dong that bai: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
