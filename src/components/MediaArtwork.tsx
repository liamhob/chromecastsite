import React, {useState} from 'react';
import {Film} from 'lucide-react';

interface MediaArtworkProps {
  src: string;
  alt: string;
  title: string;
  className?: string;
}

export const MediaArtwork: React.FC<MediaArtworkProps> = ({src, alt, title, className = ''}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#171A26] via-[#12141C] to-[#0D0F16] p-4 text-center ${className}`}
      >
        <Film className="h-7 w-7 text-[#9499AD]" aria-hidden="true" />
        <span className="mt-2 line-clamp-2 text-xs font-medium text-[#D6D9E4]">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};
