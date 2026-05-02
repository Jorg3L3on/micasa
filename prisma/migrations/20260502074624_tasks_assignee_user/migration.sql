-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "assignee_user_id" INTEGER;

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "assignee_user_id" INTEGER;

-- AlterTable
ALTER TABLE "TaskItem" ADD COLUMN     "assignee_user_id" INTEGER;

-- AlterTable
ALTER TABLE "TaskList" ADD COLUMN     "assignee_user_id" INTEGER;

-- CreateIndex
CREATE INDEX "Habit_house_id_assignee_user_id_idx" ON "Habit"("house_id", "assignee_user_id");

-- CreateIndex
CREATE INDEX "Routine_house_id_assignee_user_id_idx" ON "Routine"("house_id", "assignee_user_id");

-- CreateIndex
CREATE INDEX "TaskItem_assignee_user_id_idx" ON "TaskItem"("assignee_user_id");

-- CreateIndex
CREATE INDEX "TaskList_house_id_assignee_user_id_idx" ON "TaskList"("house_id", "assignee_user_id");

-- AddForeignKey
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
