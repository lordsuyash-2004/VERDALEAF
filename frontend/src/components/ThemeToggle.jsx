import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/theme";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="relative w-9 h-9 rounded-full border border-botanical-forest/20 bg-botanical-sage/30 text-botanical-forest dark:text-botanical-moss flex items-center justify-center overflow-hidden hover:bg-botanical-sage/60 hover:border-botanical-forest/40 active:scale-90 transition-colors"
      data-testid="theme-toggle"
    >
      <Sun
        className={`w-4 h-4 absolute transition-all duration-500 ${
          isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
        }`}
      />
      <Moon
        className={`w-4 h-4 absolute transition-all duration-500 ${
          isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"
        }`}
      />
    </button>
  );
};

export default ThemeToggle;
