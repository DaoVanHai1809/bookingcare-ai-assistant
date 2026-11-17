import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { buildDataSourceOptions } from "./data-source";
import { SeedService } from "./seed.service";

@Module({
  imports: [TypeOrmModule.forRoot(buildDataSourceOptions())],
  providers: [SeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
