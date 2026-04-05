import type { Config } from "tailwindcss";
import path from "path";
import typography from "@tailwindcss/typography";

const clientDir = path.resolve(import.meta.dirname);

export default {
  content: [
    path.join(clientDir, "src/**/*.{ts,tsx}"),
    path.join(clientDir, "index.html"),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        status: {
          open: "var(--status-open)",
          "in-progress": "var(--status-in-progress)",
          blocked: "var(--status-blocked)",
          closed: "var(--status-closed)",
        },
        priority: {
          0: "var(--priority-0)",
          1: "var(--priority-1)",
          2: "var(--priority-2)",
          3: "var(--priority-3)",
          4: "var(--priority-4)",
        },
        surface: {
          base: "var(--bg-base)",
          card: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          hover: "var(--bg-hover)",
        },
        ink: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
        },
        type: {
          task: "var(--type-task)",
          bug: "var(--type-bug)",
          feature: "var(--type-feature)",
          epic: "var(--type-epic)",
          chore: "var(--type-chore)",
        },
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        card: "var(--shadow-card)",
        md: "var(--shadow-md)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
