import { BronchoscopyFoundationsHub } from './BronchoscopyFoundationsHub'

/** Learn and the course front door share one curriculum and continuation resolver. */
export function BronchoscopyFoundationsLearnLanding({
  unknownSection,
}: {
  readonly unknownSection?: string
}) {
  return (
    <>
      {unknownSection ? (
        <p className="mx-auto max-w-5xl p-4" role="status" data-unknown-section={unknownSection}>
          That section is not on the pathway. Every section is listed below.
        </p>
      ) : null}
      <BronchoscopyFoundationsHub />
    </>
  )
}
