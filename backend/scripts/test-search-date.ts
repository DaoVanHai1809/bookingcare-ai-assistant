/**
 * Kiem chung hoi quy: tim bac si THEO NGAY khong duoc loc cung —
 * bac si khong kham ngay duoc hoi van phai xuat hien trong ket qua,
 * kem so khung trong dung ngay do va cac ngay co lich gan nhat.
 * (Loi cu: loc cung lam bac si "bien mat", agent tim lai nhieu vong
 * roi hoi lai nguoi dung thay vi tra loi. Kem theo: tool khong tim
 * duoc theo ten nen bac si duoc neu ten co the bi day khoi top-10.)
 * Chay: npx tsx scripts/test-search-date.ts
 */
import "dotenv/config";
import assert from "node:assert";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { CatalogService } from "../src/catalog/catalog.service";

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const catalog = app.get(CatalogService);

    // A. Tim theo TEN vao ngay bac si KHONG kham (Thu 7 2026-11-21):
    // BS Vu Van Hoe chi kham ngay trong tuan.
    const sat = await catalog.searchDoctors({
      name: "Vũ Văn Hòe",
      date: "2026-11-21",
    });
    const hoe = sat.doctors.find((d) => String(d.id) === "4134");
    assert.ok(hoe, "tim theo ten: bac si phai xuat hien du khong kham Thu 7");
    const infoSat = sat.dateAvailability?.["4134"];
    assert.ok(infoSat, "phai co dateAvailability cho ngay duoc hoi");
    assert.strictEqual(infoSat.availableOnDate, 0, "Thu 7 phai bao 0 khung trong");
    assert.ok(
      infoSat.nearestDates.includes("2026-11-20") &&
        infoSat.nearestDates.includes("2026-11-23"),
      `ngay gan nhat phai gom 20/11 va 23/11, nhan duoc: ${infoSat.nearestDates}`,
    );
    console.log(
      `[ok] ten + Thu 7: xuat hien, availableOnDate=0, nearest=${infoSat.nearestDates.join(", ")}`,
    );

    // B. Tim theo ten vao ngay bac si CO lich (Thu 6 2026-11-20).
    const fri = await catalog.searchDoctors({
      name: "Vũ Văn Hòe",
      date: "2026-11-20",
    });
    const infoFri = fri.dateAvailability?.["4134"];
    assert.ok(infoFri && infoFri.availableOnDate > 0, "Thu 6 phai con khung trong");
    console.log(`[ok] ten + Thu 6: availableOnDate=${infoFri.availableOnDate}`);

    // C. Tim theo chuyen khoa + ngay: moi bac si tra ve deu co
    // dateAvailability; ai 0 khung trong thi phai co ngay gan nhat.
    const spec = await catalog.searchDoctors({
      specialty: "Cơ Xương Khớp",
      province: "Hà Nội",
      date: "2026-11-21",
      limit: 10,
    });
    assert.ok(spec.doctors.length > 0);
    for (const d of spec.doctors) {
      const info = spec.dateAvailability?.[String(d.id)];
      assert.ok(info, `bac si ${d.id} thieu dateAvailability`);
      if (info.availableOnDate === 0) {
        assert.ok(
          info.nearestDates.length > 0,
          `bac si ${d.id} 0 khung trong nhung khong co ngay gan nhat`,
        );
      }
    }
    console.log("[ok] chuyen khoa + ngay: dateAvailability day du cho moi bac si");

    // D. Khong truyen ngay: khong co dateAvailability, hanh vi cu giu nguyen.
    const plain = await catalog.searchDoctors({
      specialty: "Cơ Xương Khớp",
      province: "Hà Nội",
    });
    assert.ok(plain.doctors.length > 0);
    assert.strictEqual(plain.dateAvailability, undefined);
    console.log("[ok] khong ngay: giu nguyen hanh vi cu");

    console.log("\nTAT CA KIEM CHUNG TIM THEO NGAY DAT ✓");
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
