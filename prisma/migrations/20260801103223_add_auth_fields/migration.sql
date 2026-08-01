/*
  Warnings:

  - You are about to drop the column `durum` on the `Kullanici` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `Kullanici` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `Kullanici` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sifre` to the `Kullanici` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Kullanici" DROP COLUMN "durum",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "sifre" TEXT NOT NULL,
ALTER COLUMN "rol" SET DEFAULT 'User';

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_email_key" ON "Kullanici"("email");
