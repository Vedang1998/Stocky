-- Align JobDispatch.updatedAt with Prisma @updatedAt (no DB default).
ALTER TABLE "JobDispatch" ALTER COLUMN "updatedAt" DROP DEFAULT;
