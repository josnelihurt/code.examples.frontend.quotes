import { API_VERSIONS, type ApiVersion } from '../api/client';

interface VersionSwitcherProps {
  version: ApiVersion;
  onChange: (next: ApiVersion) => void;
}

// The label names the serving technology — the same enumeration the README's transport
// table documents; Record<ApiVersion, …> keeps it exhaustive when a version lands.
const TRANSPORTS: Record<ApiVersion, string> = {
  v0: 'controllers',
  v1: 'minimal APIs',
  v2: 'proto + adapter',
  v3: 'gRPC-JSON',
};

/**
 * Chooses which transport serves the quote use cases: v0 by MVC controllers, v1 by
 * minimal APIs, v2 by the proto contract behind a wire-identical adapter, v3 by stock
 * gRPC-JSON transcoding. The radio ids are part of the E2E vocabulary (steps target
 * #version-v0 … #version-v3).
 */
export function VersionSwitcher({ version, onChange }: Readonly<VersionSwitcherProps>) {
  return (
    <fieldset className="versions">
      <legend>API version</legend>
      {API_VERSIONS.map((option) => (
        <label key={option} htmlFor={`version-${option}`}>
          <input
            type="radio"
            id={`version-${option}`}
            name="apiVersion"
            value={option}
            checked={version === option}
            onChange={() => onChange(option)}
          />
          {`${option} (${TRANSPORTS[option]})`}
        </label>
      ))}
    </fieldset>
  );
}
