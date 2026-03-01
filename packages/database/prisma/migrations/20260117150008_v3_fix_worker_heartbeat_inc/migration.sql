-- AddForeignKey
ALTER TABLE "worker_heartbeats" ADD CONSTRAINT "worker_heartbeats_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "worker_nodes"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
