import {
  siPython,
  siFastapi,
  siDjango,
  siGo,
  siRust,
  siDocker,
  siReact,
  siNextdotjs,
  siVite,
  siExpo,
  siNodedotjs,
  siElectron,
  siHtml5,
  type SimpleIcon,
} from "simple-icons";
import { Code } from "lucide-react";
const logos: Record<string, SimpleIcon> = {
  Python: siPython,
  FastAPI: siFastapi,
  Django: siDjango,
  Go: siGo,
  Rust: siRust,
  Docker: siDocker,
  React: siReact,
  "Next.js": siNextdotjs,
  Vite: siVite,
  Expo: siExpo,
  "Node.js": siNodedotjs,
  Electron: siElectron,
  Static: siHtml5,
};
export function FrameworkIcon({
  type,
  size = 16,
}: {
  type: string;
  size?: number;
}) {
  const logo = logos[type];
  return logo ? (
    <svg
      className="framework-icon"
      role="img"
      aria-label={`${type} logo`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <title>{type}</title>
      <path d={logo.path} />
    </svg>
  ) : (
    <Code size={size} />
  );
}
