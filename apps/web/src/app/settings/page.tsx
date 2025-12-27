import { MainLayout } from '@/components/layouts/MainLayout';
import { DataDeletionButton } from '@/components/features/privacy';

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your data and privacy preferences
          </p>
        </div>

        <section className="border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Data Management</h2>
          <DataDeletionButton />
        </section>

        <section className="border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Export Data</h2>
          <p className="text-sm text-muted-foreground">
            Download all your scan history and results as a JSON file.
          </p>
          <button className="px-4 py-2 border rounded hover:bg-gray-50">
            Export as JSON
          </button>
        </section>
      </div>
    </MainLayout>
  );
}
