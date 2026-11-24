import { WifiOff } from 'lucide-react';
import type { Language } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator({ lang }: { lang: Language }) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        {lang === 'mm'
          ? 'အင်တာနက် ပြတ်တောက်နေသည် — သိမ်းထားသော ဒေတာများကို ပြသနေပါသည်'
          : 'Offline — showing cached storefront'}
      </span>
    </div>
  );
}
