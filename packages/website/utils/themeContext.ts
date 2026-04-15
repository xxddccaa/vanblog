import React from "react";
import type { ThemePreference } from "./themeBoot";

export type RealThemeType = ThemePreference;

export const ThemeContext = React.createContext<{
  theme: RealThemeType;
  setTheme: (newState: RealThemeType) => void;
}>({
  theme: "dark",
  setTheme: () => {},
});
