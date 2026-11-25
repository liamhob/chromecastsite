import React, {useState} from 'react';
import {Cast, Check, Link2, Tv, X} from 'lucide-react';
import type {CastDevice} from '../types/media';
import {validateStreamUrl} from '../utils/mediaState';

interface CastModalProps {
  isOpen: boolean;
  devices: CastDevice[];
  connectedDeviceId: string | null;
  onClose: () => void;
  onSelectDevice: (deviceId: string | null) => void;
  onMirrorUrl: (url: string, label: string) => void;
}

export const CastModal: React.FC<CastModalProps> = ({
  isOpen,
  devices,
  connectedDeviceId,
  onClose,
  onSelectDevice,
  onMirrorUrl,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleMirrorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateStreamUrl(customUrl);
    if (!check.valid) {
      setUrlError(check.error ?? 'Invalid stream URL.');
      return;
    }
    setUrlError(null);
    onMirrorUrl(check.normalized, customTitle.trim() || 'Mirrored Web Stream');
    setCustomUrl('');
    setCustomTitle('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cast-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#232736] bg-[#12141C] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="cast-modal-title" className="text-xl font-semibold text-[#F4F4F6]">
              Cast to Smart TV
            </h2>
            <p className="mt-1 text-sm text-[#9499AD]">
              Select a Google Chromecast or 4K Cast-enabled receiver on your local network.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cast dialog"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9499AD] transition-colors hover:bg-[#1A1D28] hover:text-[#F4F4F6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 divide-y divide-[#232736] border-y border-[#232736]">
          {devices.map((device) => {
            const isConnected = connectedDeviceId === device.id;
            return (
              <div key={device.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <Tv className="h-4 w-4 shrink-0 text-[#9499AD]" aria-hidden="true" />
                    <span className="truncate text-sm font-semibold text-[#F4F4F6]">{device.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#9499AD]">
                    {device.model} · {device.maxResolution} {device.hdrSupport} · {device.audioCodec}
                  </p>
                </div>

                {isConnected ? (
                  <button
                    type="button"
                    onClick={() => onSelectDevice(null)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#343B52] bg-[#1A1D28] px-3.5 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#232736] whitespace-nowrap shrink-0"
                  >
                    <Check className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDevice(device.id);
                      onClose();
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#E5484D] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#D13B40] whitespace-nowrap shrink-0"
                  >
                    <Cast className="h-3.5 w-3.5" aria-hidden="true" />
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleMirrorSubmit} className="mt-5 space-y-3" noValidate>
          <div className="flex items-center gap-2 text-xs font-medium text-[#D6D9E4]">
            <Link2 className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
            <span>Mirror Browser HLS / Direct Media URL</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
            <div className="sm:col-span-3">
              <label htmlFor="cast-mirror-url" className="sr-only">
                Stream URL
              </label>
              <input
                id="cast-mirror-url"
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="https://cdn.example.com/4k/master.m3u8"
                className="w-full min-h-[42px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-sm text-[#F4F4F6] placeholder-[#6B7085] focus:border-[#E5484D] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cast-mirror-label" className="sr-only">
                Stream Title
              </label>
              <input
                id="cast-mirror-label"
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Optional title"
                className="w-full min-h-[42px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-sm text-[#F4F4F6] placeholder-[#6B7085] focus:border-[#E5484D] focus:outline-none"
              />
            </div>
          </div>
          {urlError && (
            <p role="alert" className="text-xs text-[#F87171]">
              {urlError}
            </p>
          )}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg px-4 py-2 text-xs font-medium text-[#9499AD] transition-colors hover:text-[#F4F4F6] whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[40px] rounded-lg border border-[#343B52] bg-[#1A1D28] px-4 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#232736] whitespace-nowrap shrink-0"
            >
              Load &amp; Mirror URL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
