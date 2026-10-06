import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { LedgerScreen } from '@/components/LedgerScreen';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';
import { useUserId } from '@/features/auth/AuthProvider';
import { selectGroup, type GroupView } from '@/features/ledger/selectors';
import { leaveScreen } from '@/lib/navigation';

type GroupGateProps = {
  children: (view: GroupView, userId: string) => ReactNode;
  footer?: (view: GroupView, userId: string) => ReactNode;
  /** The children render their own Screen (see LedgerScreen). */
  bare?: boolean;
};

/**
 * For screens under /groups/[id]: loads the group from the ledger and handles the case where
 * it is gone (deleted, or the user is no longer a member).
 */
export function GroupGate({ children, footer, bare }: GroupGateProps) {
  const router = useRouter();
  const userId = useUserId();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <LedgerScreen
      bare={bare}
      footer={(ledger) => {
        const view = selectGroup(ledger, id, userId);
        return view && footer ? footer(view, userId) : null;
      }}>
      {(ledger) => {
        const view = selectGroup(ledger, id, userId);
        if (!view) {
          const missing = (
            <EmptyState
              emoji="🫥"
              title="Group not found"
              body="It may have been removed, or you are no longer a member."
              action={
                <Button label="Back to groups" onPress={() => leaveScreen(router, '/groups')} />
              }
            />
          );
          return bare ? <Screen>{missing}</Screen> : missing;
        }
        return children(view, userId);
      }}
    </LedgerScreen>
  );
}
