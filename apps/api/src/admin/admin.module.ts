import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkerModule } from "../worker/worker.module";

@Module({
    imports: [PrismaModule, WorkerModule],
    controllers: [AdminController],
})
export class AdminModule { }
