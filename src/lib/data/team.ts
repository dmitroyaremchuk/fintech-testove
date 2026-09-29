import { isClosedStage } from '../rules/stages';
import type { Id } from '../types';
import type { Dataset } from './dataset';
import { pipelineCards, type DealCard } from './pipeline';

export function reassignCandidates(data: Dataset, ownerId: Id, now: Date): DealCard[] {
  return pipelineCards(data, now)
    .filter((c) => c.deal.ownerId === ownerId && !isClosedStage(c.deal.stage))
    .sort(
      (a, b) =>
        Number(b.stuck) - Number(a.stuck) ||
        (a.client?.name ?? '').localeCompare(b.client?.name ?? ''),
    );
}
