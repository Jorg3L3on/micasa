-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_assignee_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_house_id_fkey";

-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_user_id_fkey";

-- DropForeignKey
ALTER TABLE "HabitLog" DROP CONSTRAINT "HabitLog_completed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "HabitLog" DROP CONSTRAINT "HabitLog_habit_id_fkey";

-- DropForeignKey
ALTER TABLE "Routine" DROP CONSTRAINT "Routine_assignee_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Routine" DROP CONSTRAINT "Routine_house_id_fkey";

-- DropForeignKey
ALTER TABLE "Routine" DROP CONSTRAINT "Routine_user_id_fkey";

-- DropForeignKey
ALTER TABLE "RoutineRun" DROP CONSTRAINT "RoutineRun_completed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "RoutineRun" DROP CONSTRAINT "RoutineRun_routine_id_fkey";

-- DropForeignKey
ALTER TABLE "RoutineStep" DROP CONSTRAINT "RoutineStep_routine_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskItem" DROP CONSTRAINT "TaskItem_assignee_user_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskItem" DROP CONSTRAINT "TaskItem_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskItem" DROP CONSTRAINT "TaskItem_list_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskList" DROP CONSTRAINT "TaskList_assignee_user_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskList" DROP CONSTRAINT "TaskList_house_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskList" DROP CONSTRAINT "TaskList_user_id_fkey";

-- DropTable
DROP TABLE "Habit";

-- DropTable
DROP TABLE "HabitLog";

-- DropTable
DROP TABLE "Routine";

-- DropTable
DROP TABLE "RoutineRun";

-- DropTable
DROP TABLE "RoutineStep";

-- DropTable
DROP TABLE "TaskItem";

-- DropTable
DROP TABLE "TaskList";

-- DropEnum
DROP TYPE "RecurrenceUnit";

-- DropEnum
DROP TYPE "RoutineTimeOfDay";

-- DropEnum
DROP TYPE "TaskPriority";

-- DropEnum
DROP TYPE "TaskStatus";

