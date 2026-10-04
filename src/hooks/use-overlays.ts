import { useCallback, useState } from "react";

type UseOverlaysResult = {
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  aboutOpen: boolean;
  setAboutOpen: (v: boolean) => void;
  showHelp: () => void;
  showAbout: () => void;
};

export function useOverlays(): UseOverlaysResult {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const showHelp = useCallback(() => setHelpOpen(true), []);
  const showAbout = useCallback(() => setAboutOpen(true), []);

  return {
    paletteOpen,
    setPaletteOpen,
    helpOpen,
    setHelpOpen,
    aboutOpen,
    setAboutOpen,
    showHelp,
    showAbout,
  };
}
