import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from './ui';

/** Shows when a new version is available or the app is ready offline. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="fixed bottom-[76px] left-4 right-4 z-[60] flex max-w-sm sm:bottom-4 sm:right-auto items-center gap-3 rounded-md border border-line bg-raised px-3 py-2.5 text-body-s shadow-lg animate-in">
      {needRefresh ? <RefreshCw className="h-4 w-4 text-accent-deep" /> : <WifiOff className="h-4 w-4 text-accent-deep" />}
      <span className="flex-1">{needRefresh ? 'A new version of WorkOS is available.' : 'WorkOS is ready to use offline.'}</span>
      {needRefresh && (
        <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
          Update
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        Dismiss
      </Button>
    </div>
  );
}
