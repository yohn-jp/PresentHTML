import {
  createTheme,
  createThemeRegistry,
} from "./theme-contract.js";

/**
 * PresentHTML's default light theme.  Values are semantic roles consumed by
 * layouts and renderers; no selector or markup knowledge belongs here.
 */
export const DEFAULT_THEME = createTheme({
  id: "default",
  version: 1,
  name: "PresentHTML Default",
  tokens: {
    geometry: {
      aspectRatio: "16 / 9",
      width: "1600px",
      height: "900px",
    },
    typography: {
      display: {
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: "clamp(3.5rem, 7vw, 7rem)",
        fontWeight: "800",
        lineHeight: "0.98",
        letterSpacing: "-0.06em",
      },
      title: {
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: "clamp(2.5rem, 5vw, 4.75rem)",
        fontWeight: "750",
        lineHeight: "1.04",
        letterSpacing: "-0.045em",
      },
      subtitle: {
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: "clamp(1.25rem, 2.2vw, 2rem)",
        fontWeight: "500",
        lineHeight: "1.3",
        letterSpacing: "-0.02em",
      },
      body: {
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: "1.35rem",
        fontWeight: "450",
        lineHeight: "1.5",
        letterSpacing: "-0.01em",
      },
      caption: {
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: "0.95rem",
        fontWeight: "650",
        lineHeight: "1.35",
        letterSpacing: "0.02em",
      },
      metric: {
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: "clamp(3rem, 6vw, 6rem)",
        fontWeight: "800",
        lineHeight: "0.95",
        letterSpacing: "-0.06em",
      },
    },
    spacing: {
      none: "0",
      xs: "0.5rem",
      sm: "0.75rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
      "2xl": "3rem",
      "3xl": "4.5rem",
    },
    grid: {
      columns: 12,
      contentMaxWidth: "1360px",
      contentPadding: "7.5rem",
      columnGap: "2rem",
      rowGap: "2rem",
    },
    color: {
      background: "#f4f7fb",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      text: "#172033",
      textMuted: "#56627a",
      textSubtle: "#7d879b",
      accent: "#526dff",
      accentStrong: "#2f48cb",
      accentContrast: "#ffffff",
      border: "#dce3ef",
      borderStrong: "#bac6db",
    },
    border: {
      width: "1px",
      style: "solid",
    },
    radius: {
      none: "0",
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
      pill: "999px",
    },
    shadow: {
      none: "none",
      sm: "0 0.5rem 1.25rem rgba(23, 32, 51, 0.08)",
      md: "0 1rem 2.5rem rgba(23, 32, 51, 0.12)",
      lg: "0 1.5rem 4rem rgba(23, 32, 51, 0.16)",
    },
    imagery: {
      objectFit: "cover",
      objectPosition: "center",
      radius: "1.5rem",
      overlay: "linear-gradient(180deg, rgba(23, 32, 51, 0) 45%, rgba(23, 32, 51, 0.55) 100%)",
    },
  },
});

export const DEFAULT_THEME_REGISTRY = createThemeRegistry([DEFAULT_THEME], {
  defaultId: DEFAULT_THEME.id,
});

export function createDefaultThemeRegistry(themes = []) {
  return createThemeRegistry([DEFAULT_THEME, ...themes], { defaultId: DEFAULT_THEME.id });
}
