import { sponsors } from '@/content/sponsors';

export function SponsorsPage() {
  return (
    <div className="page-stack">
      <section className="hero-card sponsors-hero">
        <div className="eyebrow">Course sponsors</div>
        <h2>Thank you to our SoCal EBUS Prep supporters</h2>
        <p>
          We are grateful for the organizations whose support helps make this educational course possible for
          pulmonary and critical care fellows.
        </p>
      </section>

      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">With appreciation</div>
            <h2>Our 2026 course sponsors</h2>
            <p>Tap a logo to visit the sponsor website in a new tab.</p>
          </div>
          <div className="tag-row">
            <span className="tag">{sponsors.length} sponsors</span>
          </div>
        </div>

        <div className="sponsor-grid">
          {sponsors.map((sponsor) => (
            <a
              key={sponsor.id}
              aria-label={`Visit ${sponsor.name}`}
              className="sponsor-card"
              href={sponsor.websiteUrl}
              rel="noreferrer"
              target="_blank"
            >
              <span className="sponsor-card__logo-wrap">
                <img alt={`${sponsor.name} logo`} src={sponsor.logoSrc} />
              </span>
              <strong>{sponsor.name}</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="section-card section-card--notice">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Educational independence</div>
            <h2>Sponsor recognition is separate from curriculum content.</h2>
          </div>
        </div>
        <p>
          This app is an educational product for course preparation and is not a diagnostic device. Sponsor support
          does not imply clinical endorsement of any product or platform in the curriculum.
        </p>
      </section>
    </div>
  );
}
