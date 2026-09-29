import type { Metadata } from 'next';
import { KitPage } from './KitPage';

export const metadata: Metadata = { title: 'UI kit · FundPath' };

// Folder is `%5Fkit` because Next.js treats `_kit` as a private (non-routed) folder.
export default function Page() {
  return <KitPage />;
}
