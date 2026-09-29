import { AppShell } from '@/src/components/shell/AppShell';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
