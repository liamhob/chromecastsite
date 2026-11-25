import React, {useState} from 'react';
import {Download, Share, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#2A2F42] bg-[#161924] px-3.5 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:border-[#3A4158] hover:bg-[#1D2130] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
        Install App
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#2A2F42] bg-[#161924] px-3.5 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:border-[#3A4158] hover:bg-[#1D2130] whitespace-nowrap shrink-0"
      >
        {isIOS ? (
          <Share className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
        )}
        {isIOS ? 'Install on iOS' : 'Install App'}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#232736] bg-[#12141C] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="pwa-install-title" className="text-lg font-semibold text-[#F4F4F6]">
                  Install KuroCast on Your Device
                </h2>
                <p className="mt-1 text-sm text-[#9499AD]">
                  Run KuroCast full-screen with offline episode caching and quick Chromecast handoff.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9499AD] transition-colors hover:bg-[#1A1D28] hover:text-[#F4F4F6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 border-t border-[#232736] pt-4 text-sm text-[#D6D9E4]">
              <div>
                <p className="font-medium text-[#F4F4F6]">iPhone &amp; iPad (Safari)</p>
                <p className="mt-1 text-[#9499AD]">
                  1. Tap the Share button in Safari’s bottom toolbar.
                  <br />
                  2. Scroll down and select Add to Home Screen.
                </p>
              </div>
              <div>
                <p className="font-medium text-[#F4F4F6]">Desktop &amp; Android (Chrome / Edge)</p>
                <p className="mt-1 text-[#9499AD]">
                  Open the browser address bar install icon or menu and choose Install KuroCast.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[40px] rounded-lg bg-[#E5484D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#D13B40] whitespace-nowrap shrink-0"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{offlineSimMode: boolean}> = ({offlineSimMode}) => {
  const isOnline = useOnlineStatus();
  if (isOnline && !offlineSimMode) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[#1B1712] px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg md:bottom-5"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
      <span>Offline Mode — Playing from local synced cache</span>
    </div>
  );
};
