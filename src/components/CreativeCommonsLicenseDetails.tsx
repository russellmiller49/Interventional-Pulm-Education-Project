interface CreativeCommonsLicenseDetailsProps {
  attribution?: string
  className?: string
  license?: string
  licenseUrl?: string
}

export default function CreativeCommonsLicenseDetails({
  attribution,
  className = '',
  license,
  licenseUrl,
}: CreativeCommonsLicenseDetailsProps) {
  if (!license && !attribution) {
    return null
  }

  return (
    <div
      className={`rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900 ${className}`}
    >
      {license ? (
        <p>
          <span className="font-semibold">License: </span>
          {licenseUrl ? (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-green-700/40 underline-offset-2 hover:text-green-700"
            >
              {license}
            </a>
          ) : (
            <span className="font-medium">{license}</span>
          )}
        </p>
      ) : null}
      {attribution ? (
        <p className={license ? 'mt-1' : ''}>
          <span className="font-semibold">Attribution: </span>
          {attribution}
        </p>
      ) : null}
    </div>
  )
}
