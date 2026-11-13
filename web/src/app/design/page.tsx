import { Showcase } from "./showcase";

export const metadata = { title: "Design system" };

/**
 * Route interne de démonstration du design system Orbit (propriétaire : design).
 * Chaque section est rendue deux fois : thème clair puis thème sombre.
 */
export default function DesignPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div data-theme="light" className="bg-canvas">
        <Showcase theme="light" />
      </div>
      <div data-theme="dark" className="bg-canvas">
        <Showcase theme="dark" />
      </div>
    </div>
  );
}
