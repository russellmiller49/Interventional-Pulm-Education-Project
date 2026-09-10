import { useMemo, useState } from 'react';

import { aabipProceduralVideoLibrary } from '@/content/aabipProceduralVideos';

interface AabipVideoLibraryProps {
  panelId: string;
  labelledBy: string;
}

export function AabipVideoLibrary({ panelId, labelledBy }: AabipVideoLibraryProps) {
  const [selectedVideoId, setSelectedVideoId] = useState(aabipProceduralVideoLibrary.videos[0]?.id ?? '');

  const selectedVideo = useMemo(
    () =>
      aabipProceduralVideoLibrary.videos.find((video) => video.id === selectedVideoId) ??
      aabipProceduralVideoLibrary.videos[0],
    [selectedVideoId],
  );

  if (!selectedVideo) {
    return null;
  }

  return (
    <section aria-labelledby={labelledBy} className="section-card" id={panelId} role="tabpanel">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">Additional viewing</div>
          <h2>{aabipProceduralVideoLibrary.title}</h2>
          <p>{aabipProceduralVideoLibrary.summary}</p>
        </div>
        <div className="tag-row">
          <span className="tag">{aabipProceduralVideoLibrary.videos.length} videos</span>
          <span className="tag">Optional library</span>
        </div>
      </div>

      <div className="aabip-video-library">
        <div className="aabip-video-library__player">
          <div className="aabip-video-library__player-meta">
            <div className="eyebrow">
              Video {selectedVideo.playlistIndex} of {aabipProceduralVideoLibrary.videos.length}
            </div>
            <h3>{selectedVideo.title}</h3>
            <p>AABIP hosts this supplemental playlist on YouTube.</p>
          </div>

          <div className="button-row button-row--wrap">
            <a className="button" href={selectedVideo.watchUrl} rel="noreferrer" target="_blank">
              Open on YouTube
            </a>
            <a className="button button--ghost" href={aabipProceduralVideoLibrary.playlistUrl} rel="noreferrer" target="_blank">
              Open full playlist
            </a>
          </div>
        </div>

        <div className="aabip-video-library__playlist">
          <div className="aabip-video-library__playlist-header">
            <div>
              <div className="eyebrow">Playlist</div>
              <h3>{aabipProceduralVideoLibrary.playlistTitle}</h3>
            </div>
          </div>

          <ol className="aabip-video-library__list">
            {aabipProceduralVideoLibrary.videos.map((video) => {
              const isSelected = video.id === selectedVideo.id;

              return (
                <li key={video.id} className="aabip-video-library__list-item">
                  <a
                    aria-current={isSelected ? 'true' : undefined}
                    aria-label={`Open ${video.title} on YouTube`}
                    className={`aabip-video-library__video-button${isSelected ? ' aabip-video-library__video-button--active' : ''}`}
                    href={video.watchUrl}
                    onClick={() => setSelectedVideoId(video.id)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="aabip-video-library__video-index">{String(video.playlistIndex).padStart(2, '0')}</span>
                    <span className="aabip-video-library__video-copy">
                      <strong>{video.title}</strong>
                      <span>Open on YouTube</span>
                    </span>
                  </a>
                  <a
                    aria-label={`Open ${video.title} on YouTube`}
                    className="action-pill"
                    href={video.watchUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
