import { AccountClient } from '@/components/AccountClient';

export const metadata = {
  title: 'Account — multiTransBender',
  description: 'Optional accounts for syncing presets. Settings only, never audio.',
};

export default function AccountPage() {
  return (
    <div className="shell">
      <AccountClient />
    </div>
  );
}
