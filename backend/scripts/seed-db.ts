/**
 * Nap (lai) du lieu tu data/processed/*.json vao DB qua TypeORM.
 *
 * Chay: npm run db:seed
 * - DB_TYPE=sqlite (mac dinh): ghi vao backend/bookingcare.db
 * - DB_TYPE=mysql: ghi vao MySQL theo DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE
 *
 * Script nay XOA sach cac bang nghiep vu roi nap lai (force reseed).
 * Khi app khoi dong ma DB dang trong, SeedService cung tu dong nap (khong xoa).
 */
import "dotenv/config";
import { createDataSource } from "../src/database/data-source";
import { seedFromProcessed } from "../src/database/seed-data";

async function main(): Promise<void> {
  const ds = await createDataSource().initialize();
  try {
    const result = await seedFromProcessed(ds, { force: true });
    console.log(
      `[db:seed] Da nap: ${result.specialties} chuyen khoa, ${result.facilities} co so, ` +
        `${result.doctors} bac si, ${result.slots} slot, ${result.articleChunks} doan bai viet, ` +
        `${result.bookings} booking.`,
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error("[db:seed] FAIL", err);
  process.exit(1);
});
