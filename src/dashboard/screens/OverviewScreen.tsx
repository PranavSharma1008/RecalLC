import { useEffect } from 'react';
import { StatTile } from '../../components/ui/Card';
import { ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';

export interface OverviewScreenProps {
  navigate: (path: string) => void;
  onChanged: () => void;
  dataVersion?: number;
}

export function OverviewScreen({ navigate: _navigate, onChanged: _onChanged, dataVersion }: OverviewScreenProps) {
  const stats = useAsync(() => callService('stats'), []);

  // Real-time automatic data reload whenever data is updated anywhere
  useEffect(() => {
    stats.reload();
  }, [dataVersion]);

  useEffect(() => {
    function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, area: string) {
      if (area === 'local' && changes['recalllc:data_version']) {
        stats.reload();
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, []);

  if (stats.loading && !stats.data) {
    return <Spinner label="Crunching your revision history…" />;
  }

  if (stats.error) {
    return <ErrorState message={stats.error} onRetry={stats.reload} />;
  }

  const data = stats.data;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Due today"
          value={data?.dueToday ?? 0}
          tone="accent"
          hint={data && data.dueToday > 0 ? 'Ready to revise' : 'All clear'}
        />
        <StatTile
          label="Overdue"
          value={data?.overdue ?? 0}
          tone={(data?.overdue ?? 0) > 0 ? 'warning' : 'default'}
          hint={(data?.overdue ?? 0) > 0 ? 'Needs attention' : 'Nothing late'}
        />
        <StatTile label="Tracked" value={data?.totalProblems ?? 0} hint={`${data?.totalAttempts ?? 0} attempts`} />
        <StatTile
          label="Revised (7d)"
          value={data?.revisedThisWeek ?? 0}
          tone="success"
          hint={`${data?.totalReviews ?? 0} reviews all time`}
        />
        <StatTile
          label="Streak"
          value={`${data?.streak ?? 0}d`}
          tone={(data?.streak ?? 0) > 0 ? 'success' : 'default'}
          hint={(data?.streak ?? 0) > 0 ? 'Keep it going' : 'Revise to start one'}
        />
      </section>
    </div>
  );
}
