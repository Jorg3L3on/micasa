import CreatePlanningMonthButton from '@/components/CreatePlanningMonthButton';

type CreateNextMonthButtonProps = {
  nextYear: number;
  nextMonth: number;
  nextMonthLabel: string;
  canCreate: boolean;
};

export default function CreateNextMonthButton({
  nextYear,
  nextMonth,
  nextMonthLabel,
  canCreate,
}: CreateNextMonthButtonProps) {
  return (
    <CreatePlanningMonthButton
      year={nextYear}
      month={nextMonth}
      monthLabel={nextMonthLabel}
      canCreate={canCreate}
    />
  );
}
