export const presentationModes = ["sheet", "drawer", "full-screen"] as const;

export type PresentationMode = (typeof presentationModes)[number];

export type Presentation = Readonly<{
  readonly mode: "sheet" | "drawer" | "full-screen";
  readonly isModal: boolean;
  readonly restoresFocus: boolean;
}>;

export const presentationByMode: Readonly<Record<PresentationMode, Presentation>> = {
  sheet: { mode: "sheet", isModal: true, restoresFocus: true },
  drawer: { mode: "drawer", isModal: true, restoresFocus: true },
  "full-screen": { mode: "full-screen", isModal: false, restoresFocus: false },
};
