import PlanViewView from './PlanViewView';
import { usePlanView } from './usePlanView';

interface Props {
  planId: string;
}

const PlanView = ({ planId }: Props) => {
  const vm = usePlanView(planId);
  return <PlanViewView {...vm} />;
};

export default PlanView;
