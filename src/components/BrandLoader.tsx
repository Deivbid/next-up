import { IconDeviceGamepad2 } from "@tabler/icons-react";
import "./brand-loader.css";

export function BrandLoader() {
  return (
    <div className="brand-loader" role="status" aria-label="Loading Next Up">
      <div className="brand-loader-mark" aria-hidden="true">
        <IconDeviceGamepad2 stroke={1.8} />
      </div>
      <span className="brand-loader-name" aria-hidden="true">
        Next Up
      </span>
      <span className="brand-loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">Loading your games…</span>
    </div>
  );
}
