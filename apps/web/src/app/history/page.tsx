import { MainLayout } from '@/components/layouts/MainLayout';
import { HistoryList } from '@/components/features/history';

export default function HistoryPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scan History</h1>
          <p className="text-muted-foreground">
            View and manage your past accessibility scans
          </p>
        </div>

        <HistoryList />
      </div>
    </MainLayout>
  );
}
