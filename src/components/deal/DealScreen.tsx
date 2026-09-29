'use client';

import { useMemo, useState } from 'react';
import { ListPlus } from 'lucide-react';
import { Button, useToast } from '@/src/components/ui';
import type { LossReason, StageKey } from '@/src/lib/constants';
import { useDataStore, type Dataset, type Session } from '@/src/lib/data';
import { dealView } from '@/src/lib/data/dealCard';
import {
  addApplication,
  changeApplication,
  confirmDisbursement,
  setCommissionRate,
  updateDocument,
  type ActionResult,
} from '@/src/lib/data/dealMutations';
import { addTask, moveDeal, setTaskStatus } from '@/src/lib/data/mutations';
import { formatDue, formatMoney } from '@/src/lib/format';
import { useNow } from '@/src/lib/hooks/useNow';
import { getStage } from '@/src/lib/rules/stages';
import { dueFromPreset } from '@/src/lib/rules/tasks';
import { ScheduleTask } from '../client/ScheduleTask';
import { OpenTasksCard } from '../client/SideCards';
import { LostDealModal } from '../deals/LostDealModal';
import { ApplicationsCard, BackupBanksCard } from './ApplicationsCard';
import { ClosedBanner, DisbursementBanner, SuggestionBanner } from './DealBanners';
import { DealHeader } from './DealHeader';
import { CommissionCard, DealTimelineCard, DocumentsCard, OffersCard } from './DealSideCards';

export interface DealScreenProps {
  dealId: string;
  /** Full dataset: mutations apply to it. */
  data: Dataset;
  /** Role-scoped dataset: what the session may see. */
  scoped: Dataset;
  session: Session;
}

export function DealScreen({ dealId, data, scoped }: DealScreenProps) {
  const toast = useToast();
  const commit = useDataStore((s) => s.commit);
  const now = useNow();
  const [lost, setLost] = useState<{ reason?: LossReason } | null>(null);
  const view = useMemo(() => dealView(scoped, data, dealId, now), [scoped, data, dealId, now]);
  if (!view) return null;
  const { deal, client } = view;

  /** Commit an action with Undo, or explain why it was refused. */
  const run = (result: ActionResult) => {
    if (!result.ok) {
      toast.show({ kind: 'blocked', message: result.error });
      return;
    }
    const previous = data;
    commit(result.data);
    toast.show({ message: result.message, onUndo: () => commit(previous) });
  };

  /** Same path as the kanban: stage rules, auto tasks, toast with Undo. */
  const move = (target: StageKey, reason: LossReason | null = null) => {
    if (target === 'lost' && !reason) {
      setLost({});
      return;
    }
    const r = moveDeal(data, deal.id, target, now, reason);
    if (!r.check.allowed) {
      if (r.check.code !== 'same_stage') toast.show({ kind: 'blocked', message: r.check.message });
      return;
    }
    const n = r.tasks.length;
    run({
      ok: true,
      data: r.data,
      tasks: r.tasks,
      message: `Deal → “${getStage(target).label}”${n ? ` · ${n} ${n === 1 ? 'task' : 'tasks'} created` : ''}`,
    });
  };

  return (
    <div className="flex max-w-content flex-col gap-3.5 px-6 pt-4 pb-8">
      <DealHeader view={view} now={now} onStep={(s) => move(s)} onLost={() => setLost({})} />

      <ClosedBanner view={view} now={now} />
      {view.suggestion && !view.closed && (
        <SuggestionBanner
          suggestion={view.suggestion}
          onAccept={(s) => (s.stage === 'lost' ? setLost({ reason: s.lostReason }) : move(s.stage))}
        />
      )}
      <DisbursementBanner
        view={view}
        onConfirm={() => run(confirmDisbursement(data, deal.id, now))}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_var(--fp-aside-width)] items-start gap-3.5">
        <div className="flex min-w-0 flex-col gap-3">
          <ApplicationsCard
            view={view}
            onAdd={(bank, amount) => run(addApplication(data, deal.id, bank, amount, now))}
            onChange={(app, change) => run(changeApplication(data, app.id, change, now))}
          />
          <BackupBanksCard
            view={view}
            onAdd={(bank, amount) => run(addApplication(data, deal.id, bank, amount, now))}
          />
          <OffersCard offers={view.offers} />
          <DocumentsCard
            view={view}
            now={now}
            onAction={(id, action) => run(updateDocument(data, id, action, now))}
          />
        </div>
        <div className="flex flex-col gap-3">
          <CommissionCard
            view={view}
            onRate={(rate) => {
              if (Math.abs(rate - view.commission.rate) > 1e-9)
                commit(setCommissionRate(data, deal.id, rate));
            }}
          />
          <OpenTasksCard
            title="Deal tasks"
            tasks={view.tasks}
            now={now}
            onToggle={(task) =>
              run({
                ok: true,
                data: setTaskStatus(data, task.id, 'done'),
                tasks: [],
                message: 'Task completed',
              })
            }
            action={
              !view.closed && (
                <ScheduleTask
                  suggestedTitle={`Call ${client?.contacts[0]?.name.split(' ')[0] ?? 'the client'}`}
                  deals={[deal]}
                  onCreate={(input) => {
                    const due = dueFromPreset(input.preset, now);
                    const { data: next } = addTask(data, {
                      title: input.title,
                      type: /call/i.test(input.title) ? 'call' : 'other',
                      clientId: deal.clientId,
                      dealId: deal.id,
                      assigneeId: deal.ownerId,
                      dueAt: due,
                      priority: 'med',
                    });
                    run({
                      ok: true,
                      data: next,
                      tasks: [],
                      message: `Task scheduled · ${formatDue(due, now)}`,
                    });
                  }}
                  anchor={(open, toggle) => (
                    <Button size="xs" icon={ListPlus} aria-expanded={open} onClick={toggle}>
                      Task
                    </Button>
                  )}
                />
              )
            }
          />
          <DealTimelineCard view={view} now={now} />
        </div>
      </div>

      {lost && (
        <LostDealModal
          subtitle={`${client?.name ?? ''} · ${deal.product} · ${formatMoney(deal.requestedAmount)}`}
          initialReason={lost.reason}
          onCancel={() => setLost(null)}
          onConfirm={(reason) => {
            setLost(null);
            move('lost', reason);
          }}
        />
      )}
    </div>
  );
}
