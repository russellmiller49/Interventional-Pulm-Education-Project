import type { EbusConfidence, FellowshipYear, LearnerDegree, LearnerProfileInput } from '@/lib/auth';

export const emptyProfileInput: LearnerProfileInput = {
  fullName: '',
  degree: 'MD',
  institution: '',
  institutionalEmail: '',
  fellowshipYear: 'first',
  flexibleBronchoscopyCount: null,
  ebusCount: null,
  ebusConfidence: 'moderate',
};

export function validateProfileInput(profile: LearnerProfileInput) {
  if (!profile.fullName.trim()) {
    return 'Enter your name.';
  }

  if (!profile.institution.trim()) {
    return 'Enter your institution.';
  }

  if (!profile.institutionalEmail.trim()) {
    return 'Enter your institutional email.';
  }

  return null;
}

export function LearnerProfileFields({
  onChange,
  values,
}: {
  onChange: (values: LearnerProfileInput) => void;
  values: LearnerProfileInput;
}) {
  return (
    <div className="profile-form__grid">
      <label className="field">
        <span>Name</span>
        <input
          autoComplete="name"
          onChange={(event) => onChange({ ...values, fullName: event.target.value })}
          required
          type="text"
          value={values.fullName}
        />
      </label>
      <label className="field">
        <span>Degree</span>
        <select
          onChange={(event) => onChange({ ...values, degree: event.target.value as LearnerDegree })}
          required
          value={values.degree}
        >
          <option value="MD">MD</option>
          <option value="DO">DO</option>
        </select>
      </label>
      <label className="field">
        <span>Institution</span>
        <input
          autoComplete="organization"
          onChange={(event) => onChange({ ...values, institution: event.target.value })}
          required
          type="text"
          value={values.institution}
        />
      </label>
      <label className="field">
        <span>Institutional email</span>
        <input
          autoComplete="email"
          onChange={(event) => onChange({ ...values, institutionalEmail: event.target.value })}
          required
          type="email"
          value={values.institutionalEmail}
        />
        <small className="field__help">Used for program records. It can match your login email.</small>
      </label>
      <label className="field">
        <span>Fellowship year</span>
        <select
          onChange={(event) => onChange({ ...values, fellowshipYear: event.target.value as FellowshipYear })}
          required
          value={values.fellowshipYear}
        >
          <option value="first">First</option>
          <option value="second">Second</option>
          <option value="third">Third</option>
        </select>
      </label>
      <label className="field">
        <span>Confidence in EBUS skills</span>
        <select
          onChange={(event) => onChange({ ...values, ebusConfidence: event.target.value as EbusConfidence })}
          required
          value={values.ebusConfidence}
        >
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>
      </label>
    </div>
  );
}
