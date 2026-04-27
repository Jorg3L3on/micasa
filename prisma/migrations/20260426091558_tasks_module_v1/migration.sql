-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "RoutineTimeOfDay" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'CUSTOM');

-- CreateTable
CREATE TABLE "TaskList" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskItem" (
    "id" SERIAL NOT NULL,
    "list_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "recurrence_unit" "RecurrenceUnit",
    "recurrence_every" INTEGER,
    "recurrence_anchor" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recurrence_unit" "RecurrenceUnit" NOT NULL,
    "recurrence_every" INTEGER NOT NULL DEFAULT 1,
    "target_per_period" INTEGER NOT NULL DEFAULT 1,
    "reminder_time" TEXT,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "id" SERIAL NOT NULL,
    "habit_id" INTEGER NOT NULL,
    "completed_on" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "completed_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "time_of_day" "RoutineTimeOfDay" NOT NULL DEFAULT 'CUSTOM',
    "active_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineStep" (
    "id" SERIAL NOT NULL,
    "routine_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineRun" (
    "id" SERIAL NOT NULL,
    "routine_id" INTEGER NOT NULL,
    "run_on" TIMESTAMP(3) NOT NULL,
    "completed_steps" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskList_user_id_archived_idx" ON "TaskList"("user_id", "archived");

-- CreateIndex
CREATE INDEX "TaskList_house_id_archived_idx" ON "TaskList"("house_id", "archived");

-- CreateIndex
CREATE INDEX "TaskList_created_at_idx" ON "TaskList"("created_at");

-- CreateIndex
CREATE INDEX "TaskItem_list_id_status_idx" ON "TaskItem"("list_id", "status");

-- CreateIndex
CREATE INDEX "TaskItem_list_id_due_at_idx" ON "TaskItem"("list_id", "due_at");

-- CreateIndex
CREATE INDEX "TaskItem_list_id_sort_order_idx" ON "TaskItem"("list_id", "sort_order");

-- CreateIndex
CREATE INDEX "Habit_user_id_active_idx" ON "Habit"("user_id", "active");

-- CreateIndex
CREATE INDEX "Habit_house_id_active_idx" ON "Habit"("house_id", "active");

-- CreateIndex
CREATE INDEX "Habit_created_at_idx" ON "Habit"("created_at");

-- CreateIndex
CREATE INDEX "HabitLog_habit_id_completed_on_idx" ON "HabitLog"("habit_id", "completed_on");

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_habit_id_completed_on_key" ON "HabitLog"("habit_id", "completed_on");

-- CreateIndex
CREATE INDEX "Routine_user_id_active_idx" ON "Routine"("user_id", "active");

-- CreateIndex
CREATE INDEX "Routine_house_id_active_idx" ON "Routine"("house_id", "active");

-- CreateIndex
CREATE INDEX "Routine_created_at_idx" ON "Routine"("created_at");

-- CreateIndex
CREATE INDEX "RoutineStep_routine_id_sort_order_idx" ON "RoutineStep"("routine_id", "sort_order");

-- CreateIndex
CREATE INDEX "RoutineRun_routine_id_run_on_idx" ON "RoutineRun"("routine_id", "run_on");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineRun_routine_id_run_on_key" ON "RoutineRun"("routine_id", "run_on");

-- AddForeignKey
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "TaskList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineRun" ADD CONSTRAINT "RoutineRun_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineRun" ADD CONSTRAINT "RoutineRun_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
