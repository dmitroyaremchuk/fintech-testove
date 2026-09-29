import {
  ArrowLeftRight,
  FileText,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { InteractionType } from '@/src/lib/constants';

/** lucide equivalents of the design's Material icons (constants.ts keeps the design names). */
export const INTERACTION_ICON: Record<InteractionType, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  messenger: MessageSquare,
  document: FileText,
  stage_change: ArrowLeftRight,
  note: NotebookPen,
  task: Zap,
};
